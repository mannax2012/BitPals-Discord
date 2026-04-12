const db = require("../../database/db");
const { calculateDamage, getActiveBattle, setBattleMessageInfo } = require("./battleSystem");
const { closeChallenge, createChallenge, getChallengeById, getLatestJoinableChallenge, setChallengeMessageId } = require("./challengeSystem");
const { canAccessItem, getItem, getItemUnlockText, getMove } = require("./gameData");
const { getInventory, getItemQuantity, removeItem } = require("./inventorySystem");
const { getFirstHealthyPartyMonster, getMonsterById, getParty, setMonsterHp } = require("./monsterSystem");
const { adjustMoney, getPlayer } = require("./playerSystem");
const { applyRewardMultiplier, getPvpRewardProfile, summarizeRewardProfile } = require("./rewardSystem");

function parseState(battle) {
  return JSON.parse(battle.battle_state || "{}");
}

async function getTrainerBattleById(battleId) {
  const [rows] = await db.query("SELECT * FROM battles WHERE id = ? AND battle_type = 'trainer_pvp'", [battleId]);
  return rows[0] || null;
}

function ensureParticipantList(side, monsterId) {
  side.participantMonsterIds = side.participantMonsterIds || [];
  if (!side.participantMonsterIds.includes(monsterId)) {
    side.participantMonsterIds.push(monsterId);
  }
}

function trimLog(log = []) {
  return log.slice(-8);
}

function addLog(state, ...lines) {
  state.log = trimLog([...(state.log || []), ...lines]);
}

function resetPlayback(state) {
  state.turnPlayback = [];
}

function addPlayback(state, title, detail = null, effects = {}) {
  state.turnPlayback = state.turnPlayback || [];
  state.turnPlayback.push({
    title,
    detail,
    ...effects
  });
}

function monsterHpChange(monster, beforeHp, afterHp) {
  return {
    target: "monster",
    monsterId: monster.id,
    beforeHp,
    afterHp
  };
}

function activeMonsterChange(playerId, monsterId) {
  return {
    target: "pvpActive",
    playerId,
    monsterId
  };
}

function formatHpChange(label, beforeHp, afterHp, maxHp) {
  const delta = afterHp - beforeHp;
  const deltaText = delta < 0
    ? `${delta} HP`
    : delta > 0
      ? `+${delta} HP`
      : "no HP change";

  return `${label} HP: ${beforeHp}/${maxHp} -> ${afterHp}/${maxHp} (${deltaText})`;
}

function getOtherPlayerId(state, playerId) {
  return state.playerOrder.find(id => id !== playerId);
}

