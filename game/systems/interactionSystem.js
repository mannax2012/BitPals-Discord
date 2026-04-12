const { MessageFlags } = require("discord.js");
const {
  getAccountResetRequest,
  resetPlayerAccount,
  setAccountResetStatus
} = require("./accountResetSystem");
const {
  buyItem,
  getActiveBattle,
  getBattleContextById,
  processBattleAction,
  releaseBattleActionLock,
  setBattleMessageInfo,
  sellItem,
  startGymBattle,
  startTrainerEncounter,
  startWildBattle
} = require("./battleSystem");
const { closeChallenge, getChallengeById } = require("./challengeSystem");
const { getArea, getAreas, getDefaultArea, getMove, getGym, getStarterSpecies, getUnlockedAreas } = require("./gameData");
const { getInventory } = require("./inventorySystem");
const { depositPartyMonsterToBox, getBox, getMonsterById, getParty, healParty, moveBoxMonsterToParty, setPartyLead, swapPartySlots, updateMonsterMoveSlot, updateMonsterNickname } = require("./monsterSystem");
const { getPlayer, hasBadge, setCurrentArea } = require("./playerSystem");
const { getBitPalsChannelId } = require("./serverSettingsSystem");
const { claimStarter, getStarterProgress } = require("./starterSystem");
const {
  buildBattleView,
  buildAccountResetResolvedView,
  buildChallengeButtons,
  buildChallengeEmbed,
  buildCommandHubView,
  buildDirectChallengeModal,
  buildEvolutionMessages,
  buildGymButtons,
  buildGymEmbed,
  buildHelpEmbed,
  buildInventoryEmbed,
  buildLevelUpMessages,
  buildNicknameModal,
  buildPartyMoveEditorView,
  buildPartyMonsterView,
  buildPartySwitchModal,
  buildPartyView,
  buildRewardMessage,
  buildShopButtons,
  buildShopEmbed,
  buildStarterChoiceView,
  buildStarterClaimedView,
  buildStorageMonsterView,
  buildStorageView,
  buildTravelButtons,
  buildTravelEmbed,
  buildTrainerActionMenu,
  buildTradeOfferButtons,
  buildTradeOfferEmbed,
  buildTradeOfferModal,
  withHubReturn
} = require("./uiSystem");
const {
  buildTrainerBattleContext,
  createTrainerChallengeFlow,
  getActionMenuContext,
  getLatestJoinableChallenge,
  lockTrainerAction,
  startTrainerBattleFromChallenge,
  updateChallengeMessageId
} = require("./trainerBattleSystem");
const {
  acceptTradeOffer,
  cancelTradeOffer,
  createTradeOffer,
  declineTradeOffer,
  getTradeOfferById,
  setTradeMessageId
} = require("./tradeSystem");

function isPartyMonster(monster) {
  return Number.isInteger(monster?.party_slot) && monster.party_slot >= 1 && monster.party_slot <= 6;
}

function isStoredMonster(monster) {
  return !isPartyMonster(monster);
}

function ephemeralResponse(options) {
  return {
    ...options,
    flags: MessageFlags.Ephemeral
  };
}

async function ensureConfiguredInteractionChannel(interaction) {
  if (!interaction.guildId) {
    return true;
  }

  const configuredChannelId = await getBitPalsChannelId(interaction.guildId);
  if (!configuredChannelId) {
    await interaction.reply(ephemeralResponse({
      content: "BitPals has not been configured for this server yet. A server administrator can run `!bitpals setup` in the channel where BitPals should live."
    }));
    return false;
  }

  if (configuredChannelId !== interaction.channelId) {
    await interaction.reply(ephemeralResponse({
      content: `BitPals is configured for <#${configuredChannelId}> in this server.`
    }));
    return false;
  }

  return true;
}

function isExpectedInteractionError(err) {
  return err?.code === 10062 || err?.code === 40060;
}

