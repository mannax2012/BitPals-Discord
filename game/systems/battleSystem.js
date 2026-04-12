const db = require("../../database/db");
const { addItem, getInventory, getItemQuantity, removeItem } = require("./inventorySystem");
const {
  canAccessArea,
  canAccessItem,
  getArea,
  getDefaultArea,
  getGym,
  getItem,
  getItemUnlockText,
  getMove,
  getMovesForSpecies,
  getSpecies,
  getTypeMultiplier,
  randomLevel,
  rollEncounter,
  rollTrainerEncounter
} = require("./gameData");
const {
  awardTraining,
  awardExperience,
  buildMonsterIdentity,
  calculateStats,
  captureMonster,
  getFirstHealthyPartyMonster,
  getTrainingYieldForParty,
  getMonsterById,
  getParty,
  healParty,
  setMonsterHp
} = require("./monsterSystem");
const { addBadge, adjustMoney, getPlayer, hasBadge } = require("./playerSystem");
const {
  applyRewardMultiplier,
  getSingleBattleRewardProfile,
  summarizeRewardProfile
} = require("./rewardSystem");

function buildEnemyMonster(speciesName, level) {
  const species = getSpecies(speciesName);
  const identity = buildMonsterIdentity();
  const stats = calculateStats(speciesName, level, {
    personalityKey: identity.personality.key
  });

  return {
    species: speciesName,
    nickname: speciesName,
    level,
    currentHp: stats.max_hp,
    maxHp: stats.max_hp,
    attack: stats.attack,
    defense: stats.defense,
    speed: stats.speed,
    gender: identity.gender,
    personalityKey: identity.personality.key,
    personalityName: identity.personality.name,
    moves: getMovesForSpecies(speciesName, level).map(move => move.key),
    types: species.types,
    catchRate: species.catchRate,
    baseExp: species.baseExp
  };
}

function parseBattleState(battle) {
  if (!battle?.battle_state) {
    return null;
  }

  return JSON.parse(battle.battle_state);
}

