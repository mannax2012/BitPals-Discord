const { PermissionsBitField } = require("discord.js");
const config = require("../../config");
const { createAccountResetRequest } = require("../systems/accountResetSystem");
const { getArea, getDefaultArea } = require("../systems/gameData");
const { getPlayer } = require("../systems/playerSystem");
const { getBitPalsChannelId, setBitPalsChannel } = require("../systems/serverSettingsSystem");
const { getStarterProgress } = require("../systems/starterSystem");
const { buildAccountResetConfirmView, buildCommandHubView, buildHelpEmbed, buildPublicLaunchView } = require("../systems/uiSystem");

function hasHubAdminPermission(message) {
  if (message.guild?.ownerId === message.author.id) {
    return true;
  }

  const permissions = message.memberPermissions || message.member?.permissions;
  return Boolean(permissions?.has(PermissionsBitField.Flags.Administrator));
}

async function resolveResetTargetMember(message, args) {
  const mentionedMember = message.mentions.members?.first();
  if (mentionedMember) {
    return mentionedMember;
  }

  const rawTarget = args[2] || "";
  const idMatch = rawTarget.match(/\d{17,20}/);
  if (!idMatch) {
    return null;
  }

  return message.guild.members.fetch(idMatch[0]).catch(() => null);
}

module.exports = {
  name: "bitpals",
  aliases: ["commands"],
  async execute(message, args) {
    const subcommand = (args[1] || "hub").toLowerCase();

    if (["help", "legacy"].includes(subcommand)) {
      return message.reply({
        embeds: [buildHelpEmbed(config.prefix)]
      });
    }

    if (["setup", "posthub", "setuphub", "launchpost"].includes(subcommand)) {
      if (!message.guild) {
        return message.reply("BitPals setup must be run inside a server text channel.");
      }

      if (!hasHubAdminPermission(message)) {
        return message.reply("Only server administrators can set the BitPals channel.");
      }

      if (!message.channel?.isTextBased()) {
        return message.reply("Run this setup command in the text channel where BitPals should live.");
      }

      await setBitPalsChannel(message.guild.id, message.channel.id, message.author.id);
      await message.channel.send(buildPublicLaunchView());
      return message.reply(`BitPals is now configured for ${message.guild.name}. I will listen for BitPals commands in ${message.channel}.`);
    }

    if (["reset", "resetplayer", "accountreset"].includes(subcommand)) {
      if (!message.guild) {
        return message.reply("Account resets must be requested inside the shared server.");
      }

      if (!hasHubAdminPermission(message)) {
        return message.reply("Only server administrators can request a BitPals account reset.");
      }

      const configuredChannelId = await getBitPalsChannelId(message.guild.id);
      if (configuredChannelId && configuredChannelId !== message.channel.id) {
        return message.reply(`BitPals account resets must be requested in <#${configuredChannelId}>.`);
      }

      const targetMember = await resolveResetTargetMember(message, args);
      if (!targetMember) {
        return message.reply(`Mention the trainer to reset, for example: \`${config.prefix}bitpals reset @trainer\`.`);
      }

      if (targetMember.user.bot) {
        return message.reply("Bot accounts do not have BitPals trainer data to reset.");
      }

      if (targetMember.id === message.author.id) {
        return message.reply("Use a different administrator if you need your own account reset. That keeps the reset flow accountable.");
      }

      const request = await createAccountResetRequest({
        guildId: message.guild.id,
        channelId: message.channel.id,
        adminId: message.author.id,
        targetId: targetMember.id
      });

      const dmPayload = buildAccountResetConfirmView(request, message.guild.name);
      const dm = await targetMember.send(dmPayload).catch(() => null);
      if (!dm) {
        return message.reply(`I could not DM ${targetMember}. Ask them to enable server DMs, then run the reset request again.`);
      }

      return message.reply(`${targetMember} has been sent a reset confirmation DM. Nothing will be deleted unless they confirm it themselves within 15 minutes.`);
    }

    if (!["hub", "menu", "commands"].includes(subcommand)) {
      return message.reply(`Use \`${config.prefix}bitpals\` or \`${config.prefix}commands\` to open the button hub. Use \`${config.prefix}bitpals help\` for typed fallback commands. Server admins can run \`${config.prefix}bitpals setup\` or \`${config.prefix}bitpals reset @trainer\`.`);
    }

    if (message.guild) {
      const configuredChannelId = await getBitPalsChannelId(message.guild.id);
      if (configuredChannelId && configuredChannelId !== message.channel.id) {
        return message.reply(`BitPals is configured for <#${configuredChannelId}> in this server.`);
      }

      if (!configuredChannelId) {
        return message.reply(`BitPals has not been configured for this server yet. A server administrator can run \`${config.prefix}bitpals setup\` in the channel where BitPals should live.`);
      }
    }

    const progress = await getStarterProgress(message.author.id);
    const player = progress.player || await getPlayer(message.author.id);
    const currentArea = progress.hasStarter && player ? getArea(player.current_area) || getDefaultArea() : null;

    await message.reply(buildCommandHubView(message.author.username, message.author.id, player, currentArea, null, progress.hasStarter));
  }
};