const TURN_PLAYBACK_DELAY_MS = 1200;
const TURN_PLAYBACK_ACTIONS = new Set(["move", "item", "switch", "run"]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function disablePayloadComponents(components = []) {
  return components.map(row => {
    const json = row.toJSON ? row.toJSON() : row;
    return {
      ...json,
      components: (json.components || []).map(component => ({
        ...component,
        disabled: true
      }))
    };
  });
}

function buildBattlePlaybackPayload(context, frame, index = 0, total = 1) {
  const payload = buildBattleView(context);
  const title = frame?.title || "Resolving turn...";
  const detail = frame?.detail ? `\n${frame.detail}` : "";
  const progress = total > 1 ? ` (${index + 1}/${total})` : "";

  return {
    ...payload,
    content: `**Resolving turn${progress}**\n${title}${detail}`,
    components: disablePayloadComponents(payload.components)
  };
}

async function editInteractionOrMessage(interaction, payload) {
  try {
    return await interaction.editReply(payload);
  } catch (err) {
    if (err?.code !== 10062 || !interaction.message?.edit) {
      throw err;
    }

    return interaction.message.edit(payload);
  }
}

function clonePlaybackContext(context) {
  return JSON.parse(JSON.stringify(context));
}

function findMonsterInPlaybackContext(context, monsterId) {
  if (!monsterId) {
    return [];
  }

  const matches = [];

  if (context.activeMonster?.id === monsterId) {
    matches.push(context.activeMonster);
  }

  for (const monster of context.party || []) {
    if (monster.id === monsterId) {
      matches.push(monster);
    }
  }

  for (const participant of context.participants || []) {
    if (participant.activeMonster?.id === monsterId) {
      matches.push(participant.activeMonster);
    }

    for (const monster of participant.party || []) {
      if (monster.id === monsterId) {
        matches.push(monster);
      }
    }
  }

  return matches;
}

function setPlaybackHp(context, change, hpField) {
  const hpValue = change?.[hpField];

  if (!Number.isInteger(hpValue)) {
    return;
  }

  if (change.target === "enemy") {
    const enemy = context.state?.enemyParty?.[change.enemyIndex];
    if (enemy) {
      enemy.currentHp = hpValue;
    }

    if (change.enemyIndex === context.state?.enemyActiveIndex && context.enemyActive) {
      context.enemyActive.currentHp = hpValue;
    }

    return;
  }

  for (const monster of findMonsterInPlaybackContext(context, change.monsterId)) {
    monster.current_hp = hpValue;
  }
}

function getEnemyPlaybackMonster(context, enemyIndex) {
  const enemy = context.state?.enemyParty?.[enemyIndex];
  return enemy
    ? {
        ...enemy,
        moves: context.enemyActive?.moves || []
      }
    : null;
}

function getPlaybackPartyMonster(context, monsterId) {
  return findMonsterInPlaybackContext(context, monsterId)[0] || null;
}

function applyPlaybackActiveChange(context, change) {
  if (change.target === "enemyActive") {
    const enemy = getEnemyPlaybackMonster(context, change.enemyIndex);
    if (!enemy) {
      return;
    }

    context.state.enemyActiveIndex = change.enemyIndex;
    context.enemyActive = enemy;
    return;
  }

  if (change.target === "playerActive") {
    const monster = getPlaybackPartyMonster(context, change.monsterId);
    if (!monster) {
      return;
    }

    context.state.playerActiveMonsterId = change.monsterId;
    context.activeMonster = monster;
    return;
  }

  if (change.target === "pvpActive") {
    const participant = (context.participants || []).find(entry => entry.id === change.playerId);
    if (!participant) {
      return;
    }

    const monster = participant.party.find(entry => entry.id === change.monsterId);
    if (!monster) {
      return;
    }

    participant.side.activeMonsterId = change.monsterId;
    participant.activeMonster = monster;
  }
}

function createPlaybackDisplayContext(beforeContext, finalContext) {
  if (beforeContext) {
    return clonePlaybackContext(beforeContext);
  }

  const displayContext = clonePlaybackContext(finalContext);
  const events = finalContext?.state?.turnPlayback || [];

  for (let eventIndex = events.length - 1; eventIndex >= 0; eventIndex -= 1) {
    for (const change of events[eventIndex].hpChanges || []) {
      setPlaybackHp(displayContext, change, "beforeHp");
    }
  }

  return displayContext;
}

function applyPlaybackFrame(displayContext, frame) {
  for (const change of frame?.hpChanges || []) {
    setPlaybackHp(displayContext, change, "afterHp");
  }

  for (const change of frame?.activeChanges || []) {
    applyPlaybackActiveChange(displayContext, change);
  }
}

async function playBattlePlaybackWithEditor(editPayload, beforeContext, finalContext) {
  const events = finalContext?.state?.turnPlayback || [];
  const displayContext = createPlaybackDisplayContext(beforeContext, finalContext);

  await editPayload(buildBattlePlaybackPayload(displayContext, {
    title: "Controls locked.",
    detail: "Damage, healing, and turn effects are being applied."
  }));

  if (events.length === 0) {
    await sleep(TURN_PLAYBACK_DELAY_MS);
  }

  for (let index = 0; index < events.length; index += 1) {
    await sleep(TURN_PLAYBACK_DELAY_MS);
    applyPlaybackFrame(displayContext, events[index]);
    await editPayload(buildBattlePlaybackPayload(displayContext, events[index], index, events.length));
  }

  if (events.length > 0) {
    await sleep(TURN_PLAYBACK_DELAY_MS);
  }

  await editPayload({
    ...buildBattleView(finalContext),
    content: ""
  });
}

async function playBattlePlayback(interaction, beforeContext, finalContext) {
  return playBattlePlaybackWithEditor(payload => editInteractionOrMessage(interaction, payload), beforeContext, finalContext);
}

async function playBattlePlaybackOnMessage(message, beforeContext, finalContext) {
  return playBattlePlaybackWithEditor(payload => message.edit(payload), beforeContext, finalContext);
}

function getCurrentAreaForPlayer(player) {
  return getArea(player?.current_area) || getDefaultArea();
}

async function buildHubPayload(interaction, notice = null) {
  const progress = await getStarterProgress(interaction.user.id);
  const player = progress.player;
  const currentArea = progress.hasStarter && player ? getCurrentAreaForPlayer(player) : null;
  return buildCommandHubView(interaction.user.username, interaction.user.id, player, currentArea, notice, progress.hasStarter);
}

async function requireInteractionPlayer(interaction) {
  const progress = await getStarterProgress(interaction.user.id);
  if (!progress.player || !progress.hasStarter) {
    await interaction.reply(ephemeralResponse({
      content: "Choose a starter from the BitPals hub first, then this button will unlock."
    }));
    return null;
  }

  return progress.player;
}

function buildTravelPayload(ownerId, player, notice = null) {
  const currentArea = getCurrentAreaForPlayer(player);
  const unlockedAreas = getUnlockedAreas(player);
  const allAreas = getAreas();

  return {
    embeds: [buildTravelEmbed(player, currentArea, unlockedAreas, allAreas, notice)],
    components: buildTravelButtons(ownerId, currentArea, unlockedAreas)
  };
}

async function replyWithBattleBoard(interaction, context, { privateReply = false, trackMessage = true, notice = null } = {}) {
  const payload = buildBattleView(context);
  if (notice) {
    payload.content = notice;
  }

  await interaction.reply(privateReply ? ephemeralResponse(payload) : payload);
  const reply = await interaction.fetchReply().catch(() => null);

  if (trackMessage && reply?.id) {
    await setBattleMessageInfo(context.battle.id, reply.channelId, reply.id);
  }

  return reply;
}

function getNotificationRecipients(summary) {
  if (!summary) {
    return [];
  }

  if (summary.kind === "pvp") {
    return summary.players.map(player => player.playerId);
  }

  return [summary.playerId];
}

function getPayloadRecipientIds(payload, fallbackIds = []) {
  const ids = [];
  const content = String(payload?.content || "");
  const mentionMatches = content.matchAll(/<@!?(\d+)>/g);

  for (const match of mentionMatches) {
    ids.push(match[1]);
  }

  return ids.length > 0 ? ids : fallbackIds;
}

function prepareDmPayload(payload) {
  return {
    ...payload,
    content: String(payload?.content || "").replace(/<@!?\d+>/g, "").trim() || undefined
  };
}

async function sendDmPayload(client, userId, payload) {
  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) {
    return false;
  }

  await user.send(prepareDmPayload(payload));
  return true;
}