async function saveTrainerBattleState(battleId, state, active = true) {
  await db.query(
    `
      UPDATE battles
      SET battle_state = ?, active = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [JSON.stringify(state), active ? 1 : 0, battleId]
  );
}

async function buildTrainerBattleContext(battleId) {
  const battle = await getTrainerBattleById(battleId);
  if (!battle) {
    return null;
  }

  const state = parseState(battle);
  const participants = [];

  for (const playerId of state.playerOrder) {
    const player = await getPlayer(playerId);
    const party = await getParty(playerId);
    const inventory = await getInventory(playerId);
    const side = state.players[playerId];
    const activeMonster = party.find(monster => monster.id === side.activeMonsterId) || party[0] || null;

    participants.push({
      id: playerId,
      name: side.name || player?.id || playerId,
      player,
      party,
      inventory,
      side,
      activeMonster
    });
  }

  return {
    battle,
    state,
    participants,
    byId: Object.fromEntries(participants.map(participant => [participant.id, participant])),
    title: `${state.players[battle.player_id].name} vs ${state.players[battle.opponent_player_id].name}`,
    isPvp: true
  };
}

async function createTrainerChallengeFlow({ challengerId, challengerName, opponentId = null, opponentName = null, channelId }) {
  if (await getActiveBattle(challengerId)) {
    throw new Error("Finish your active battle before issuing a trainer challenge.");
  }

  const challengeType = opponentId ? "targeted" : "open";
  return createChallenge({
    challengerId,
    challengerName,
    opponentId,
    opponentName,
    channelId,
    challengeType
  });
}

function buildInitialTrainerState({ challengerId, challengerName, opponentId, opponentName, challengerLead, opponentLead }) {
  return {
    playerOrder: [challengerId, opponentId],
    turnNumber: 1,
    phase: "selection",
    log: [`${challengerName} challenged ${opponentName} to a trainer battle!`],
    players: {
      [challengerId]: {
        name: challengerName,
        activeMonsterId: challengerLead.id,
        participantMonsterIds: [challengerLead.id],
        forceSwitch: false,
        selectedAction: null
      },
      [opponentId]: {
        name: opponentName,
        activeMonsterId: opponentLead.id,
        participantMonsterIds: [opponentLead.id],
        forceSwitch: false,
        selectedAction: null
      }
    }
  };
}

async function startTrainerBattleFromChallenge(challengeId, accepterId, accepterName) {
  const challenge = await getChallengeById(challengeId);

  if (!challenge || !challenge.active) {
    throw new Error("That trainer challenge is no longer available.");
  }

  if (challenge.challenger_id === accepterId) {
    throw new Error("You cannot accept your own trainer challenge.");
  }

  if (challenge.opponent_id && challenge.opponent_id !== accepterId) {
    throw new Error("That challenge was aimed at another trainer.");
  }

  if (await getActiveBattle(challenge.challenger_id)) {
    throw new Error("The challenger is already in another battle.");
  }

  if (await getActiveBattle(accepterId)) {
    throw new Error("You are already in another battle.");
  }

  const challengerLead = await getFirstHealthyPartyMonster(challenge.challenger_id);
  const accepterLead = await getFirstHealthyPartyMonster(accepterId);

  if (!challengerLead) {
    throw new Error("The challenger does not have a healthy lead monster.");
  }

  if (!accepterLead) {
    throw new Error("You do not have a healthy lead monster.");
  }

  const state = buildInitialTrainerState({
    challengerId: challenge.challenger_id,
    challengerName: challenge.challenger_name || "Trainer",
    opponentId: accepterId,
    opponentName: accepterName,
    challengerLead,
    opponentLead: accepterLead
  });

  const [result] = await db.query(
    `
      INSERT INTO battles (player_id, opponent_player_id, battle_type, battle_state, active)
      VALUES (?, ?, 'trainer_pvp', ?, 1)
    `,
    [challenge.challenger_id, accepterId, JSON.stringify(state)]
  );

  await closeChallenge(challenge.id);
  return buildTrainerBattleContext(result.insertId);
}

async function updateChallengeMessageId(challengeId, messageId) {
  return setChallengeMessageId(challengeId, messageId);
}

function getActionPriority(action, activeMonster) {
  if (action.type === "switch") {
    return 300;
  }

  if (action.type === "item") {
    return 200;
  }

  const move = activeMonster.moves.find(entry => entry.key === action.value);
  return 100 + (move?.priority || 0);
}

async function getLivingParty(playerId) {
  const party = await getParty(playerId);
  return party.filter(monster => monster.current_hp > 0);
}

async function resolveTrainerBattleEnd(battle, state, winnerId) {
  const loserId = getOtherPlayerId(state, winnerId);
  const winnerSide = state.players[winnerId];
  const loserSide = state.players[loserId];
  const winnerName = winnerSide.name;
  const loserName = loserSide.name;
  const loserParty = await getParty(loserId);
  const highestLoserLevel = Math.max(...loserParty.map(monster => monster.level), 5);
  const loserPlayer = await getPlayer(loserId);
  const loserPenalty = Math.min(loserPlayer?.money || 0, 150);
  const winnerRewardProfile = getPvpRewardProfile("winner");
  const loserRewardProfile = getPvpRewardProfile("loser");
  const baseWinnerMoney = 350 + (highestLoserLevel * 30) + (loserParty.length * 75);
  const winnerMoney = applyRewardMultiplier(baseWinnerMoney, winnerRewardProfile.moneyMultiplier, 300);
  const rewardSummary = {
    kind: "pvp",
    battleType: battle.battle_type,
    winnerId,
    loserId,
    winnerName,
    loserName,
    players: [
      {
        playerId: winnerId,
        name: winnerName,
        result: "winner",
        rewardProfile: summarizeRewardProfile(winnerRewardProfile),
        moneyDelta: winnerMoney,
        items: [],
        experience: []
      },
      {
        playerId: loserId,
        name: loserName,
        result: "loser",
        rewardProfile: summarizeRewardProfile(loserRewardProfile),
        moneyDelta: loserPenalty > 0 ? -loserPenalty : 0,
        items: [],
        experience: []
      }
    ]
  };

  addLog(state, `${winnerName} defeated ${loserName}!`);
  addPlayback(state, `${winnerName} wins the trainer battle!`, `${loserName} has no healthy monsters left.`);
  await adjustMoney(winnerId, winnerMoney);
  if (loserPenalty > 0) {
    await adjustMoney(loserId, -loserPenalty);
  }

  state.rewardSummary = rewardSummary;
  state.phase = "ended";
  state.players[winnerId].selectedAction = null;
  state.players[loserId].selectedAction = null;
  await saveTrainerBattleState(battle.id, state, false);
}

async function maybeEndTrainerBattle(battle, state) {
  for (const playerId of state.playerOrder) {
    const livingParty = await getLivingParty(playerId);
    if (livingParty.length === 0) {
      const winnerId = getOtherPlayerId(state, playerId);
      await resolveTrainerBattleEnd(battle, state, winnerId);
      return true;
    }
  }

  return false;
}

async function performSwitch(state, playerId, monsterId) {
  const side = state.players[playerId];
  const monster = await getMonsterById(monsterId);

  side.activeMonsterId = monster.id;
  side.forceSwitch = false;
  side.selectedAction = null;
  ensureParticipantList(side, monster.id);
  addLog(state, `${side.name} sent out ${monster.nickname}!`);
  addPlayback(state, `${side.name} switched monsters!`, `${monster.nickname} entered from party slot ${monster.party_slot}.`, {
    activeChanges: [activeMonsterChange(playerId, monster.id)]
  });
}

async function performItem(state, playerId, itemKey) {
  const side = state.players[playerId];
  const item = getItem(itemKey);
  const activeMonster = await getMonsterById(side.activeMonsterId);

  await removeItem(playerId, item.key, 1);
  const beforeHp = activeMonster.current_hp;
  const healed = await setMonsterHp(activeMonster.id, activeMonster.current_hp + item.healAmount);
  addLog(state, `${side.name} used ${item.name} on ${healed.nickname}.`);
  addPlayback(
    state,
    `${side.name} used ${item.name}!`,
    `${healed.nickname} recovered HP. ${formatHpChange(healed.nickname, beforeHp, healed.current_hp, healed.max_hp)}`,
    {
      hpChanges: [monsterHpChange(healed, beforeHp, healed.current_hp)]
    }
  );
}

async function performMove(state, playerId, moveKey) {
  const side = state.players[playerId];
  const opponentId = getOtherPlayerId(state, playerId);
  const opponentSide = state.players[opponentId];
  const attacker = await getMonsterById(side.activeMonsterId);
  const defender = await getMonsterById(opponentSide.activeMonsterId);

  if (!attacker || attacker.current_hp <= 0 || !defender || defender.current_hp <= 0) {
    return;
  }

  const move = attacker.moves.find(entry => entry.key === moveKey);
  if (!move) {
    throw new Error("That move is not available.");
  }

  const result = calculateDamage(attacker, defender, move);
  const beforeHp = defender.current_hp;
  const updatedDefender = await setMonsterHp(defender.id, defender.current_hp - result.damage);
  const typeText = result.effectiveness > 1
    ? " It's super effective!"
    : result.effectiveness < 1
      ? " It's not very effective."
      : "";

  addLog(state, `${attacker.nickname} used ${move.name} for ${result.damage} damage.${typeText}`);
  addPlayback(state, `${attacker.nickname} used ${move.name}!`);
  addPlayback(
    state,
    `${updatedDefender.nickname} took ${result.damage} damage!`,
    `${formatHpChange(updatedDefender.nickname, beforeHp, updatedDefender.current_hp, updatedDefender.max_hp)}${typeText}`,
    {
      hpChanges: [monsterHpChange(updatedDefender, beforeHp, updatedDefender.current_hp)]
    }
  );

  if (updatedDefender.current_hp <= 0) {
    addLog(state, `${updatedDefender.nickname} fainted!`);
    addPlayback(state, `${updatedDefender.nickname} fainted!`);
    const livingParty = await getLivingParty(opponentId);
    opponentSide.forceSwitch = livingParty.length > 0;
  }
}

async function resolveTurn(battle, state) {
  resetPlayback(state);
  const order = [];

  for (const playerId of state.playerOrder) {
    const side = state.players[playerId];
    const activeMonster = await getMonsterById(side.activeMonsterId);
    order.push({
      playerId,
      action: side.selectedAction,
      activeMonster,
      priority: getActionPriority(side.selectedAction, activeMonster)
    });
  }

  order.sort((left, right) => {
    if (right.priority !== left.priority) {
      return right.priority - left.priority;
    }

    if ((right.activeMonster?.speed || 0) !== (left.activeMonster?.speed || 0)) {
      return (right.activeMonster?.speed || 0) - (left.activeMonster?.speed || 0);
    }

    return state.playerOrder.indexOf(left.playerId) - state.playerOrder.indexOf(right.playerId);
  });

  for (const step of order) {
    const side = state.players[step.playerId];
    if (!side.selectedAction) {
      continue;
    }

    if (side.selectedAction.type === "switch") {
      await performSwitch(state, step.playerId, side.selectedAction.value);
    } else if (side.selectedAction.type === "item") {
      await performItem(state, step.playerId, side.selectedAction.value);
    } else if (side.selectedAction.type === "move") {
      await performMove(state, step.playerId, side.selectedAction.value);
    }

    if (await maybeEndTrainerBattle(battle, state)) {
      return;
    }
  }

  for (const playerId of state.playerOrder) {
    state.players[playerId].selectedAction = null;
  }

  state.turnNumber += 1;
  state.phase = "selection";
  await saveTrainerBattleState(battle.id, state, true);
}

async function lockTrainerAction(playerId, battleId, actionType, value) {
  const battle = await getTrainerBattleById(battleId);
  if (!battle || !battle.active) {
    throw new Error("That trainer battle is no longer active.");
  }

  const state = parseState(battle);
  const side = state.players[playerId];
  if (!side) {
    throw new Error("You are not part of that trainer battle.");
  }

  const party = await getParty(playerId);
  const activeMonster = party.find(monster => monster.id === side.activeMonsterId) || party[0];

  if (!activeMonster) {
    throw new Error("You do not have a valid active monster.");
  }

  if (side.forceSwitch && actionType !== "switch") {
    throw new Error("Your active monster fainted. You must switch first.");
  }

  if (actionType === "move") {
    const move = activeMonster.moves.find(entry => entry.key === value);
    if (!move) {
      throw new Error("That move is not available.");
    }
  } else if (actionType === "item") {
    const item = getItem(value);
    if (!item || item.battleUsage !== "heal") {
      throw new Error("Only healing items can be used in trainer battles.");
    }

    const player = await getPlayer(playerId);
    if (!canAccessItem(player, item)) {
      throw new Error(`${item.name} is locked. ${getItemUnlockText(item)}.`);
    }

    if ((await getItemQuantity(playerId, item.key)) < 1) {
      throw new Error(`You do not have any ${item.name}s left.`);
    }
  } else if (actionType === "switch") {
    const targetMonster = party.find(monster => monster.id === Number(value));
    if (!targetMonster || targetMonster.current_hp <= 0) {
      throw new Error("That monster cannot switch in right now.");
    }
  } else {
    throw new Error("Unknown trainer action.");
  }

  side.selectedAction = {
    type: actionType,
    value: actionType === "switch" ? Number(value) : value
  };
  state.phase = "selection";

  const otherSide = state.players[getOtherPlayerId(state, playerId)];
  if (otherSide.selectedAction) {
    await resolveTurn(battle, state);
    return {
      context: await buildTrainerBattleContext(battle.id),
      resolved: true
    };
  }

  await saveTrainerBattleState(battle.id, state, true);
  return {
    context: await buildTrainerBattleContext(battle.id),
    resolved: false
  };
}

async function getActionMenuContext(playerId, battleId) {
  const context = await buildTrainerBattleContext(battleId);
  if (!context) {
    return null;
  }

  if (!context.byId[playerId]) {
    throw new Error("You are not part of that trainer battle.");
  }

  return context;
}

module.exports = {
  buildTrainerBattleContext,
  createTrainerChallengeFlow,
  getActionMenuContext,
  getLatestJoinableChallenge,
  getTrainerBattleById,
  lockTrainerAction,
  setBattleMessageInfo,
  startTrainerBattleFromChallenge,
  updateChallengeMessageId
};
