const { setBattleMessageInfo } = require("../systems/battleSystem");
const { buildChallengeButtons, buildChallengeEmbed, buildBattleView } = require("../systems/uiSystem");
const { getChallengeById, getLatestJoinableChallenge } = require("../systems/challengeSystem");
const { createTrainerChallengeFlow, startTrainerBattleFromChallenge, updateChallengeMessageId } = require("../systems/trainerBattleSystem");
const { requirePlayer } = require("./helpers");

async function resolveTargetUser(message, args) {
  const mentionedUser = message.mentions.users.first();
  if (mentionedUser) {
    return mentionedUser;
  }

  const targetText = args.slice(1).join(" ").trim();
  if (!targetText || !message.guild) {
    return null;
  }

  const members = await message.guild.members.fetch({ query: targetText, limit: 10 });
  const normalizedTarget = targetText.toLowerCase();

  const exact = members.find(member =>
    member.user.username.toLowerCase() === normalizedTarget ||
    member.displayName.toLowerCase() === normalizedTarget
  );

  return exact?.user || members.first()?.user || null;
}

module.exports = {
  name: "battle",
  async execute(message, args) {
    const player = await requirePlayer(message);
    if (!player) {
      return;
    }

    const mode = (args[1] || "").toLowerCase();

    if (!mode) {
      return message.reply("Use `!battle @trainer` for a direct challenge, `!battle open` for an open challenge, or `!battle accept` to accept the latest challenge in this channel. Use `!explore` for wild and NPC trainer encounters.");
    }

    if (mode === "open") {
      const challenge = await createTrainerChallengeFlow({
        challengerId: message.author.id,
        challengerName: message.author.username,
        channelId: message.channel.id
      });

      const reply = await message.reply({
        embeds: [buildChallengeEmbed(challenge)],
        components: buildChallengeButtons(challenge)
      });

      return updateChallengeMessageId(challenge.id, reply.id);
    }

    if (mode === "accept") {
      const challenge = await getLatestJoinableChallenge(message.channel.id, message.author.id);
      if (!challenge) {
        return message.reply("There is no open trainer challenge in this channel that you can accept right now.");
      }

      const context = await startTrainerBattleFromChallenge(challenge.id, message.author.id, message.author.username);
      const reply = await message.reply(buildBattleView(context));
      await setBattleMessageInfo(context.battle.id, reply.channelId, reply.id);

      if (challenge.message_id) {
        const challengeMessage = await message.channel.messages.fetch(challenge.message_id).catch(() => null);
        if (challengeMessage) {
          await challengeMessage.edit({
            embeds: [buildChallengeEmbed(await getChallengeById(challenge.id))],
            components: buildChallengeButtons(challenge, true)
          });
        }
      }

      return;
    }

    const targetUser = await resolveTargetUser(message, args);
    if (!targetUser) {
      return message.reply("I could not find that trainer. Mention them directly or use their exact display name.");
    }

    if (targetUser.id === message.author.id) {
      return message.reply("You cannot challenge yourself to a trainer battle.");
    }

    const challenge = await createTrainerChallengeFlow({
      challengerId: message.author.id,
      challengerName: message.author.username,
      opponentId: targetUser.id,
      opponentName: targetUser.username,
      channelId: message.channel.id
    });

    const reply = await message.reply({
      content: `${targetUser}, you have been challenged.`,
      embeds: [buildChallengeEmbed(challenge)],
      components: buildChallengeButtons(challenge)
    });

    await updateChallengeMessageId(challenge.id, reply.id);
  }
};