async function sendBattleNotifications(client, summary, interaction = null) {
  if (!summary) {
    return;
  }

  const failedRecipients = new Set();
  const baseRecipients = getNotificationRecipients(summary);
  const rewardPayload = buildRewardMessage(summary);
  const payloads = [
    ...(rewardPayload ? [{ payload: rewardPayload, recipients: baseRecipients }] : []),
    ...buildLevelUpMessages(summary).map(payload => ({
      payload,
      recipients: getPayloadRecipientIds(payload, baseRecipients)
    })),
    ...buildEvolutionMessages(summary).map(payload => ({
      payload,
      recipients: getPayloadRecipientIds(payload, baseRecipients)
    }))
  ];

  for (const entry of payloads) {
    for (const userId of entry.recipients) {
      const sent = await sendDmPayload(client, userId, entry.payload).catch(() => false);
      if (!sent) {
        failedRecipients.add(userId);
      }
    }
  }

  if (interaction && failedRecipients.has(interaction.user.id)) {
    const replyMethod = interaction.deferred || interaction.replied ? "followUp" : "reply";
    await interaction[replyMethod](ephemeralResponse({
      content: "I could not DM your reward details. Check your Discord privacy settings for server DMs."
    })).catch(() => null);
  }
}

async function resolveTargetUserFromText(interaction, targetText) {
  const rawText = String(targetText || "").trim();
  const idMatch = rawText.match(/\d{17,20}/);

  if (!rawText || !interaction.guild) {
    return null;
  }

  if (idMatch) {
    const member = await interaction.guild.members.fetch(idMatch[0]).catch(() => null);
    if (member) {
      return member.user;
    }
  }

  const members = await interaction.guild.members.fetch({ query: rawText, limit: 10 }).catch(() => null);
  if (!members || members.size === 0) {
    return null;
  }

  const normalizedTarget = rawText.toLowerCase();
  const exact = members.find(member =>
    member.user.username.toLowerCase() === normalizedTarget ||
    member.displayName.toLowerCase() === normalizedTarget ||
    member.user.globalName?.toLowerCase() === normalizedTarget
  );

  return exact?.user || members.first()?.user || null;
}

async function assertRosterUnlocked(playerId) {
  const activeBattle = await getActiveBattle(playerId);
  if (activeBattle) {
    throw new Error("Finish your active battle before changing nicknames, move sets, or party/storage placement.");
  }
}

async function handleBattleInteraction(interaction, parts) {
  const battleId = Number(parts[1]);
  const action = parts[2];
  const value = parts[3] === "_" ? null : parts[3];
  const expectedActionVersion = Number(parts[4]);
  let acknowledged = false;
  let lockedContext = null;
  let actionLockToken = null;

  try {
    await interaction.deferUpdate();
    acknowledged = true;

    const shouldPlayTurn = TURN_PLAYBACK_ACTIONS.has(action);
    if (shouldPlayTurn) {
      lockedContext = await getBattleContextById(battleId);
      if (lockedContext?.battle?.player_id && lockedContext.battle.player_id !== interaction.user.id) {
        throw new Error("That battle belongs to another trainer.");
      }

      if (lockedContext) {
        await editInteractionOrMessage(interaction, buildBattlePlaybackPayload(lockedContext, {
          title: "Controls locked.",
          detail: "Resolving this turn now."
        }));
      }
    }

    let context;
    const actionOptions = Number.isInteger(expectedActionVersion)
      ? { expectedActionVersion }
      : {};

    if (action === "menu") {
      context = await processBattleAction(interaction.user.id, battleId, "menu", value, actionOptions);
    } else if (action === "move") {
      context = await processBattleAction(interaction.user.id, battleId, "move", value, {
        ...actionOptions,
        holdActionLock: true
      });
    } else if (action === "item") {
      context = await processBattleAction(interaction.user.id, battleId, "item", value, {
        ...actionOptions,
        holdActionLock: true
      });
    } else if (action === "switch") {
      context = await processBattleAction(interaction.user.id, battleId, "switch", value, {
        ...actionOptions,
        holdActionLock: true
      });
    } else if (action === "run") {
      context = await processBattleAction(interaction.user.id, battleId, "run", value, {
        ...actionOptions,
        holdActionLock: true
      });
    } else if (action === "back") {
      context = await processBattleAction(interaction.user.id, battleId, "back", value, actionOptions);
    } else {
      throw new Error("Unknown battle interaction.");
    }

    actionLockToken = context?.actionLockToken || null;

    if (shouldPlayTurn) {
      await playBattlePlayback(interaction, lockedContext, context);
      if (actionLockToken) {
        context = await releaseBattleActionLock(battleId, actionLockToken);
        actionLockToken = null;
        await editInteractionOrMessage(interaction, {
          ...buildBattleView(context),
          content: ""
        });
      }
    } else {
      await editInteractionOrMessage(interaction, buildBattleView(context));
    }

    const rewardSummary = context?.state?.rewardSummary;
    await sendBattleNotifications(interaction.client, rewardSummary, interaction);
  } catch (err) {
    if (actionLockToken) {
      await releaseBattleActionLock(battleId, actionLockToken, { advanceVersion: false }).catch(releaseErr => {
        console.error(releaseErr);
      });
      actionLockToken = null;
    }

    if (isExpectedInteractionError(err)) {
      console.warn(`Discord battle interaction skipped: ${err.message}`);
      return;
    }

    if (lockedContext && acknowledged) {
      await editInteractionOrMessage(interaction, {
        ...buildBattleView(lockedContext),
        content: ""
      }).catch(replyErr => {
        if (replyErr.code !== 10062) {
          console.error(replyErr);
        }
      });
    }

    const replyMethod = interaction.deferred || interaction.replied || acknowledged ? "followUp" : "reply";
    await interaction[replyMethod](ephemeralResponse({
      content: err.message
    })).catch(replyErr => {
      if (replyErr.code !== 10062) {
        console.error(replyErr);
      }
    });
  }
}

async function refreshTrainerBattleMessage(interaction, context) {
  const messageId = context.battle.message_id;

  if (!messageId || !interaction.channel) {
    return;
  }

  const mainMessage = await getTrainerBattleMessage(interaction, context);
  if (!mainMessage) {
    return;
  }

  await mainMessage.edit(buildBattleView(context));
}

