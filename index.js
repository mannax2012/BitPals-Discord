const path = require("path");
const { Client, GatewayIntentBits } = require("discord.js");
const fs = require("fs");
const config = require("./config");
const db = require("./database/db");
const { initializeDatabase } = require("./database/setup");
const { handleInteraction } = require("./game/systems/interactionSystem");
const { getBitPalsChannelId } = require("./game/systems/serverSettingsSystem");

const useMessageContentIntent = config.discord?.messageContentIntent !== false;
const intents = [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages];

if (useMessageContentIntent) {
  intents.push(GatewayIntentBits.MessageContent);
}

const client = new Client({
  intents
});

client.commands = new Map();
let botInstanceLockConnection = null;

function isGatewayHandshakeTimeout(err) {
  return /opening handshake has timed out/i.test(String(err?.message || err));
}

function isExpectedInteractionError(err) {
  return err?.code === 10062 || err?.code === 40060;
}

function logOperationalError(label, err) {
  console.warn(`[${label}] ${err?.message || err}`);
}

async function acquireBotInstanceLock() {
  botInstanceLockConnection = await db.getPool().getConnection();
  const [rows] = await botInstanceLockConnection.query("SELECT GET_LOCK('bitpals:discord-bot-instance', 0) AS acquired");

  if (rows[0]?.acquired !== 1) {
    botInstanceLockConnection.release();
    botInstanceLockConnection = null;
    throw new Error("Another BitPals bot process is already running. Stop the older node process before starting a new one.");
  }
}

async function releaseBotInstanceLock() {
  if (!botInstanceLockConnection) {
    return;
  }

  const connection = botInstanceLockConnection;
  botInstanceLockConnection = null;
  await connection.query("SELECT RELEASE_LOCK('bitpals:discord-bot-instance')").catch(() => null);
  connection.release();
}

async function shutdown(signal) {
  console.log(`${signal} received. Shutting down BitPals bot.`);
  await releaseBotInstanceLock();
  await db.end().catch(() => null);
  process.exit(0);
}

process.on("unhandledRejection", err => {
  logOperationalError("Unhandled promise rejection", err);
});

process.on("uncaughtException", err => {
  if (isGatewayHandshakeTimeout(err)) {
    logOperationalError("Discord gateway timeout", err);
    console.warn("The Discord WebSocket handshake timed out. The bot will keep running and allow discord.js to reconnect.");
    return;
  }

  console.error("Uncaught exception:", err);
  process.exit(1);
});

process.on("SIGINT", () => {
  shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

function loadCommands() {
  const commandsPath = path.join(__dirname, "game", "commands");
  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith(".js"));

  for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if (!command?.name || typeof command.execute !== "function") {
      continue;
    }

    client.commands.set(String(command.name).toLowerCase(), command);

    if (Array.isArray(command.aliases)) {
      for (const alias of command.aliases) {
        const normalizedAlias = String(alias).toLowerCase();
        if (!client.commands.has(normalizedAlias)) {
          client.commands.set(normalizedAlias, command);
        }
      }
    }
  }
}

function isBitPalsSetupCommand(commandName, args) {
  return commandName === "bitpals"
    && ["setup", "posthub", "setuphub", "launchpost"].includes(String(args[1] || "").toLowerCase());
}

client.on("messageCreate", async message => {
  if (!useMessageContentIntent) return;
  if (!message.content.startsWith(config.prefix) || message.author.bot) return;

  const args = message.content.slice(config.prefix.length).trim().split(/\s+/);
  const commandName = args[0]?.toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    if (message.guild && !isBitPalsSetupCommand(commandName, args)) {
      const configuredChannelId = await getBitPalsChannelId(message.guild.id);

      if (!configuredChannelId) {
        if (commandName === "bitpals" || commandName === "commands") {
          return message.reply(`BitPals has not been configured for this server yet. A server administrator can run \`${config.prefix}bitpals setup\` in the channel where BitPals should live.`);
        }

        return;
      }

      if (configuredChannelId !== message.channel.id) {
        if (commandName === "bitpals" || commandName === "commands") {
          return message.reply(`BitPals is configured for <#${configuredChannelId}> in this server.`);
        }

        return;
      }
    }

    await command.execute(message, args);
  } catch (err) {
    console.error(err);
    message.reply(err.message || "Error executing command.");
  }
});

client.on("interactionCreate", async interaction => {
  try {
    await handleInteraction(interaction);
  } catch (err) {
    if (isExpectedInteractionError(err)) {
      logOperationalError("Discord interaction skipped", err);
      return;
    }

    console.error(err);
  }
});

client.on("error", err => {
  logOperationalError("Discord client error", err);
});

client.on("shardError", (err, shardId) => {
  logOperationalError(`Discord shard ${shardId} error`, err);
});

client.on("shardDisconnect", (event, shardId) => {
  console.warn(`[Discord shard ${shardId} disconnected] Code ${event.code}: ${event.reason || "No reason provided"}`);
});

client.on("shardReconnecting", shardId => {
  console.warn(`[Discord shard ${shardId}] Reconnecting...`);
});

client.on("shardResume", (shardId, replayedEvents) => {
  console.log(`[Discord shard ${shardId}] Resumed. Replayed events: ${replayedEvents}`);
});

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);

  if (!useMessageContentIntent) {
    console.warn("Message Content intent is disabled, so prefix commands like !start and !battle will not work.");
  }
});

async function bootstrap() {
  await initializeDatabase();
  await acquireBotInstanceLock();
  loadCommands();
  await client.login(config.token);
}

bootstrap().catch(err => {
  console.error("Failed to start bot:", err);

  if (err.code === "ECONNREFUSED") {
    console.error(`MySQL is not reachable at ${config.db.host}:${config.db.port || 3306}. Start that MySQL instance and try again.`);
  }

  if (err.code === "ER_ACCESS_DENIED_ERROR") {
    console.error("MySQL rejected the username/password in config.js.");
  }

  if (err.code === "ER_BAD_DB_ERROR") {
    console.error(`The database '${config.db.database}' could not be opened. The setup step should create it automatically once MySQL is reachable.`);
  }

  if (err.code === "TokenInvalid") {
    console.error("Discord rejected the bot token in config.js. Replace it with a valid bot token from the Discord Developer Portal.");
  }

  if (/disallowed intents/i.test(String(err.message || err))) {
    console.error("Discord rejected one or more requested gateway intents.");
    console.error("Enable 'Message Content Intent' in the Discord Developer Portal under Bot > Privileged Gateway Intents.");
    console.error("This bot's !prefix command system depends on that intent being enabled.");
    console.error("If you want the bot to start without it, set config.discord.messageContentIntent to false, but !commands will be unavailable.");
  }

  process.exit(1);
});