function trimLog(log = []) {
  return log.slice(-6);
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

function playerHpChange(monster, beforeHp, afterHp) {
  return {
    target: "player",
    monsterId: monster.id,
    beforeHp,
    afterHp
  };
}

function enemyHpChange(enemyIndex, beforeHp, afterHp) {
  return {
    target: "enemy",
    enemyIndex,
    beforeHp,
    afterHp
  };
}

function playerActiveChange(monsterId) {
  return {
    target: "playerActive",
    monsterId
  };
}

function enemyActiveChange(enemyIndex) {
  return {
    target: "enemyActive",
    enemyIndex
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

function getHighestEnemyLevel(state) {
  return Math.max(...state.enemyParty.map(monster => monster.level), 1);
}

function getBaseExperienceReward(state) {
  const highestEnemyLevel = getHighestEnemyLevel(state);
  return Math.max(20, Math.floor((highestEnemyLevel * 18) + (state.enemyParty.length * 12)));
}

function summarizeExperienceReward(result) {
  return {
    monsterId: result.monster.id,
    nickname: result.monster.nickname,
    customNickname: result.monster.customNickname || null,
    hasCustomNickname: Boolean(result.monster.hasCustomNickname),
    species: result.monster.species,
    types: result.monster.types,
    experienceGain: result.experienceGain,
    oldLevel: result.oldLevel,
    newLevel: result.newLevel,
    gainedLevels: result.gainedLevels,
    oldStats: result.oldStats,
    newStats: result.newStats,
    statGains: result.statGains,
    evolution: result.evolution || null,
    learnedMoves: result.learnedMoves,
    moveSetChanges: result.moveSetChanges,
    trainingApplied: result.trainingApplied || null
  };
}

function mergeLootDrops(drops) {
  const merged = new Map();

  for (const drop of drops) {
    merged.set(drop.key, (merged.get(drop.key) || 0) + drop.quantity);
  }

  return Array.from(merged.entries()).map(([key, quantity]) => {
    const item = getItem(key);
    return {
      key,
      name: item?.name || key,
      quantity
    };
  });
}

function getLootTier(highestLevel) {
  if (highestLevel >= 39) {
    return { heal: "mega_potion", orb: "apex_orb" };
  }

  if (highestLevel >= 25) {
    return { heal: "hyper_potion", orb: "prime_orb" };
  }

  if (highestLevel >= 15) {
    return { heal: "super_potion", orb: "adept_orb" };
  }

  return { heal: "potion", orb: "capture_orb" };
}

function rollBattleLoot(battleType, highestLevel) {
  const drops = [];
  const tier = getLootTier(highestLevel);

  if (battleType === "gym") {
    drops.push({ key: tier.heal, quantity: 1 });
    drops.push({ key: tier.orb, quantity: 2 });
    return mergeLootDrops(drops);
  }

  const primaryRoll = Math.random();

  if (battleType === "trainer_npc") {
    if (primaryRoll < 0.45) {
      drops.push({ key: tier.heal, quantity: 1 });
    } else if (primaryRoll < 0.75) {
      drops.push({ key: tier.orb, quantity: 1 });
    } else if (primaryRoll < 0.92 || highestLevel >= 8) {
      drops.push({ key: tier.heal, quantity: 1 });
    }
  } else if (battleType === "wild") {
    if (primaryRoll < 0.35) {
      drops.push({ key: tier.heal, quantity: 1 });
    } else if (primaryRoll < 0.58) {
      drops.push({ key: tier.orb, quantity: 1 });
    } else if (primaryRoll < 0.66 && highestLevel >= 6) {
      drops.push({ key: tier.heal, quantity: 1 });
    }
  }

  if (drops.length > 0 && Math.random() < (highestLevel >= 7 ? 0.18 : 0.08)) {
    drops.push({ key: tier.orb, quantity: 1 });
  }

  return mergeLootDrops(drops);
}

function getAccessibleDrop(player, drop) {
  if (canAccessItem(player, drop.key)) {
    return drop;
  }

  const item = getItem(drop.key);
  if (item?.battleUsage === "heal") {
    return { ...drop, key: "potion" };
  }

  if (item?.battleUsage === "capture") {
    return { ...drop, key: "capture_orb" };
  }

  return null;
}

async function grantBattleLoot(playerId, battleType, highestLevel) {
  const player = await getPlayer(playerId);
  const drops = mergeLootDrops(
    rollBattleLoot(battleType, highestLevel)
      .map(drop => getAccessibleDrop(player, drop))
      .filter(Boolean)
  );

  for (const drop of drops) {
    await addItem(playerId, drop.key, drop.quantity);
  }

  return drops;
}

function chooseEnemyMove(enemyMonster) {
  const moveKeys = enemyMonster.moves.length > 0 ? enemyMonster.moves : ["tackle"];
  const moveKey = moveKeys[Math.floor(Math.random() * moveKeys.length)];
  return getMove(moveKey);
}

function calculateDamage(attacker, defender, move) {
  const baseDamage = ((((2 * attacker.level) / 5) + 2) * move.power * (attacker.attack / Math.max(1, defender.defense))) / 50 + 2;
  const stab = attacker.types.includes(move.type) ? 1.2 : 1;
  const effectiveness = getTypeMultiplier(move.type, defender.types);
  const variance = 0.92 + (Math.random() * 0.16);

  return {
    damage: Math.max(1, Math.floor(baseDamage * stab * effectiveness * variance)),
    effectiveness
  };
}

function hasLivingEnemy(state) {
  return state.enemyParty.some(monster => monster.currentHp > 0);
}

function findNextLivingEnemyIndex(state) {
  return state.enemyParty.findIndex(monster => monster.currentHp > 0);
}

function sendNextEnemyIfAvailable(state) {
  const nextEnemyIndex = findNextLivingEnemyIndex(state);
  if (nextEnemyIndex < 0) {
    return false;
  }

  state.enemyActiveIndex = nextEnemyIndex;
  state.currentMenu = "main";
  addLog(state, `${state.enemyParty[nextEnemyIndex].species} enters the battle!`);
  addPlayback(state, `${state.enemyParty[nextEnemyIndex].species} enters the battle!`, null, {
    activeChanges: [enemyActiveChange(nextEnemyIndex)]
  });
  return true;
}

function getBattleTitle(battle, state) {
  if (battle.battle_type === "gym") {
    return `${state.gymName} - ${state.gymLeader}`;
  }

  if (battle.battle_type === "trainer_npc") {
    return `${state.trainerName} - Trainer Battle`;
  }

  return `Wild Battle - ${state.area}`;
}

function isFinishedBattleState(state) {
  if (!state) {
    return false;
  }

  if (state.currentMenu === "ended" || state.phase === "ended" || state.rewardSummary) {
    return true;
  }

  if (Array.isArray(state.enemyParty) && state.enemyParty.length > 0) {
    return state.enemyParty.every(monster => monster.currentHp <= 0);
  }

  return false;
}

function isOpeningBattleState(state) {
  if (!state || state.currentMenu !== "main" || state.forceSwitch) {
    return false;
  }

  const hasOnlyOpeningLog = !Array.isArray(state.log) || state.log.length <= 1;
  const enemiesUntouched = Array.isArray(state.enemyParty)
    && state.enemyParty.length > 0
    && state.enemyParty.every(monster => monster.currentHp === monster.maxHp);

  return hasOnlyOpeningLog && enemiesUntouched && !state.rewardSummary;
}

async function hasNewerFinishedBattle(playerId, activeBattleCreatedAt) {
  const [rows] = await db.query(
    `
      SELECT battle_state
      FROM battles
      WHERE active = 0
        AND (player_id = ? OR opponent_player_id = ?)
        AND updated_at > ?
      ORDER BY updated_at DESC
      LIMIT 5
    `,
    [playerId, playerId, activeBattleCreatedAt]
  );

  return rows.some(row => isFinishedBattleState(parseBattleState(row)));
}

async function getActiveBattle(playerId) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM battles
      WHERE active = 1 AND (player_id = ? OR opponent_player_id = ?)
      ORDER BY id DESC
    `,
    [playerId, playerId]
  );

  for (const row of rows) {
    const state = parseBattleState(row);
    if (isFinishedBattleState(state)) {
      await saveBattleState(row.id, state, false);
      continue;
    }

    if (isOpeningBattleState(state) && await hasNewerFinishedBattle(playerId, row.created_at)) {
      await saveBattleState(row.id, state, false);
      continue;
    }

    return row;
  }

  return null;
}

async function getBattleById(battleId) {
  const [rows] = await db.query("SELECT * FROM battles WHERE id = ?", [battleId]);
  return rows[0] || null;
}

async function saveBattleState(battleId, state, active = true) {
  const enemyIndex = state.enemyActiveIndex ?? findNextLivingEnemyIndex(state);
  const enemy = enemyIndex >= 0 ? state.enemyParty[enemyIndex] : null;

  await db.query(
    `
      UPDATE battles
      SET battle_state = ?, enemy_species = ?, enemy_hp = ?, active = ?, updated_at = NOW()
      WHERE id = ?
    `,
    [
      JSON.stringify(state),
      enemy?.species || null,
      enemy?.currentHp ?? null,
      active ? 1 : 0,
      battleId
    ]
  );
}

async function setBattleMessageInfo(battleId, channelId, messageId) {
  await db.query(
    "UPDATE battles SET channel_id = ?, message_id = ?, updated_at = NOW() WHERE id = ?",
    [channelId, messageId, battleId]
  );
}

function createActionLockToken() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function acquireBattleActionLock(battleId) {
  const token = createActionLockToken();
  const [result] = await db.query(
    `
      UPDATE battles
      SET action_lock_token = ?, action_lock_expires_at = DATE_ADD(NOW(), INTERVAL 45 SECOND), updated_at = NOW()
      WHERE id = ?
        AND active = 1
        AND (action_lock_token IS NULL OR action_lock_expires_at IS NULL OR action_lock_expires_at < NOW())
    `,
    [token, battleId]
  );

  return result.affectedRows > 0 ? token : null;
}

async function releaseBattleActionLock(battleId, token, { advanceVersion = true } = {}) {
  if (!token) {
    return null;
  }

  await db.query(
    `
      UPDATE battles
      SET action_lock_token = NULL,
          action_lock_expires_at = NULL,
          action_version = action_version + ?,
          updated_at = NOW()
      WHERE id = ? AND action_lock_token = ?
    `,
    [advanceVersion ? 1 : 0, battleId, token]
  );

  return getBattleContextById(battleId);
}

async function withPlayerBattleStartLock(playerId, callback) {
  const connection = await db.getPool().getConnection();
  const lockName = `bitpals:battle-start:${playerId}`.slice(0, 64);
  let acquired = false;

  try {
    const [rows] = await connection.query("SELECT GET_LOCK(?, 5) AS acquired", [lockName]);
    acquired = rows[0]?.acquired === 1;

    if (!acquired) {
      throw new Error("Your battle state is already updating. Try again in a moment.");
    }

    return await callback();
  } finally {
    if (acquired) {
      await connection.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => null);
    }

    connection.release();
  }
}

function decorateEnemy(enemyMonster) {
  return {
    ...enemyMonster,
    moves: enemyMonster.moves.map(moveKey => getMove(moveKey)).filter(Boolean)
  };
}

async function ensureHealthyActiveMonster(battle, state, party) {
  const activeMonster = party.find(monster => monster.id === state.playerActiveMonsterId) || null;
  if (activeMonster?.current_hp > 0) {
    return activeMonster;
  }

  if (!battle.active) {
    return activeMonster || party[0] || null;
  }

  const nextHealthyMonster = party.find(monster => monster.current_hp > 0) || null;
  if (!nextHealthyMonster) {
    return activeMonster || party[0] || null;
  }

  state.playerActiveMonsterId = nextHealthyMonster.id;
  state.forceSwitch = false;
  state.currentMenu = "main";
  markParticipant(state, nextHealthyMonster.id);

  const previousName = activeMonster?.nickname || "Your lead monster";
  addLog(
    state,
    `${previousName} cannot battle with 0 HP. ${nextHealthyMonster.nickname} steps in from the next healthy party slot!`
  );

  await saveBattleState(battle.id, state, true);
  battle.battle_state = JSON.stringify(state);
  return nextHealthyMonster;
}

async function buildBattleContext(battle) {
  const state = parseBattleState(battle);
  const player = await getPlayer(battle.player_id);
  const party = await getParty(battle.player_id);
  const activeMonster = await ensureHealthyActiveMonster(battle, state, party);
  const enemyActive = state.enemyParty[state.enemyActiveIndex] ? decorateEnemy(state.enemyParty[state.enemyActiveIndex]) : null;
  const inventory = await getInventory(battle.player_id);

  return {
    battle,
    state,
    player,
    party,
    activeMonster,
    enemyActive,
    inventory,
    title: getBattleTitle(battle, state)
  };
}

async function getBattleContextById(battleId) {
  const battle = await getBattleById(battleId);
  if (!battle) {
    return null;
  }

  return buildBattleContext(battle);
}

async function startWildBattleUnlocked(playerId, area = getDefaultArea().key) {
  const existingBattle = await getActiveBattle(playerId);
  if (existingBattle) {
    if (existingBattle.battle_type === "trainer_pvp") {
      throw new Error("Finish your current trainer battle before starting a new encounter.");
    }

    return buildBattleContext(existingBattle);
  }

  const leadMonster = await getFirstHealthyPartyMonster(playerId);
  if (!leadMonster) {
    throw new Error("Your party has no healthy monsters. Visit !heal first.");
  }

  const areaData = getArea(area) || getDefaultArea();
  const encounter = rollEncounter(areaData.key);
  const level = randomLevel(encounter.minLevel, encounter.maxLevel);
  const enemyMonster = buildEnemyMonster(encounter.species, level);
  const state = {
    area: areaData.name,
    currentMenu: "main",
    forceSwitch: false,
    playerActiveMonsterId: leadMonster.id,
    enemyActiveIndex: 0,
    enemyParty: [enemyMonster],
    participantMonsterIds: [leadMonster.id],
    gymKey: null,
    gymName: null,
    gymLeader: null,
    rewardTier: "wild",
    rewardMoney: 0,
    badgeName: null,
    log: [`A wild ${enemyMonster.species} appeared in ${areaData.name}!`]
  };

  const [result] = await db.query(
    `
      INSERT INTO battles (player_id, battle_type, enemy_species, enemy_hp, battle_state, active)
      VALUES (?, 'wild', ?, ?, ?, 1)
    `,
    [playerId, enemyMonster.species, enemyMonster.currentHp, JSON.stringify(state)]
  );

  return getBattleContextById(result.insertId);
}

async function startGymBattleUnlocked(playerId, gymKey) {
  const existingBattle = await getActiveBattle(playerId);
  if (existingBattle) {
    if (existingBattle.battle_type === "trainer_pvp") {
      throw new Error("Finish your current trainer battle before challenging a gym.");
    }

    return buildBattleContext(existingBattle);
  }

  const gym = getGym(gymKey);
  if (!gym) {
    throw new Error("That gym has not been configured yet.");
  }

  const player = await getPlayer(playerId);
  if (hasBadge(player, gym.badgeName)) {
    throw new Error(`You already own the ${gym.badgeName}.`);
  }

  if (gym.areaKey && !canAccessArea(player, gym.areaKey)) {
    throw new Error("You have not unlocked that gym area yet.");
  }

  if (gym.areaKey && player?.current_area !== gym.areaKey) {
    const area = getArea(gym.areaKey);
    throw new Error(`Travel to ${area?.name || "that area"} before challenging this gym.`);
  }

  const leadMonster = await getFirstHealthyPartyMonster(playerId);
  if (!leadMonster) {
    throw new Error("Your party has no healthy monsters. Visit !heal first.");
  }

  const enemyParty = gym.team.map(member => buildEnemyMonster(member.species, member.level));
  const areaData = getArea(gym.areaKey);
  const state = {
    area: areaData?.name || gym.name,
    currentMenu: "main",
    forceSwitch: false,
    playerActiveMonsterId: leadMonster.id,
    enemyActiveIndex: 0,
    enemyParty,
    participantMonsterIds: [leadMonster.id],
    gymKey,
    gymName: gym.name,
    gymLeader: gym.leader,
    rewardTier: gym.key === "elite_seven_citadel" || gym.badgeName === "Apex Crest" ? "elite_seven" : "gym",
    rewardMoney: gym.rewardMoney,
    badgeName: gym.badgeName,
    log: [`${gym.leader} steps forward with a ${gym.themeType}-type team!`]
  };

  const [result] = await db.query(
    `
      INSERT INTO battles (player_id, battle_type, enemy_species, enemy_hp, battle_state, active)
      VALUES (?, 'gym', ?, ?, ?, 1)
    `,
    [playerId, enemyParty[0].species, enemyParty[0].currentHp, JSON.stringify(state)]
  );

  return getBattleContextById(result.insertId);
}

async function startTrainerEncounterUnlocked(playerId, area = getDefaultArea().key) {
  const existingBattle = await getActiveBattle(playerId);
  if (existingBattle) {
    if (existingBattle.battle_type === "trainer_pvp") {
      throw new Error("Finish your current trainer battle before exploring.");
    }

    return buildBattleContext(existingBattle);
  }

  const leadMonster = await getFirstHealthyPartyMonster(playerId);
  if (!leadMonster) {
    throw new Error("Your party has no healthy monsters. Visit !heal first.");
  }

  const areaData = getArea(area) || getDefaultArea();
  const trainer = rollTrainerEncounter(areaData.key);
  const enemyParty = trainer.team.map(member => buildEnemyMonster(member.species, member.level));
  const state = {
    area: areaData.name,
    currentMenu: "main",
    forceSwitch: false,
    playerActiveMonsterId: leadMonster.id,
    enemyActiveIndex: 0,
    enemyParty,
    participantMonsterIds: [leadMonster.id],
    gymKey: null,
    gymName: null,
    gymLeader: null,
    trainerName: trainer.name,
    rewardTier: trainer.rewardTier || "trainer_npc",
    rewardMoney: trainer.rewardMoney,
    badgeName: null,
    log: [`${trainer.name} challenges you to a battle!`]
  };

  const [result] = await db.query(
    `
      INSERT INTO battles (player_id, battle_type, enemy_species, enemy_hp, battle_state, active)
      VALUES (?, 'trainer_npc', ?, ?, ?, 1)
    `,
    [playerId, enemyParty[0].species, enemyParty[0].currentHp, JSON.stringify(state)]
  );

  return getBattleContextById(result.insertId);
}

async function startWildBattle(playerId, area = getDefaultArea().key) {
  return withPlayerBattleStartLock(playerId, () => startWildBattleUnlocked(playerId, area));
}

async function startGymBattle(playerId, gymKey) {
  return withPlayerBattleStartLock(playerId, () => startGymBattleUnlocked(playerId, gymKey));
}

async function startTrainerEncounter(playerId, area = getDefaultArea().key) {
  return withPlayerBattleStartLock(playerId, () => startTrainerEncounterUnlocked(playerId, area));
}

function markParticipant(state, monsterId) {
  state.participantMonsterIds = state.participantMonsterIds || [];
  if (!state.participantMonsterIds.includes(monsterId)) {
    state.participantMonsterIds.push(monsterId);
  }
}

async function handleBattleEnd(battle, state, resultType) {
  const rewardSummary = {
    kind: "single",
    playerId: battle.player_id,
    battleType: battle.battle_type,
    result: resultType,
    moneyDelta: 0,
    items: [],
    experience: [],
    badge: null
  };

  if (resultType === "win") {
    const highestEnemyLevel = getHighestEnemyLevel(state);
    const rewardProfile = getSingleBattleRewardProfile(battle.battle_type, state);
    const rewardMoney = applyRewardMultiplier(
      state.rewardMoney || 0,
      rewardProfile.moneyMultiplier,
      state.rewardMoney > 0 ? 1 : 0
    );
    const experienceGain = applyRewardMultiplier(
      getBaseExperienceReward(state),
      rewardProfile.expMultiplier,
      20
    );
    const trainingYield = getTrainingYieldForParty(state.enemyParty);
    rewardSummary.rewardProfile = summarizeRewardProfile(rewardProfile);
    rewardSummary.moneyDelta = rewardMoney;

    if (rewardMoney > 0) {
      await adjustMoney(battle.player_id, rewardMoney);
    }

    if (battle.battle_type === "gym" && state.badgeName) {
      await addBadge(battle.player_id, state.badgeName);
      rewardSummary.badge = state.badgeName;
    }

    rewardSummary.items = await grantBattleLoot(battle.player_id, battle.battle_type, highestEnemyLevel);

    for (const monsterId of state.participantMonsterIds) {
      const result = await awardExperience(monsterId, experienceGain);
      if (result) {
        const trainingResult = await awardTraining(monsterId, trainingYield);
        result.trainingApplied = trainingResult?.appliedTraining || null;
        rewardSummary.experience.push(summarizeExperienceReward(result));
      }
    }

  }

  if (resultType === "lose") {
    const player = await getPlayer(battle.player_id);
    const moneyLost = Math.min(player?.money || 0, 150);
    rewardSummary.moneyDelta = moneyLost > 0 ? -moneyLost : 0;
    rewardSummary.healedAtCenter = true;

    if (moneyLost > 0) {
      await adjustMoney(battle.player_id, -moneyLost);
    }

    addLog(
      state,
      "You are out of usable BitPals!",
      moneyLost > 0
        ? `You dropped ${moneyLost} credits while retreating.`
        : "You had no credits to lose.",
      "You rushed to the healing center to patch up your injured friends."
    );
    addPlayback(
      state,
      "You are out of usable BitPals!",
      moneyLost > 0
        ? `You lost ${moneyLost} credits and rushed to the healing center.`
        : "You rushed to the healing center. No credits were lost."
    );
    await healParty(battle.player_id);
  }

  state.rewardSummary = rewardSummary;
  state.currentMenu = "ended";
  state.forceSwitch = false;
  await saveBattleState(battle.id, state, false);
}

async function playerAttack(state, playerMonster, enemyMonster, move, enemyIndex = state.enemyActiveIndex) {
  const attackResult = calculateDamage(playerMonster, enemyMonster, move);
  const beforeHp = enemyMonster.currentHp;
  enemyMonster.currentHp = Math.max(0, enemyMonster.currentHp - attackResult.damage);

  const typeText = attackResult.effectiveness > 1
    ? " It's super effective!"
    : attackResult.effectiveness < 1
      ? " It's not very effective."
      : "";

  addLog(
    state,
    `${playerMonster.nickname} used ${move.name} for ${attackResult.damage} damage.${typeText}`
  );
  addPlayback(state, `${playerMonster.nickname} used ${move.name}!`);
  addPlayback(
    state,
    `${enemyMonster.species} took ${attackResult.damage} damage!`,
    `${formatHpChange(enemyMonster.species, beforeHp, enemyMonster.currentHp, enemyMonster.maxHp)}${typeText}`,
    {
      hpChanges: [enemyHpChange(enemyIndex, beforeHp, enemyMonster.currentHp)]
    }
  );

  if (enemyMonster.currentHp <= 0) {
    addLog(state, `${enemyMonster.species} fainted!`);
    addPlayback(state, `${enemyMonster.species} fainted!`);
  }
}

async function enemyAttack(state, enemyMonster, playerMonster) {
  const move = chooseEnemyMove(enemyMonster);
  const attackResult = calculateDamage(enemyMonster, playerMonster, move);
  const beforeHp = playerMonster.current_hp;
  const updatedMonster = await setMonsterHp(playerMonster.id, playerMonster.current_hp - attackResult.damage);

  const typeText = attackResult.effectiveness > 1
    ? " It's super effective!"
    : attackResult.effectiveness < 1
      ? " It's not very effective."
      : "";

  addLog(
    state,
    `${enemyMonster.species} used ${move.name} for ${attackResult.damage} damage.${typeText}`
  );
  addPlayback(state, `${enemyMonster.species} used ${move.name}!`);
  addPlayback(
    state,
    `${updatedMonster.nickname} took ${attackResult.damage} damage!`,
    `${formatHpChange(updatedMonster.nickname, beforeHp, updatedMonster.current_hp, updatedMonster.max_hp)}${typeText}`,
    {
      hpChanges: [playerHpChange(updatedMonster, beforeHp, updatedMonster.current_hp)]
    }
  );

  if (updatedMonster.current_hp <= 0) {
    addLog(state, `${updatedMonster.nickname} fainted!`);
    addPlayback(state, `${updatedMonster.nickname} fainted!`);
  }

  return updatedMonster;
}

async function resolveVictoryIfNeeded(battle, state) {
  if (hasLivingEnemy(state)) {
    return false;
  }

  addLog(
    state,
    battle.battle_type === "gym"
      ? "The gym leader is out of monsters!"
      : battle.battle_type === "trainer_npc"
        ? `${state.trainerName} is out of monsters!`
        : "You won the wild battle!"
  );
  addPlayback(state, "Battle won!", "The opposing side has no monsters left.");
  await handleBattleEnd(battle, state, "win");
  return true;
}

async function processMoveTurn(battle, state, playerMonster, moveKey) {
  const currentPlayerMonster = await getMonsterById(playerMonster.id);
  const enemyMonster = state.enemyParty[state.enemyActiveIndex];
  const move = currentPlayerMonster.moves.find(entry => entry.key === moveKey);

  if (!move) {
    throw new Error("That move is not available right now.");
  }

  markParticipant(state, currentPlayerMonster.id);
  const enemyMove = chooseEnemyMove(enemyMonster);
  const playerFirst = (move.priority || 0) !== (enemyMove.priority || 0)
    ? (move.priority || 0) > (enemyMove.priority || 0)
    : currentPlayerMonster.speed >= enemyMonster.speed;

  if (playerFirst) {
    await playerAttack(state, currentPlayerMonster, enemyMonster, move);

    if (enemyMonster.currentHp <= 0) {
      if (sendNextEnemyIfAvailable(state)) {
        return false;
      }
      return resolveVictoryIfNeeded(battle, state);
    }

    const updatedMonster = await enemyAttack(state, enemyMonster, currentPlayerMonster);
    if (updatedMonster.current_hp <= 0) {
      state.forceSwitch = true;
      state.currentMenu = "switch";
    }
    return false;
  }

  const updatedMonster = await enemyAttack(state, enemyMonster, currentPlayerMonster);
  if (updatedMonster.current_hp <= 0) {
    state.forceSwitch = true;
    state.currentMenu = "switch";
    return false;
  }

  await playerAttack(state, updatedMonster, enemyMonster, move);

  if (enemyMonster.currentHp <= 0) {
    if (sendNextEnemyIfAvailable(state)) {
      return false;
    }
    return resolveVictoryIfNeeded(battle, state);
  }

  return false;
}

async function processItemTurn(battle, state, playerMonster, itemKey) {
  const item = getItem(itemKey);

  if (!item) {
    throw new Error("That item does not exist.");
  }

  const player = await getPlayer(battle.player_id);
  if (!canAccessItem(player, item)) {
    throw new Error(`${item.name} is locked. ${getItemUnlockText(item)}.`);
  }

  if ((await getItemQuantity(battle.player_id, item.key)) < 1) {
    throw new Error(`You do not have any ${item.name}s left.`);
  }

  if (item.battleUsage === "heal") {
    if (playerMonster.current_hp <= 0) {
      throw new Error("You cannot heal a fainted active monster in battle.");
    }

    await removeItem(battle.player_id, item.key, 1);
    const beforeHp = playerMonster.current_hp;
    const healed = await setMonsterHp(playerMonster.id, playerMonster.current_hp + item.healAmount);
    const healedAmount = healed.current_hp - playerMonster.current_hp;
    addLog(state, `${healed.nickname} recovered ${healedAmount} HP with ${item.name}.`);
    addPlayback(
      state,
      `${healed.nickname} used ${item.name}!`,
      `${healed.nickname} recovered ${healedAmount} HP. ${formatHpChange(healed.nickname, beforeHp, healed.current_hp, healed.max_hp)}`,
      {
        hpChanges: [playerHpChange(healed, beforeHp, healed.current_hp)]
      }
    );

    const enemyMonster = state.enemyParty[state.enemyActiveIndex];
    const updatedMonster = await enemyAttack(state, enemyMonster, healed);
    if (updatedMonster.current_hp <= 0) {
      state.forceSwitch = true;
      state.currentMenu = "switch";
    }
    return false;
  }

  if (item.battleUsage === "capture") {
    if (battle.battle_type !== "wild") {
      throw new Error("Capture orbs only work in wild battles.");
    }

    await removeItem(battle.player_id, item.key, 1);
    const enemyMonster = state.enemyParty[state.enemyActiveIndex];
    const hpFactor = (enemyMonster.maxHp - enemyMonster.currentHp) / enemyMonster.maxHp;
    const captureChance = Math.min(0.92, enemyMonster.catchRate + hpFactor * 0.55 + ((item.catchBonus || 0) * 0.08));

    if (Math.random() <= captureChance) {
      const captureResult = await captureMonster(battle.player_id, enemyMonster);
      addLog(state, `Capture success! ${enemyMonster.species} was added to your ${captureResult.location}.`);
      addPlayback(state, `${item.name} clicked shut!`, `${enemyMonster.species} was captured and sent to your ${captureResult.location}.`);
      await handleBattleEnd(battle, state, "win");
      return true;
    }

    addLog(state, `${enemyMonster.species} broke free from the ${item.name}!`);
    addPlayback(state, `${enemyMonster.species} broke free!`, `${item.name} failed. The wild monster is still battling.`);
    const updatedMonster = await enemyAttack(state, enemyMonster, playerMonster);
    if (updatedMonster.current_hp <= 0) {
      state.forceSwitch = true;
      state.currentMenu = "switch";
    }
    return false;
  }

  throw new Error("That item cannot be used in battle.");
}

async function processSwitchTurn(battle, state, targetMonsterId) {
  const party = await getParty(battle.player_id);
  const targetMonster = party.find(monster => monster.id === Number(targetMonsterId));

  if (!targetMonster) {
    throw new Error("That monster is not in your active party anymore.");
  }

  if (targetMonster.current_hp <= 0) {
    throw new Error(`${targetMonster.nickname} has fainted and cannot switch in. Choose a healthy party monster.`);
  }

  const switchingFromForcedState = state.forceSwitch;

  if (targetMonster.id === state.playerActiveMonsterId && !switchingFromForcedState) {
    throw new Error("That monster is already active.");
  }

  state.playerActiveMonsterId = targetMonster.id;
  state.forceSwitch = false;
  state.currentMenu = "main";
  markParticipant(state, targetMonster.id);
  addLog(state, `Go, ${targetMonster.nickname}!`);
  addPlayback(state, `Go, ${targetMonster.nickname}!`, `${targetMonster.nickname} entered from party slot ${targetMonster.party_slot}.`, {
    activeChanges: [playerActiveChange(targetMonster.id)]
  });

  if (!switchingFromForcedState) {
    const enemyMonster = state.enemyParty[state.enemyActiveIndex];
    const updatedMonster = await enemyAttack(state, enemyMonster, targetMonster);
    if (updatedMonster.current_hp <= 0) {
      state.forceSwitch = true;
      state.currentMenu = "switch";
    }
  }

  return false;
}

async function processRunAttempt(battle, state, playerMonster) {
  if (battle.battle_type !== "wild") {
    throw new Error("You cannot run from a trainer battle.");
  }

  const enemyMonster = state.enemyParty[state.enemyActiveIndex];
  const runChance = playerMonster.speed >= enemyMonster.speed ? 0.95 : 0.6;

  if (Math.random() <= runChance) {
    addLog(state, "You escaped safely.");
    addPlayback(state, "You escaped safely!", "The wild encounter ended.");
    state.currentMenu = "ended";
    state.forceSwitch = false;
    await saveBattleState(battle.id, state, false);
    return true;
  }

  addLog(state, "You could not get away!");
  addPlayback(state, "Escape failed!", "The wild monster gets to attack.");
  const updatedMonster = await enemyAttack(state, enemyMonster, playerMonster);
  if (updatedMonster.current_hp <= 0) {
    state.forceSwitch = true;
    state.currentMenu = "switch";
  }
  return false;
}

async function ensurePlayerStillAlive(battle, state) {
  const party = await getParty(battle.player_id);
  if (party.some(monster => monster.current_hp > 0)) {
    return false;
  }

  await handleBattleEnd(battle, state, "lose");
  return true;
}

async function processBattleAction(playerId, battleId, action, value = null, options = {}) {
  const battle = await getBattleById(battleId);
  const turnActions = ["move", "item", "switch", "run"];
  const isTurnAction = turnActions.includes(action);
  let actionLockToken = null;

  if (!battle) {
    throw new Error("That battle is no longer active.");
  }

  if (battle.player_id !== playerId) {
    throw new Error("That battle belongs to another trainer.");
  }

  if (!battle.active) {
    return getBattleContextById(battle.id);
  }

  if (options.expectedActionVersion && Number(battle.action_version || 1) !== Number(options.expectedActionVersion)) {
    throw new Error("That battle button is from an older turn. Use the latest battle board buttons.");
  }

  if (isTurnAction) {
    actionLockToken = await acquireBattleActionLock(battle.id);
    if (!actionLockToken) {
      throw new Error("That turn is already resolving. Wait for the battle board to finish updating.");
    }
  }

  const state = parseBattleState(battle);
  const party = await getParty(playerId);
  const playerMonster = party.find(monster => monster.id === state.playerActiveMonsterId) || party[0];

  try {
    if (!playerMonster) {
      throw new Error("You do not have any monsters in your party.");
    }

    if (isTurnAction) {
      resetPlayback(state);
    }

    if (playerMonster.current_hp <= 0 && action !== "switch") {
      state.forceSwitch = true;
      state.currentMenu = "switch";
      await saveBattleState(battle.id, state, true);
      return getBattleContextById(battle.id);
    }

    if (action === "menu") {
      if (state.forceSwitch && value !== "switch") {
        throw new Error("Choose a healthy party monster before doing anything else.");
      }

      state.currentMenu = value;
      await saveBattleState(battle.id, state, true);
      return getBattleContextById(battle.id);
    }

    if (action === "back") {
      state.currentMenu = state.forceSwitch ? "switch" : "main";
      await saveBattleState(battle.id, state, true);
      return getBattleContextById(battle.id);
    }

    let battleEnded = false;

    if (action === "move") {
      battleEnded = await processMoveTurn(battle, state, playerMonster, value);
    } else if (action === "item") {
      battleEnded = await processItemTurn(battle, state, playerMonster, value);
    } else if (action === "switch") {
      battleEnded = await processSwitchTurn(battle, state, value);
    } else if (action === "run") {
      battleEnded = await processRunAttempt(battle, state, playerMonster);
    } else {
      throw new Error("Unknown battle action.");
    }

    if (!battleEnded) {
      if (await ensurePlayerStillAlive(battle, state)) {
        battleEnded = true;
      }
    }

    if (!battleEnded) {
      state.currentMenu = state.forceSwitch ? "switch" : "main";
      await saveBattleState(battle.id, state, true);
    }

    const context = await getBattleContextById(battle.id);
    context.actionLockToken = actionLockToken;

    if (!options.holdActionLock && actionLockToken) {
      return releaseBattleActionLock(battle.id, actionLockToken);
    }

    return context;
  } catch (err) {
    if (actionLockToken) {
      await releaseBattleActionLock(battle.id, actionLockToken, { advanceVersion: false });
    }

    throw err;
  }
}

async function useFallbackBattleAction(playerId, action) {
  const battle = await getActiveBattle(playerId);
  if (!battle) {
    return null;
  }

  if (battle.battle_type === "trainer_pvp") {
    return null;
  }

  const context = await buildBattleContext(battle);

  if (action === "attack") {
    const defaultMove = context.activeMonster?.moves?.[0];
    if (!defaultMove) {
      throw new Error("Your active monster does not know any moves yet.");
    }

    return processBattleAction(playerId, battle.id, "move", defaultMove.key);
  }

  if (action === "capture") {
    const bestOrb = context.inventory
      .filter(item => item.battleUsage === "capture" && item.quantity > 0 && canAccessItem(context.player, item))
      .sort((left, right) => (right.catchBonus || 0) - (left.catchBonus || 0))[0];

    if (!bestOrb) {
      throw new Error("You do not have any usable capture orbs left.");
    }

    return processBattleAction(playerId, battle.id, "item", bestOrb.key);
  }

  return null;
}

async function buyItem(playerId, itemKey, quantity = 1) {
  const item = getItem(itemKey);
  if (!item) {
    throw new Error("That item is not sold here.");
  }

  const normalizedQuantity = Number(quantity);
  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 1) {
    throw new Error("Shop quantities must be at least 1.");
  }

  const player = await getPlayer(playerId);
  if (!canAccessItem(player, item)) {
    throw new Error(`${item.name} is locked. ${getItemUnlockText(item)}.`);
  }

  const totalPrice = item.price * normalizedQuantity;

  if (player.money < totalPrice) {
    throw new Error("You do not have enough money for that purchase.");
  }

  await adjustMoney(playerId, -totalPrice);
  await addItem(playerId, item.key, normalizedQuantity);

  return {
    player: await getPlayer(playerId),
    inventory: await getInventory(playerId),
    item,
    quantity: normalizedQuantity
  };
}

function getItemSellValue(item) {
  return Math.max(1, Math.floor((item?.price || 0) * 0.5));
}

async function sellItem(playerId, itemKey, quantity = 1) {
  const item = getItem(itemKey);
  if (!item) {
    throw new Error("That item cannot be sold here.");
  }

  const normalizedQuantity = Number(quantity);
  if (!Number.isInteger(normalizedQuantity) || normalizedQuantity < 1) {
    throw new Error("Sell quantities must be at least 1.");
  }

  const ownedQuantity = await getItemQuantity(playerId, item.key);
  if (ownedQuantity < normalizedQuantity) {
    throw new Error(`You only have ${ownedQuantity}x ${item.name}.`);
  }

  const sellValue = getItemSellValue(item);
  const totalValue = sellValue * normalizedQuantity;
  const removed = await removeItem(playerId, item.key, normalizedQuantity);

  if (!removed) {
    throw new Error(`You do not have enough ${item.name} to sell.`);
  }

  await adjustMoney(playerId, totalValue);

  return {
    player: await getPlayer(playerId),
    inventory: await getInventory(playerId),
    item,
    quantity: normalizedQuantity,
    sellValue,
    totalValue
  };
}

module.exports = {
  buyItem,
  calculateDamage,
  getItemSellValue,
  getActiveBattle,
  getBattleById,
  getBattleContextById,
  getBattleTitle,
  processBattleAction,
  releaseBattleActionLock,
  setBattleMessageInfo,
  sellItem,
  startGymBattle,
  startTrainerEncounter,
  startWildBattle,
  useFallbackBattleAction
};