async function getTrainerBattleMessage(interaction, context) {
  const messageId = context.battle.message_id;

  if (!messageId || !interaction.channel) {
    return null;
  }

  return interaction.message.id === messageId
    ? interaction.message
    : interaction.channel.messages.fetch(messageId);
}

async function handlePvpInteraction(interaction, parts) {
  const battleId = Number(parts[1]);
  const action = parts[2];
  const value = parts[3];

  try {
    if (action === "menu") {
      const context = await getActionMenuContext(interaction.user.id, battleId);
      return interaction.reply(buildTrainerActionMenu(context, interaction.user.id, value));
    }

    const beforeContext = TURN_PLAYBACK_ACTIONS.has(action)
      ? await buildTrainerBattleContext(battleId)
      : null;
    const { context, resolved } = await lockTrainerAction(interaction.user.id, battleId, action, value);
    await interaction.update({
      content: resolved
        ? "Action locked in. The turn resolved on the main battle board."
        : "Action locked in. Waiting for the other trainer.",
      components: []
    });

    if (resolved) {
      const mainMessage = await getTrainerBattleMessage(interaction, context);
      if (mainMessage) {
        await playBattlePlaybackOnMessage(mainMessage, beforeContext, context);
      } else {
        await refreshTrainerBattleMessage(interaction, context);
      }
    } else {
      await refreshTrainerBattleMessage(interaction, context);
    }

    const rewardSummary = context?.state?.rewardSummary;
    await sendBattleNotifications(interaction.client, rewardSummary, interaction);
  } catch (err) {
    if (isExpectedInteractionError(err)) {
      console.warn(`Discord trainer battle interaction skipped: ${err.message}`);
      return;
    }

    const replyMethod = interaction.deferred || interaction.replied ? "followUp" : "reply";
    await interaction[replyMethod](ephemeralResponse({
      content: err.message
    }));
  }
}

async function handleHubInteraction(interaction, parts) {
  const ownerId = parts[1];
  const action = parts[2];

  if (interaction.user.id !== ownerId) {
    return interaction.reply(ephemeralResponse({
      content: "That command hub belongs to another trainer. Run `!bitpals` to open your own."
    }));
  }

  try {
    if (action === "home") {
      return interaction.update(await buildHubPayload(interaction));
    }

    if (action === "help") {
      return interaction.reply(ephemeralResponse({
        embeds: [buildHelpEmbed("!")]
      }));
    }

    if (action === "start") {
      const progress = await getStarterProgress(ownerId);

      if (progress.hasStarter) {
        return interaction.reply(ephemeralResponse(
          buildStarterClaimedView(interaction.user.username, {
            alreadyStarted: true,
            starter: progress.starter
          }, ownerId)
        ));
      }

      return interaction.reply(ephemeralResponse(
        withHubReturn(buildStarterChoiceView(interaction.user.username, ownerId), ownerId)
      ));
    }

    const player = await requireInteractionPlayer(interaction);
    if (!player) {
      return;
    }

    if (action === "explore") {
      const activeBattle = await getActiveBattle(ownerId);
      if (activeBattle) {
        const context = activeBattle.battle_type === "trainer_pvp"
          ? await buildTrainerBattleContext(activeBattle.id)
          : await getBattleContextById(activeBattle.id);
        return replyWithBattleBoard(interaction, context, {
          privateReply: true,
          trackMessage: false,
          notice: "You already have an active battle. Bringing it back into focus."
        });
      }

      const area = getCurrentAreaForPlayer(player);
      const trainerRoll = Math.random() < (area.trainerChance || 0.3);
      const context = trainerRoll
        ? await startTrainerEncounter(ownerId, area.key)
        : await startWildBattle(ownerId, area.key);
      return replyWithBattleBoard(interaction, context, { privateReply: true, trackMessage: false });
    }

    if (action === "travel") {
      return interaction.update(buildTravelPayload(ownerId, player));
    }

    if (action === "gym") {
      const area = getCurrentAreaForPlayer(player);
      if (!area.gymKey) {
        return interaction.reply(ephemeralResponse({
          content: `There is no official gym challenge in ${area.name}. Try Explore here, or Travel to a badge route.`
        }));
      }

      const gym = getGym(area.gymKey);
      return interaction.reply(ephemeralResponse({
        embeds: [buildGymEmbed(player, area.gymKey, area)],
        components: [
          ...buildGymButtons(ownerId, area.gymKey, hasBadge(player, gym.badgeName)),
          ...withHubReturn({ components: [] }, ownerId).components
        ]
      }));
    }

    if (action === "heal") {
      const activeBattle = await getActiveBattle(ownerId);
      if (activeBattle) {
        throw new Error("Finish your active battle before visiting the healing center.");
      }

      await healParty(ownerId);
      return interaction.update(await buildHubPayload(interaction, "Your whole party has been restored at the healing center."));
    }

    if (action === "party") {
      const party = await getParty(ownerId);
      const box = await getBox(ownerId);
      return interaction.reply(ephemeralResponse(
        withHubReturn(buildPartyView(interaction.user.username, ownerId, party, box), ownerId)
      ));
    }

    if (action === "storage") {
      const party = await getParty(ownerId);
      const box = await getBox(ownerId);
      return interaction.reply(ephemeralResponse(
        withHubReturn(buildStorageView(interaction.user.username, ownerId, party, box), ownerId)
      ));
    }

    if (action === "bag") {
      const inventory = await getInventory(ownerId);
      return interaction.reply(ephemeralResponse(withHubReturn({
        embeds: [buildInventoryEmbed(interaction.user.username, player, inventory)]
      }, ownerId)));
    }

    if (action === "shop") {
      const inventory = await getInventory(ownerId);
      return interaction.reply(ephemeralResponse(withHubReturn({
        embeds: [buildShopEmbed(player, inventory)],
        components: buildShopButtons(player, inventory)
      }, ownerId)));
    }

    if (action === "battle_open") {
      const challenge = await createTrainerChallengeFlow({
        challengerId: ownerId,
        challengerName: interaction.user.username,
        channelId: interaction.channel.id
      });

      await interaction.reply({
        embeds: [buildChallengeEmbed(challenge)],
        components: buildChallengeButtons(challenge)
      });
      const reply = await interaction.fetchReply();
      return updateChallengeMessageId(challenge.id, reply.id);
    }

    if (action === "battle_accept") {
      const challenge = await getLatestJoinableChallenge(interaction.channel.id, ownerId);
      if (!challenge) {
        return interaction.reply(ephemeralResponse({
          content: "There is no open trainer challenge in this channel that you can accept right now."
        }));
      }

      const context = await startTrainerBattleFromChallenge(challenge.id, ownerId, interaction.user.username);
      await replyWithBattleBoard(interaction, context, { privateReply: false, trackMessage: true });

      if (challenge.message_id) {
        const challengeMessage = await interaction.channel.messages.fetch(challenge.message_id).catch(() => null);
        if (challengeMessage) {
          await challengeMessage.edit({
            embeds: [buildChallengeEmbed(await getChallengeById(challenge.id))],
            components: buildChallengeButtons(challenge, true)
          });
        }
      }

      return;
    }

    if (action === "battle_direct") {
      return interaction.showModal(buildDirectChallengeModal(ownerId));
    }

    if (action === "trade") {
      return interaction.showModal(buildTradeOfferModal(ownerId));
    }

    throw new Error("Unknown hub action.");
  } catch (err) {
    const replyMethod = interaction.deferred || interaction.replied ? "followUp" : "reply";
    await interaction[replyMethod](ephemeralResponse({
      content: err.message
    }));
  }
}

