const { setBattleMessageInfo } = require("../systems/battleSystem");
const { getPlayer } = require("../systems/playerSystem");
const { buildBattleView, buildEvolutionMessages, buildLevelUpMessages, buildRewardMessage } = require("../systems/uiSystem");

async function requirePlayer(message) {
  const player = await getPlayer(message.author.id);

  if (!player) {
    await message.reply("Use `!start` first so I can register your trainer profile.");
    return null;
  }

  return player;
}

async function sendBattleMessage(message, context, notice = null) {
  const payload = buildBattleView(context);
  if (notice) {
    payload.content = notice;
  }

  const reply = await message.reply(payload);
  await setBattleMessageInfo(context.battle.id, reply.channelId, reply.id);
  return reply;
}

function prepareDmPayload(payload) {
  return {
    ...payload,
    content: String(payload?.content || "").replace(/<@!?\d+>/g, "").trim() || undefined
  };
}

async function sendBattleNotifications(message, summary) {
  if (!summary) {
    return;
  }

  const rewardPayload = buildRewardMessage(summary);
  const payloads = [
    ...(rewardPayload ? [rewardPayload] : []),
    ...buildLevelUpMessages(summary),
    ...buildEvolutionMessages(summary)
  ];
  let warnedAboutDm = false;

  for (const payload of payloads) {
    await message.author.send(prepareDmPayload(payload)).catch(async () => {
      if (!warnedAboutDm) {
        warnedAboutDm = true;
        await message.reply("I could not DM your reward details. Check your Discord privacy settings for server DMs.");
      }
    });
  }
}

async function sendBattleTurnMessage(message, context) {
  await message.reply(buildBattleView(context));

  const rewardSummary = context?.state?.rewardSummary;
  await sendBattleNotifications(message, rewardSummary);
}

module.exports = {
  requirePlayer,
  sendBattleMessage,
  sendBattleTurnMessage
};