async function handleTradeInteraction(interaction, parts) {
  const tradeId = Number(parts[1]);
  const action = parts[2];

  try {
    const trade = await getTradeOfferById(tradeId);
    if (!trade) {
      throw new Error("That trade offer could not be found.");
    }

    let updatedTrade;
    if (action === "accept") {
      updatedTrade = await acceptTradeOffer(tradeId, interaction.user.id);
    } else if (action === "decline") {
      updatedTrade = await declineTradeOffer(tradeId, interaction.user.id);
    } else if (action === "cancel") {
      updatedTrade = await cancelTradeOffer(tradeId, interaction.user.id);
    } else {
      throw new Error("Unknown trade action.");
    }

    await interaction.update({
      embeds: [buildTradeOfferEmbed(updatedTrade)],
      components: buildTradeOfferButtons(updatedTrade, true)
    });

    if (updatedTrade.status === "completed") {
      const notice = `Trade complete: ${updatedTrade.proposer_name} received ${updatedTrade.target_monster_name}, and ${updatedTrade.target_name} received ${updatedTrade.proposer_monster_name}.`;
      await sendDmPayload(interaction.client, updatedTrade.proposer_id, { content: notice }).catch(() => false);
      await sendDmPayload(interaction.client, updatedTrade.target_id, { content: notice }).catch(() => false);
    }
  } catch (err) {
    const replyMethod = interaction.deferred || interaction.replied ? "followUp" : "reply";
    await interaction[replyMethod](ephemeralResponse({
      content: err.message
    }));
  }
}

async function handleLaunchInteraction(interaction) {
  return interaction.reply(ephemeralResponse(await buildHubPayload(interaction)));
}

async function handleTravelInteraction(interaction, parts) {
  const ownerId = parts[1];
  const action = parts[2];
  const areaKey = parts[3];

  if (interaction.user.id !== ownerId) {
    return interaction.reply(ephemeralResponse({
      content: "That travel map belongs to another trainer. Run `!bitpals` to open your own."
    }));
  }

  try {
    if (action === "hub") {
      return interaction.update(await buildHubPayload(interaction));
    }

    const player = await requireInteractionPlayer(interaction);
    if (!player) {
      return;
    }

    const currentArea = getCurrentAreaForPlayer(player);
    const unlockedAreas = getUnlockedAreas(player);
    const requestedArea = getArea(areaKey);

    if (!requestedArea) {
      return interaction.update(buildTravelPayload(ownerId, player, "That area could not be found anymore. The map has been refreshed."));
    }

    if (!unlockedAreas.some(area => area.key === requestedArea.key)) {
      return interaction.update(buildTravelPayload(ownerId, player, `${requestedArea.name} is still locked. Earn ${requestedArea.requiredBadge} first to open that route.`));
    }

    if (requestedArea.key === currentArea.key) {
      return interaction.update(buildTravelPayload(ownerId, player, `You are already in ${currentArea.name}.`));
    }

    const activeBattle = await getActiveBattle(ownerId);
    if (activeBattle) {
      throw new Error("Finish your current battle before traveling to a new area.");
    }

    const updatedPlayer = await setCurrentArea(ownerId, requestedArea.key);
    return interaction.update(buildTravelPayload(ownerId, updatedPlayer, `You traveled to ${requestedArea.name}. Wild encounters and trainer encounters now pull from this area.`));
  } catch (err) {
    const replyMethod = interaction.deferred || interaction.replied ? "followUp" : "reply";
    await interaction[replyMethod](ephemeralResponse({
      content: err.message
    }));
  }
}

async function handleDirectChallengeModalSubmit(interaction, parts) {
  const ownerId = parts[1];

  if (interaction.user.id !== ownerId) {
    return interaction.reply(ephemeralResponse({
      content: "That direct challenge form belongs to another trainer."
    }));
  }

  try {
    const player = await requireInteractionPlayer(interaction);
    if (!player) {
      return;
    }

    const targetText = interaction.fields.getTextInputValue("trainer");
    const targetUser = await resolveTargetUserFromText(interaction, targetText);

    if (!targetUser) {
      return interaction.reply(ephemeralResponse({
        content: "I could not find that trainer. Try a direct mention, user ID, exact username, or exact server display name."
      }));
    }

    if (targetUser.bot) {
      return interaction.reply(ephemeralResponse({
        content: "Trainer battles need another human trainer, not a bot."
      }));
    }

    if (targetUser.id === ownerId) {
      return interaction.reply(ephemeralResponse({
        content: "You cannot challenge yourself to a trainer battle."
      }));
    }

    const challenge = await createTrainerChallengeFlow({
      challengerId: ownerId,
      challengerName: interaction.user.username,
      opponentId: targetUser.id,
      opponentName: targetUser.username,
      channelId: interaction.channel.id
    });

    await interaction.reply({
      content: `${targetUser}, you have been challenged.`,
      embeds: [buildChallengeEmbed(challenge)],
      components: buildChallengeButtons(challenge)
    });
    const reply = await interaction.fetchReply();
    await updateChallengeMessageId(challenge.id, reply.id);
  } catch (err) {
    const replyMethod = interaction.deferred || interaction.replied ? "followUp" : "reply";
    await interaction[replyMethod](ephemeralResponse({
      content: err.message
    }));
  }
}

async function handleTradeOfferModalSubmit(interaction, parts) {
  const ownerId = parts[1];

  if (interaction.user.id !== ownerId) {
    return interaction.reply(ephemeralResponse({
      content: "That trade form belongs to another trainer."
    }));
  }

  try {
    const player = await requireInteractionPlayer(interaction);
    if (!player) {
      return;
    }

    const targetText = interaction.fields.getTextInputValue("trainer");
    const proposerMonsterId = Number(interaction.fields.getTextInputValue("offered_monster_id"));
    const targetMonsterId = Number(interaction.fields.getTextInputValue("requested_monster_id"));

    if (!Number.isInteger(proposerMonsterId) || !Number.isInteger(targetMonsterId)) {
      throw new Error("Monster IDs must be numbers. Open Party or Storage to check the IDs.");
    }

    const targetUser = await resolveTargetUserFromText(interaction, targetText);
    if (!targetUser) {
      return interaction.reply(ephemeralResponse({
        content: "I could not find that trainer. Try a direct mention, user ID, exact username, or exact server display name."
      }));
    }

    if (targetUser.bot) {
      return interaction.reply(ephemeralResponse({
        content: "Trades need another human trainer, not a bot."
      }));
    }

    const trade = await createTradeOffer({
      proposerId: ownerId,
      proposerName: interaction.user.username,
      targetId: targetUser.id,
      targetName: targetUser.username,
      channelId: interaction.channel.id,
      proposerMonsterId,
      targetMonsterId
    });

    await interaction.reply({
      content: `${targetUser}, ${interaction.user.username} sent you a BitPals trade offer.`,
      embeds: [buildTradeOfferEmbed(trade)],
      components: buildTradeOfferButtons(trade)
    });
    const reply = await interaction.fetchReply();
    await setTradeMessageId(trade.id, reply.id);
  } catch (err) {
    const replyMethod = interaction.deferred || interaction.replied ? "followUp" : "reply";
    await interaction[replyMethod](ephemeralResponse({
      content: err.message
    }));
  }
}

async function handleShopInteraction(interaction, parts) {
  const ownerId = parts[1];
  const action = parts[2];
  const itemKey = parts[3];

  if (interaction.user.id !== ownerId) {
    return interaction.reply(ephemeralResponse({
      content: "That shop menu belongs to another trainer."
    }));
  }

  if (!["buy", "sell"].includes(action)) {
    return interaction.reply(ephemeralResponse({
      content: "Unknown shop action."
    }));
  }

  try {
    const result = action === "buy"
      ? await buyItem(ownerId, itemKey)
      : await sellItem(ownerId, itemKey);

    await interaction.update(withHubReturn({
      content: action === "buy"
        ? `Bought 1x ${result.item.name} for ${result.item.price} credits.`
        : `Sold 1x ${result.item.name} for ${result.totalValue} credits.`,
      embeds: [buildShopEmbed(result.player, result.inventory)],
      components: buildShopButtons(result.player, result.inventory)
    }, ownerId));
  } catch (err) {
    await interaction.reply(ephemeralResponse({
      content: err.message
    }));
  }
}

async function handlePartyInteraction(interaction, parts) {
  const ownerId = parts[1];
  const action = parts[2];
  const monsterId = Number(parts[3]);
  const slot = Number(parts[4]);
  const moveKey = parts[5];

  if (interaction.user.id !== ownerId) {
    return interaction.reply(ephemeralResponse({
      content: "That party board belongs to another trainer."
    }));
  }

  try {
    if (action === "back") {
      const party = await getParty(ownerId);
      const box = await getBox(ownerId);

      return interaction.update(buildPartyView(interaction.user.username, ownerId, party, box));
    }

    if (action === "switchslots") {
      await assertRosterUnlocked(ownerId);
      return interaction.showModal(buildPartySwitchModal(ownerId));
    }

    const monster = await getMonsterById(monsterId);
    if (!monster || monster.owner_id !== ownerId) {
      throw new Error("That monster could not be found in your roster.");
    }

    if (!isPartyMonster(monster)) {
      throw new Error("That monster is not currently in your active party.");
    }

    if (action === "view") {
      const party = await getParty(ownerId);
      return interaction.update(buildPartyMonsterView(interaction.user.username, ownerId, monster, party.length));
    }

    if (action === "nickname") {
      await assertRosterUnlocked(ownerId);
      return interaction.showModal(buildNicknameModal(ownerId, monster));
    }

    if (action === "resetname") {
      await assertRosterUnlocked(ownerId);
      const updatedMonster = await updateMonsterNickname(ownerId, monster.id, null);
      const party = await getParty(ownerId);
      return interaction.update(
        buildPartyMonsterView(
          interaction.user.username,
          ownerId,
          updatedMonster,
          party.length,
          `Nickname reset. This BitPal will display as ${updatedMonster.species}.`
        )
      );
    }

    if (action === "edit") {
      await assertRosterUnlocked(ownerId);
      return interaction.update(buildPartyMoveEditorView(interaction.user.username, ownerId, monster, slot));
    }

    if (action === "assign") {
      await assertRosterUnlocked(ownerId);
      const updatedMonster = await updateMonsterMoveSlot(ownerId, monster.id, slot, moveKey);
      const party = await getParty(ownerId);
      const move = getMove(moveKey);
      return interaction.update(
        buildPartyMonsterView(
          interaction.user.username,
          ownerId,
          updatedMonster,
          party.length,
          `Move slot ${slot} now uses ${move?.name || moveKey}.`
        )
      );
    }

    if (action === "deposit") {
      await assertRosterUnlocked(ownerId);
      const { party, box } = await depositPartyMonsterToBox(ownerId, monster.id);
      return interaction.update(
        buildStorageView(
          interaction.user.username,
          ownerId,
          party,
          box,
          0,
          `${monster.nickname} was sent to storage.`
        )
      );
    }

    if (action === "lead") {
      await assertRosterUnlocked(ownerId);

      if (monster.party_slot === 1) {
        return interaction.update(
          buildPartyMonsterView(
            interaction.user.username,
            ownerId,
            monster,
            (await getParty(ownerId)).length,
            `${monster.nickname} is already your lead BitPal.`
          )
        );
      }

      await setPartyLead(ownerId, monster.party_slot);
      const updatedParty = await getParty(ownerId);
      const updatedMonster = updatedParty.find(member => member.id === monster.id) || await getMonsterById(monster.id);

      return interaction.update(
        buildPartyMonsterView(
          interaction.user.username,
          ownerId,
          updatedMonster,
          updatedParty.length,
          `${updatedMonster.nickname} is now your lead BitPal in slot 1.`
        )
      );
    }

    throw new Error("Unknown party action.");
  } catch (err) {
    const replyMethod = interaction.deferred || interaction.replied ? "followUp" : "reply";
    await interaction[replyMethod](ephemeralResponse({
      content: err.message
    }));
  }
}

async function handleStorageInteraction(interaction, parts) {
  const ownerId = parts[1];
  const action = parts[2];
  const monsterId = Number(parts[3]);
  const slot = Number(parts[4]);
  const page = Number(parts[5] ?? parts[3]);

  if (interaction.user.id !== ownerId) {
    return interaction.reply(ephemeralResponse({
      content: "That storage board belongs to another trainer."
    }));
  }

  try {
    if (action === "page") {
      const party = await getParty(ownerId);
      const box = await getBox(ownerId);
      return interaction.update(buildStorageView(interaction.user.username, ownerId, party, box, monsterId));
    }

    const monster = await getMonsterById(monsterId);
    if (!monster || monster.owner_id !== ownerId) {
      throw new Error("That monster could not be found in your storage.");
    }

    if (!isStoredMonster(monster)) {
      throw new Error("That monster is already in your active party.");
    }

    if (action === "view") {
      const party = await getParty(ownerId);
      return interaction.update(buildStorageMonsterView(interaction.user.username, ownerId, monster, party, slot));
    }

    if (action === "withdraw") {
      if (!Number.isInteger(slot) || slot < 1 || slot > 6) {
        throw new Error("Choose a party slot between 1 and 6.");
      }

      await assertRosterUnlocked(ownerId);
      await moveBoxMonsterToParty(ownerId, monster.id, slot);
      const party = await getParty(ownerId);
      const box = await getBox(ownerId);

      return interaction.update(
        buildStorageView(
          interaction.user.username,
          ownerId,
          party,
          box,
          page,
          `${monster.nickname} moved into party slot ${slot}.`
        )
      );
    }

    throw new Error("Unknown storage action.");
  } catch (err) {
    const replyMethod = interaction.deferred || interaction.replied ? "followUp" : "reply";
    await interaction[replyMethod](ephemeralResponse({
      content: err.message
    }));
  }
}

async function handleGymInteraction(interaction, parts) {
  const ownerId = parts[1];
  const action = parts[2];
  const gymKey = parts[3];

  if (interaction.user.id !== ownerId) {
    return interaction.reply(ephemeralResponse({
      content: "That gym board belongs to another trainer."
    }));
  }

  if (action !== "challenge") {
    return interaction.reply(ephemeralResponse({
      content: "Unknown gym action."
    }));
  }

  try {
    const context = await startGymBattle(ownerId, gymKey);
    await replyWithBattleBoard(interaction, context, { privateReply: true, trackMessage: false });

    const player = await getPlayer(ownerId);
    const gym = getGym(gymKey);
    const area = getArea(gym.areaKey);
    await interaction.message.edit({
      embeds: [buildGymEmbed(player, gymKey, area)],
      components: buildGymButtons(ownerId, gymKey, hasBadge(player, gym.badgeName))
    }).catch(() => null);
  } catch (err) {
    await interaction.reply(ephemeralResponse({
      content: err.message
    }));
  }
}

async function handleChallengeInteraction(interaction, parts) {
  const challengeId = Number(parts[1]);
  const action = parts[2];

  const challenge = await getChallengeById(challengeId);
  if (!challenge || !challenge.active) {
    return interaction.reply(ephemeralResponse({
      content: "That trainer challenge is no longer active."
    }));
  }

  if (action === "cancel") {
    if (interaction.user.id !== challenge.challenger_id) {
      return interaction.reply(ephemeralResponse({
        content: "Only the challenger can cancel this trainer battle offer."
      }));
    }

    await closeChallenge(challengeId);
    return interaction.update({
      embeds: [buildChallengeEmbed(challenge)],
      components: buildChallengeButtons(challenge, true)
    });
  }

  if (action !== "accept") {
    return interaction.reply(ephemeralResponse({
      content: "Unknown trainer challenge action."
    }));
  }

  try {
    const context = await startTrainerBattleFromChallenge(challengeId, interaction.user.id, interaction.user.username);
    await interaction.update({
      embeds: [buildChallengeEmbed(challenge)],
      components: buildChallengeButtons(challenge, true)
    });

    const reply = await interaction.followUp(buildBattleView(context));
    await setBattleMessageInfo(context.battle.id, reply.channelId, reply.id);
  } catch (err) {
    await interaction.reply(ephemeralResponse({
      content: err.message
    }));
  }
}

async function handleStarterInteraction(interaction, parts) {
  const ownerId = parts[1];
  const action = parts[2];
  const starterInput = parts[3];

  if (interaction.user.id !== ownerId) {
    return interaction.reply(ephemeralResponse({
      content: "That starter choice belongs to another trainer. Run `!start` to choose your own starter."
    }));
  }

  if (action !== "choose") {
    return interaction.reply(ephemeralResponse({
      content: "Unknown starter action."
    }));
  }

  const starterSpecies = getStarterSpecies(starterInput);
  if (!starterSpecies) {
    return interaction.reply(ephemeralResponse({
      content: "Choose Flameling, Squirtie, or Leafy as your starter."
    }));
  }

  try {
    const result = await claimStarter(ownerId, starterSpecies);
    return interaction.update(buildStarterClaimedView(interaction.user.username, result, ownerId));
  } catch (err) {
    return interaction.reply(ephemeralResponse({
      content: err.message
    }));
  }
}

async function handleNicknameModalSubmit(interaction, parts) {
  const ownerId = parts[1];
  const monsterId = Number(parts[2]);

  if (interaction.user.id !== ownerId) {
    return interaction.reply(ephemeralResponse({
      content: "That nickname form belongs to another trainer."
    }));
  }

  try {
    await assertRosterUnlocked(ownerId);

    const monster = await getMonsterById(monsterId);
    if (!monster || monster.owner_id !== ownerId || !isPartyMonster(monster)) {
      throw new Error("That monster could not be found in your active party.");
    }

    const nickname = interaction.fields.getTextInputValue("nickname");
    const updatedMonster = await updateMonsterNickname(ownerId, monster.id, nickname);
    const party = await getParty(ownerId);
    const notice = updatedMonster.hasCustomNickname
      ? `Nickname changed to ${updatedMonster.customNickname}.`
      : `Nickname reset. This BitPal will display as ${updatedMonster.species}.`;

    return interaction.update(
      buildPartyMonsterView(
        interaction.user.username,
        ownerId,
        updatedMonster,
        party.length,
        notice
      )
    );
  } catch (err) {
    const replyMethod = interaction.deferred || interaction.replied ? "followUp" : "reply";
    await interaction[replyMethod](ephemeralResponse({
      content: err.message
    }));
  }
}

async function handlePartySwitchModalSubmit(interaction, parts) {
  const ownerId = parts[1];

  if (interaction.user.id !== ownerId) {
    return interaction.reply(ephemeralResponse({
      content: "That party switch form belongs to another trainer."
    }));
  }

  try {
    await assertRosterUnlocked(ownerId);

    const fromSlot = Number(interaction.fields.getTextInputValue("from_slot"));
    const toSlot = Number(interaction.fields.getTextInputValue("to_slot"));

    if (!Number.isInteger(fromSlot) || !Number.isInteger(toSlot) || fromSlot < 1 || fromSlot > 6 || toSlot < 1 || toSlot > 6) {
      throw new Error("Party slots must be numbers from 1 to 6.");
    }

    if (fromSlot === toSlot) {
      throw new Error("Choose two different party slots to switch.");
    }

    await swapPartySlots(ownerId, fromSlot, toSlot);
    const party = await getParty(ownerId);
    const box = await getBox(ownerId);

    return interaction.update(
      buildPartyView(
        interaction.user.username,
        ownerId,
        party,
        box
      )
    );
  } catch (err) {
    const replyMethod = interaction.deferred || interaction.replied ? "followUp" : "reply";
    await interaction[replyMethod](ephemeralResponse({
      content: err.message
    }));
  }
}

async function handleAccountResetInteraction(interaction, parts) {
  const requestId = Number(parts[1]);
  const action = parts[2];
  const token = parts[3];
  const request = await getAccountResetRequest(requestId);

  if (!request || request.token !== token) {
    return interaction.reply(ephemeralResponse({
      content: "That reset request is no longer valid."
    }));
  }

  if (request.target_id !== interaction.user.id) {
    return interaction.reply(ephemeralResponse({
      content: "Only the trainer named in this reset request can confirm or cancel it."
    }));
  }

  if (request.status !== "pending") {
    return interaction.update(buildAccountResetResolvedView(request.status));
  }

  if (new Date(request.expires_at).getTime() <= Date.now()) {
    await setAccountResetStatus(request.id, "expired");
    return interaction.update(buildAccountResetResolvedView("expired"));
  }

  if (action === "cancel") {
    await setAccountResetStatus(request.id, "cancelled");
    return interaction.update(buildAccountResetResolvedView("cancelled"));
  }

  if (action !== "confirm") {
    return interaction.reply(ephemeralResponse({
      content: "Unknown reset action."
    }));
  }

  await resetPlayerAccount(request.id, token, interaction.user.id);
  return interaction.update(buildAccountResetResolvedView("confirmed"));
}

async function handleInteraction(interaction) {
  if (interaction.isModalSubmit()) {
    if (!await ensureConfiguredInteractionChannel(interaction)) {
      return;
    }

    const parts = interaction.customId.split(":");
    const domain = parts[0];

    if (domain === "nickname") {
      return handleNicknameModalSubmit(interaction, parts);
    }

    if (domain === "party_switch") {
      return handlePartySwitchModalSubmit(interaction, parts);
    }

    if (domain === "challenge_direct") {
      return handleDirectChallengeModalSubmit(interaction, parts);
    }

    if (domain === "trade_offer") {
      return handleTradeOfferModalSubmit(interaction, parts);
    }

    return;
  }

  if (!interaction.isButton()) {
    return;
  }

  const parts = interaction.customId.split(":");
  const domain = parts[0];

  if (domain === "account_reset") {
    return handleAccountResetInteraction(interaction, parts);
  }

  if (!await ensureConfiguredInteractionChannel(interaction)) {
    return;
  }

  if (domain === "battle") {
    return handleBattleInteraction(interaction, parts);
  }

  if (domain === "pvp") {
    return handlePvpInteraction(interaction, parts);
  }

  if (domain === "launch") {
    return handleLaunchInteraction(interaction, parts);
  }

  if (domain === "hub") {
    return handleHubInteraction(interaction, parts);
  }

  if (domain === "travel") {
    return handleTravelInteraction(interaction, parts);
  }

  if (domain === "trade") {
    return handleTradeInteraction(interaction, parts);
  }

  if (domain === "shop") {
    return handleShopInteraction(interaction, parts);
  }

  if (domain === "starter") {
    return handleStarterInteraction(interaction, parts);
  }

  if (domain === "party") {
    return handlePartyInteraction(interaction, parts);
  }

  if (domain === "storage") {
    return handleStorageInteraction(interaction, parts);
  }

  if (domain === "gym") {
    return handleGymInteraction(interaction, parts);
  }

  if (domain === "challenge") {
    return handleChallengeInteraction(interaction, parts);
  }
}

module.exports = { handleInteraction };
