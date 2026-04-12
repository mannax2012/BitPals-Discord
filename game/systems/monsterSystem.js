const db = require("../../database/db");
const {
  getItem,
  getLearnedMoveEntries,
  getMove,
  getMovesForSpecies,
  getNextEvolution,
  getSpecies,
  getTriggeredEvolution
} = require("./gameData");

function experienceForLevel(level) {
  return level * level * 25;
}

const STAT_KEYS = ["hp", "attack", "defense", "speed"];
const POTENTIAL_CAP = 31;
const TRAINING_CAP_PER_STAT = 252;
const TRAINING_CAP_TOTAL = 510;
const GENDER_OPTIONS = ["Male", "Female"];
const STAT_LABELS = {
  hp: "HP",
  attack: "Attack",
  defense: "Defense",
  speed: "Speed"
};
const PERSONALITIES = [
  { key: "balanced", name: "Balanced", increase: null, decrease: null },
  { key: "calm", name: "Calm", increase: null, decrease: null },
  { key: "curious", name: "Curious", increase: null, decrease: null },
  { key: "spirited", name: "Spirited", increase: "attack", decrease: "defense" },
  { key: "reckless", name: "Reckless", increase: "attack", decrease: "speed" },
  { key: "guarded", name: "Guarded", increase: "defense", decrease: "attack" },
  { key: "stoic", name: "Stoic", increase: "defense", decrease: "speed" },
  { key: "nimble", name: "Nimble", increase: "speed", decrease: "attack" },
  { key: "sly", name: "Sly", increase: "speed", decrease: "defense" }
];
const PERSONALITY_MAP = new Map(PERSONALITIES.map(personality => [personality.key, personality]));

function normalizeGender(value) {
  const normalized = String(value || "").toLowerCase();

  if (normalized === "male") {
    return "Male";
  }

  if (normalized === "female") {
    return "Female";
  }

  return null;
}

function getRandomGender() {
  return GENDER_OPTIONS[Math.floor(Math.random() * GENDER_OPTIONS.length)];
}

function getRandomPersonality() {
  return PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];
}

function getPersonalityProfile(key) {
  return PERSONALITY_MAP.get(String(key || "").toLowerCase()) || null;
}

function formatStatLabel(statKey) {
  return STAT_LABELS[statKey] || String(statKey || "").toUpperCase();
}

function describePersonality(personality) {
  if (!personality?.increase || !personality?.decrease) {
    return "Neutral";
  }

  return `+${formatStatLabel(personality.increase)} / -${formatStatLabel(personality.decrease)}`;
}

function describeEvolutionRule(rule) {
  if (!rule) {
    return "Final stage";
  }

  if (rule.method === "level") {
    return `Evolves into ${rule.species} at Lv.${rule.level}`;
  }

  if (rule.method === "item") {
    const item = getItem(rule.itemKey);
    return `Use ${item?.name || rule.itemKey} to evolve into ${rule.species}`;
  }

  return `Evolution path: ${rule.species}`;
}

function buildMonsterIdentity(seed = {}) {
  const gender = normalizeGender(seed.gender) || getRandomGender();
  const personality = getPersonalityProfile(seed.personalityKey) || getRandomPersonality();

  return {
    gender,
    personality
  };
}

function createEmptyStatProfile() {
  return {
    hp: 0,
    attack: 0,
    defense: 0,
    speed: 0
  };
}

function parseStatProfile(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    return null;
  }
}

function normalizeStatProfile(value, maxPerStat) {
  const profile = createEmptyStatProfile();

  for (const key of STAT_KEYS) {
    const nextValue = Number(value?.[key] ?? 0);
    const clamped = Math.max(0, Math.min(maxPerStat, Number.isFinite(nextValue) ? Math.floor(nextValue) : 0));
    profile[key] = clamped;
  }

  return profile;
}

function createRandomPotential() {
  const profile = createEmptyStatProfile();

  for (const key of STAT_KEYS) {
    profile[key] = Math.floor(Math.random() * (POTENTIAL_CAP + 1));
  }

  return profile;
}

function createEmptyTraining() {
  return createEmptyStatProfile();
}

function getTrainingTotal(profile) {
  return STAT_KEYS.reduce((sum, key) => sum + (profile[key] || 0), 0);
}

function getPotentialTotal(profile) {
  return STAT_KEYS.reduce((sum, key) => sum + (profile[key] || 0), 0);
}

function mergeStatProfiles(...profiles) {
  const merged = createEmptyStatProfile();

  for (const profile of profiles) {
    for (const key of STAT_KEYS) {
      merged[key] += profile?.[key] || 0;
    }
  }

  return merged;
}

function applyTrainingGain(currentTraining, gainProfile) {
  const nextTraining = normalizeStatProfile(currentTraining, TRAINING_CAP_PER_STAT);
  const appliedTraining = createEmptyStatProfile();
  let remainingTotal = Math.max(0, TRAINING_CAP_TOTAL - getTrainingTotal(nextTraining));

  for (const key of STAT_KEYS) {
    const requested = Math.max(0, Math.floor(gainProfile?.[key] || 0));
    if (requested <= 0 || remainingTotal <= 0) {
      continue;
    }

    const room = Math.max(0, TRAINING_CAP_PER_STAT - nextTraining[key]);
    const applied = Math.min(requested, room, remainingTotal);

    nextTraining[key] += applied;
    appliedTraining[key] = applied;
    remainingTotal -= applied;
  }

  return {
    nextTraining,
    appliedTraining
  };
}

function getTrainingYieldForSpecies(speciesName) {
  const species = getSpecies(speciesName);
  if (!species) {
    return createEmptyTraining();
  }

  const rankedStats = [
    { key: "hp", value: species.baseStats.hp },
    { key: "attack", value: species.baseStats.attack },
    { key: "defense", value: species.baseStats.defense },
    { key: "speed", value: species.baseStats.speed }
  ].sort((left, right) => right.value - left.value);

  const yieldProfile = createEmptyTraining();
  yieldProfile[rankedStats[0].key] = 2;

  if (rankedStats[1].value >= rankedStats[0].value - 6) {
    yieldProfile[rankedStats[1].key] += 1;
  }

  return yieldProfile;
}

function getTrainingYieldForParty(enemyParty = []) {
  return enemyParty.reduce(
    (total, enemyMonster) => mergeStatProfiles(total, getTrainingYieldForSpecies(enemyMonster.species)),
    createEmptyTraining()
  );
}

function calculateStats(speciesName, level, modifiers = {}) {
  const data = getSpecies(speciesName);

  if (!data) {
    throw new Error(`Unknown species: ${speciesName}`);
  }

  const potential = normalizeStatProfile(modifiers.potential, POTENTIAL_CAP);
  const training = normalizeStatProfile(modifiers.training, TRAINING_CAP_PER_STAT);
  const personality = getPersonalityProfile(modifiers.personalityKey || modifiers.personality?.key);
  const trainingSteps = {
    hp: Math.floor(training.hp / 4),
    attack: Math.floor(training.attack / 4),
    defense: Math.floor(training.defense / 4),
    speed: Math.floor(training.speed / 4)
  };
  const applyPersonality = (statKey, value) => {
    if (!personality?.increase || !personality?.decrease) {
      return value;
    }

    if (personality.increase === statKey) {
      return Math.floor(value * 1.1);
    }

    if (personality.decrease === statKey) {
      return Math.floor(value * 0.9);
    }

    return value;
  };

  const baseAttack = Math.max(5, Math.floor((((2 * data.baseStats.attack) + potential.attack + trainingSteps.attack) * level) / 100) + 5);
  const baseDefense = Math.max(5, Math.floor((((2 * data.baseStats.defense) + potential.defense + trainingSteps.defense) * level) / 100) + 5);
  const baseSpeed = Math.max(5, Math.floor((((2 * data.baseStats.speed) + potential.speed + trainingSteps.speed) * level) / 100) + 5);

  return {
    max_hp: Math.max(12, Math.floor((((2 * data.baseStats.hp) + potential.hp + trainingSteps.hp) * level) / 100) + level + 10),
    attack: Math.max(5, applyPersonality("attack", baseAttack)),
    defense: Math.max(5, applyPersonality("defense", baseDefense)),
    speed: Math.max(5, applyPersonality("speed", baseSpeed))
  };
}

function parseMoveKeys(value) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map(entry => String(entry).toLowerCase()).filter(Boolean)
      : [];
  } catch (err) {
    return [];
  }
}

function getDefaultActiveMoveKeys(speciesName, level) {
  return getMovesForSpecies(speciesName, level)
    .map(move => move?.key)
    .filter(Boolean);
}

function sanitizeActiveMoveKeys(speciesName, level, moveKeys = []) {
  const learnedEntries = getLearnedMoveEntries(speciesName, level);
  const learnedMap = new Map(learnedEntries.map(entry => [entry.move.key, entry.move]));
  const desiredCount = Math.min(4, learnedEntries.length || 1);
  const sanitized = [];

  for (const moveKey of moveKeys) {
    const normalizedKey = String(moveKey).toLowerCase();
    if (!learnedMap.has(normalizedKey) || sanitized.includes(normalizedKey)) {
      continue;
    }

    sanitized.push(normalizedKey);
    if (sanitized.length >= desiredCount) {
      break;
    }
  }

  if (sanitized.length === 0) {
    return getDefaultActiveMoveKeys(speciesName, level);
  }

  for (const entry of learnedEntries.slice(-4)) {
    if (sanitized.length >= desiredCount) {
      break;
    }

    if (!sanitized.includes(entry.move.key)) {
      sanitized.push(entry.move.key);
    }
  }

  return sanitized.slice(0, 4);
}

function summarizeMove(move, level = null) {
  return {
    key: move?.key || null,
    name: move?.name || "Unknown Move",
    type: move?.type || "Normal",
    power: move?.power ?? null,
    accuracy: move?.accuracy ?? null,
    priority: move?.priority ?? 0,
    level
  };
}

function dedupeMoves(moves) {
  const seen = new Set();
  const deduped = [];

  for (const move of moves) {
    const key = `${move.key || move.name}:${move.level ?? "any"}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(move);
  }

  return deduped;
}

function getKnownMoveNames(speciesName, level) {
  const species = getSpecies(speciesName);
  const learnset = species?.learnset || [];

  return new Set(
    learnset
      .filter(entry => entry.level <= level)
      .map(entry => String(entry.move).toLowerCase())
  );
}

function getMovesLearnedBetweenLevels(speciesName, oldLevel, newLevel) {
  const species = getSpecies(speciesName);
  const learnset = species?.learnset || [];
  const oldKnownMoves = getKnownMoveNames(speciesName, oldLevel);

  return dedupeMoves(
    learnset
      .filter(entry => entry.level > oldLevel && entry.level <= newLevel)
      .filter(entry => !oldKnownMoves.has(String(entry.move).toLowerCase()))
      .map(entry => summarizeMove(getMove(entry.move), entry.level))
  );
}

function hydrateMonster(row) {
  if (!row) {
    return null;
  }

  const data = getSpecies(row.species);
  const storedNickname = typeof row.nickname === "string" && row.nickname.trim()
    ? row.nickname.trim()
    : null;
  const customNickname = storedNickname && storedNickname !== row.species ? storedNickname : null;
  const currentLevelFloor = experienceForLevel(row.level);
  const nextLevelFloor = experienceForLevel(row.level + 1);
  const identity = buildMonsterIdentity({
    gender: row.gender,
    personalityKey: row.personality_key
  });
  const nextEvolution = getNextEvolution(row.species);
  const potential = normalizeStatProfile(parseStatProfile(row.potential_json), POTENTIAL_CAP);
  const training = normalizeStatProfile(parseStatProfile(row.training_json), TRAINING_CAP_PER_STAT);
  const activeMoveKeys = sanitizeActiveMoveKeys(row.species, row.level, parseMoveKeys(row.moves_json));
  const learnedMoves = getLearnedMoveEntries(row.species, row.level).map(entry => ({
    ...summarizeMove(entry.move, entry.level),
    learnedAt: entry.level,
    active: activeMoveKeys.includes(entry.move.key)
  }));

  return {
    ...row,
    nickname: customNickname || row.species,
    customNickname,
    hasCustomNickname: Boolean(customNickname),
    types: data?.types || ["Normal"],
    gender: identity.gender,
    personalityKey: identity.personality.key,
    personalityName: identity.personality.name,
    personalityEffects: describePersonality(identity.personality),
    nextEvolution,
    evolutionSummary: describeEvolutionRule(nextEvolution),
    moves: activeMoveKeys.map(moveKey => getMove(moveKey)).filter(Boolean),
    learnedMoves,
    potential,
    potentialTotal: getPotentialTotal(potential),
    training,
    trainingTotal: getTrainingTotal(training),
    expCurrent: row.experience - currentLevelFloor,
    expNeeded: nextLevelFloor - currentLevelFloor,
    expToNext: Math.max(0, nextLevelFloor - row.experience)
  };
}

async function syncMonsterRow(row) {
  const identity = buildMonsterIdentity({
    gender: row.gender,
    personalityKey: row.personality_key
  });
  const potential = parseStatProfile(row.potential_json) ? normalizeStatProfile(parseStatProfile(row.potential_json), POTENTIAL_CAP) : createRandomPotential();
  const training = parseStatProfile(row.training_json) ? normalizeStatProfile(parseStatProfile(row.training_json), TRAINING_CAP_PER_STAT) : createEmptyTraining();
  const calculated = calculateStats(row.species, row.level, {
    potential,
    training,
    personalityKey: identity.personality.key
  });
  const nextCurrentHp = Math.min(row.current_hp, calculated.max_hp);
  const nextMoveKeys = sanitizeActiveMoveKeys(row.species, row.level, parseMoveKeys(row.moves_json));
  const nextMovesJson = JSON.stringify(nextMoveKeys);
  const nextPotentialJson = JSON.stringify(potential);
  const nextTrainingJson = JSON.stringify(training);
  const nextGender = identity.gender;
  const nextPersonalityKey = identity.personality.key;

  if (
    row.max_hp !== calculated.max_hp ||
    row.attack !== calculated.attack ||
    row.defense !== calculated.defense ||
    row.speed !== calculated.speed ||
    nextCurrentHp !== row.current_hp ||
    row.gender !== nextGender ||
    row.personality_key !== nextPersonalityKey ||
    row.moves_json !== nextMovesJson ||
    row.potential_json !== nextPotentialJson ||
    row.training_json !== nextTrainingJson
  ) {
    await db.query(
      `
        UPDATE monsters
        SET current_hp = ?, max_hp = ?, attack = ?, defense = ?, speed = ?, gender = ?, personality_key = ?, moves_json = ?, potential_json = ?, training_json = ?
        WHERE id = ?
      `,
      [
        nextCurrentHp,
        calculated.max_hp,
        calculated.attack,
        calculated.defense,
        calculated.speed,
        nextGender,
        nextPersonalityKey,
        nextMovesJson,
        nextPotentialJson,
        nextTrainingJson,
        row.id
      ]
    );

    return {
      ...row,
      current_hp: nextCurrentHp,
      gender: nextGender,
      personality_key: nextPersonalityKey,
      moves_json: nextMovesJson,
      potential_json: nextPotentialJson,
      training_json: nextTrainingJson,
      ...calculated
    };
  }

  return row;
}

async function getPlayerMonsters(playerId) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM monsters
      WHERE owner_id = ?
      ORDER BY CASE WHEN party_slot IS NULL THEN 99 ELSE party_slot END, id
    `,
    [playerId]
  );

  const synced = [];
  for (const row of rows) {
    synced.push(await syncMonsterRow(row));
  }

  return synced.map(hydrateMonster);
}

async function getMonsterById(monsterId) {
  const [rows] = await db.query("SELECT * FROM monsters WHERE id = ?", [monsterId]);
  if (!rows[0]) {
    return null;
  }

  return hydrateMonster(await syncMonsterRow(rows[0]));
}

async function ensurePartyAssignments(playerId) {
  const monsters = await getPlayerMonsters(playerId);
  if (monsters.length === 0) {
    return;
  }

  const validParty = monsters
    .filter(monster => Number.isInteger(monster.party_slot) && monster.party_slot >= 1 && monster.party_slot <= 6)
    .sort((left, right) => left.party_slot - right.party_slot || left.id - right.id);

  const desiredSlots = new Map();
  const usedSlots = new Set();
  const overflowParty = [];

  for (const monster of validParty) {
    if (!usedSlots.has(monster.party_slot)) {
      desiredSlots.set(monster.id, monster.party_slot);
      usedSlots.add(monster.party_slot);
      continue;
    }

    overflowParty.push(monster);
  }

  if (desiredSlots.size === 0) {
    monsters.slice(0, 6).forEach((monster, index) => {
      desiredSlots.set(monster.id, index + 1);
    });
  } else {
    for (const monster of overflowParty) {
      const openSlot = [1, 2, 3, 4, 5, 6].find(slot => !usedSlots.has(slot));
      if (!openSlot) {
        break;
      }

      desiredSlots.set(monster.id, openSlot);
      usedSlots.add(openSlot);
    }
  }

  for (const monster of monsters) {
    if (desiredSlots.has(monster.id)) {
      const desiredSlot = desiredSlots.get(monster.id);

      if (monster.party_slot !== desiredSlot) {
        await db.query("UPDATE monsters SET party_slot = ? WHERE id = ?", [desiredSlot, monster.id]);
      }
      continue;
    }

    if (monster.party_slot !== null) {
      await db.query("UPDATE monsters SET party_slot = NULL WHERE id = ?", [monster.id]);
    }
  }
}

async function getParty(playerId) {
  await ensurePartyAssignments(playerId);

  const [rows] = await db.query(
    `
      SELECT *
      FROM monsters
      WHERE owner_id = ? AND party_slot BETWEEN 1 AND 6
      ORDER BY party_slot, id
    `,
    [playerId]
  );

  const synced = [];
  for (const row of rows) {
    synced.push(await syncMonsterRow(row));
  }

  return synced.map(hydrateMonster);
}

async function getBox(playerId) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM monsters
      WHERE owner_id = ? AND (party_slot IS NULL OR party_slot < 1 OR party_slot > 6)
      ORDER BY id
    `,
    [playerId]
  );

  const synced = [];
  for (const row of rows) {
    synced.push(await syncMonsterRow(row));
  }

  return synced.map(hydrateMonster);
}

async function getFirstHealthyPartyMonster(playerId) {
  const party = await getParty(playerId);
  return party.find(monster => monster.current_hp > 0) || null;
}

async function createMonster({ ownerId, species, level, nickname = null, partySlot = null, gender = null, personalityKey = null }) {
  const identity = buildMonsterIdentity({ gender, personalityKey });
  const potential = createRandomPotential();
  const training = createEmptyTraining();
  const stats = calculateStats(species, level, {
    potential,
    training,
    personalityKey: identity.personality.key
  });
  const experience = experienceForLevel(level);
  const moveKeys = JSON.stringify(getDefaultActiveMoveKeys(species, level));

  const [result] = await db.query(
    `
      INSERT INTO monsters
      (owner_id, species, nickname, level, experience, party_slot, current_hp, max_hp, attack, defense, speed, gender, personality_key, moves_json, potential_json, training_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      ownerId,
      species,
      nickname,
      level,
      experience,
      partySlot,
      stats.max_hp,
      stats.max_hp,
      stats.attack,
      stats.defense,
      stats.speed,
      identity.gender,
      identity.personality.key,
      moveKeys,
      JSON.stringify(potential),
      JSON.stringify(training)
    ]
  );

  return getMonsterById(result.insertId);
}

async function giveStarter(playerId, speciesName = "Flameling") {
  await ensurePartyAssignments(playerId);
  const party = await getParty(playerId);

  if (party.length > 0) {
    return party[0];
  }

  return createMonster({
    ownerId: playerId,
    species: speciesName,
    level: 5,
    partySlot: 1
  });
}

async function setMonsterHp(monsterId, nextHp) {
  const monster = await getMonsterById(monsterId);
  if (!monster) {
    return null;
  }

  const clampedHp = Math.max(0, Math.min(monster.max_hp, nextHp));
  await db.query("UPDATE monsters SET current_hp = ? WHERE id = ?", [clampedHp, monsterId]);
  return getMonsterById(monsterId);
}

async function healParty(playerId) {
  const monsters = await getPlayerMonsters(playerId);

  for (const monster of monsters) {
    await db.query("UPDATE monsters SET current_hp = ? WHERE id = ?", [monster.max_hp, monster.id]);
  }

  return getParty(playerId);
}

async function swapPartySlots(playerId, fromSlot, toSlot) {
  if (fromSlot === toSlot) {
    return getParty(playerId);
  }

  const party = await getParty(playerId);
  const fromMonster = party.find(monster => monster.party_slot === fromSlot);
  const toMonster = party.find(monster => monster.party_slot === toSlot);

  if (!fromMonster) {
    throw new Error(`No monster found in party slot ${fromSlot}.`);
  }

  await db.query("UPDATE monsters SET party_slot = 99 WHERE id = ?", [fromMonster.id]);

  if (toMonster) {
    await db.query("UPDATE monsters SET party_slot = ? WHERE id = ?", [fromSlot, toMonster.id]);
  }

  await db.query("UPDATE monsters SET party_slot = ? WHERE id = ?", [toSlot, fromMonster.id]);
  return getParty(playerId);
}

async function setPartyLead(playerId, slot) {
  return swapPartySlots(playerId, slot, 1);
}

async function moveBoxMonsterToParty(playerId, monsterId, slot) {
  const targetMonster = await getMonsterById(monsterId);

  if (!targetMonster || targetMonster.owner_id !== playerId) {
    throw new Error("That boxed monster does not belong to you.");
  }

  const normalizedSlot = Number(slot);
  if (!Number.isInteger(normalizedSlot) || normalizedSlot < 1 || normalizedSlot > 6) {
    throw new Error("Party slots must be between 1 and 6.");
  }

  if (Number.isInteger(targetMonster.party_slot) && targetMonster.party_slot >= 1 && targetMonster.party_slot <= 6) {
    throw new Error("That monster is already in your party.");
  }

  const [occupants] = await db.query(
    "SELECT id FROM monsters WHERE owner_id = ? AND party_slot = ?",
    [playerId, normalizedSlot]
  );

  if (occupants[0]) {
    await db.query("UPDATE monsters SET party_slot = NULL WHERE id = ?", [occupants[0].id]);
  }

  await db.query("UPDATE monsters SET party_slot = ? WHERE id = ?", [normalizedSlot, monsterId]);
  return getParty(playerId);
}

async function depositPartyMonsterToBox(playerId, monsterId) {
  const targetMonster = await getMonsterById(monsterId);

  if (!targetMonster || targetMonster.owner_id !== playerId) {
    throw new Error("That party monster does not belong to you.");
  }

  if (!Number.isInteger(targetMonster.party_slot) || targetMonster.party_slot < 1 || targetMonster.party_slot > 6) {
    throw new Error("That monster is already in storage.");
  }

  const party = await getParty(playerId);
  if (party.length <= 1) {
    throw new Error("You must keep at least one monster in your active party.");
  }

  await db.query("UPDATE monsters SET party_slot = NULL WHERE id = ?", [monsterId]);
  await ensurePartyAssignments(playerId);

  return {
    party: await getParty(playerId),
    box: await getBox(playerId)
  };
}

async function updateMonsterMoveSlot(playerId, monsterId, slot, moveKey) {
  const monster = await getMonsterById(monsterId);

  if (!monster || monster.owner_id !== playerId) {
    throw new Error("That monster does not belong to you.");
  }

  const normalizedSlot = Number(slot);
  if (!Number.isInteger(normalizedSlot) || normalizedSlot < 1 || normalizedSlot > 4) {
    throw new Error("Move slots must be between 1 and 4.");
  }

  const normalizedMoveKey = String(moveKey).toLowerCase();
  const learnedMove = monster.learnedMoves.find(move => move.key === normalizedMoveKey);

  if (!learnedMove) {
    throw new Error("That move has not been learned by this monster yet.");
  }

  const nextActiveMoveKeys = sanitizeActiveMoveKeys(
    monster.species,
    monster.level,
    monster.moves.map(move => move.key)
  );
  const existingIndex = nextActiveMoveKeys.indexOf(normalizedMoveKey);

  if (existingIndex >= 0) {
    nextActiveMoveKeys.splice(existingIndex, 1);
  }

  while (nextActiveMoveKeys.length < normalizedSlot - 1) {
    const filler = monster.learnedMoves.find(move => !nextActiveMoveKeys.includes(move.key) && move.key !== normalizedMoveKey);
    if (!filler) {
      break;
    }

    nextActiveMoveKeys.push(filler.key);
  }

  nextActiveMoveKeys[normalizedSlot - 1] = normalizedMoveKey;
  const sanitizedKeys = sanitizeActiveMoveKeys(monster.species, monster.level, nextActiveMoveKeys);

  await db.query("UPDATE monsters SET moves_json = ? WHERE id = ?", [JSON.stringify(sanitizedKeys), monster.id]);
  return getMonsterById(monster.id);
}

function normalizeNicknameInput(nickname) {
  const normalized = String(nickname || "").trim().replace(/\s+/g, " ");

  if (!normalized) {
    return null;
  }

  if (normalized.length > 24) {
    throw new Error("Nicknames must be 24 characters or fewer.");
  }

  if (!/^[A-Za-z0-9 ._'-]+$/.test(normalized)) {
    throw new Error("Nicknames can only use letters, numbers, spaces, periods, underscores, apostrophes, and hyphens.");
  }

  return normalized;
}

async function updateMonsterNickname(playerId, monsterId, nickname) {
  const monster = await getMonsterById(monsterId);

  if (!monster || monster.owner_id !== playerId) {
    throw new Error("That monster does not belong to you.");
  }

  const normalizedNickname = normalizeNicknameInput(nickname);
  await db.query("UPDATE monsters SET nickname = ? WHERE id = ?", [normalizedNickname, monster.id]);

  return getMonsterById(monster.id);
}

async function evolveMonster(monsterId, trigger = {}) {
  const monster = await getMonsterById(monsterId);
  if (!monster) {
    return null;
  }

  const evolution = getTriggeredEvolution(monster.species, trigger);
  if (!evolution) {
    return null;
  }

  const previousSpecies = monster.species;
  const previousStats = {
    max_hp: monster.max_hp,
    attack: monster.attack,
    defense: monster.defense,
    speed: monster.speed
  };
  const nextSpecies = evolution.species;
  const nextStats = calculateStats(nextSpecies, monster.level, {
    potential: monster.potential,
    training: monster.training,
    personalityKey: monster.personalityKey
  });
  const hpGain = nextStats.max_hp - monster.max_hp;
  const nextHp = Math.max(1, Math.min(nextStats.max_hp, monster.current_hp + hpGain));
  const nextNickname = monster.hasCustomNickname ? monster.customNickname : null;
  const nextActiveMoveKeys = sanitizeActiveMoveKeys(nextSpecies, monster.level, monster.moves.map(move => move.key));

  await db.query(
    `
      UPDATE monsters
      SET species = ?, nickname = ?, current_hp = ?, max_hp = ?, attack = ?, defense = ?, speed = ?, moves_json = ?
      WHERE id = ?
    `,
    [
      nextSpecies,
      nextNickname,
      nextHp,
      nextStats.max_hp,
      nextStats.attack,
      nextStats.defense,
      nextStats.speed,
      JSON.stringify(nextActiveMoveKeys),
      monster.id
    ]
  );

  const updatedMonster = await getMonsterById(monster.id);

  return {
    triggerMethod: evolution.method,
    triggerItemKey: evolution.itemKey || trigger.itemKey || null,
    triggerLevel: evolution.level || trigger.level || null,
    oldSpecies: previousSpecies,
    newSpecies: updatedMonster.species,
    oldStats: previousStats,
    newStats: {
      max_hp: updatedMonster.max_hp,
      attack: updatedMonster.attack,
      defense: updatedMonster.defense,
      speed: updatedMonster.speed
    },
    statGains: {
      max_hp: updatedMonster.max_hp - previousStats.max_hp,
      attack: updatedMonster.attack - previousStats.attack,
      defense: updatedMonster.defense - previousStats.defense,
      speed: updatedMonster.speed - previousStats.speed
    },
    monster: updatedMonster
  };
}

async function evolveMonsterWithItem(playerId, monsterId, itemKey) {
  const monster = await getMonsterById(monsterId);

  if (!monster || monster.owner_id !== playerId) {
    throw new Error("That monster does not belong to you.");
  }

  const evolution = await evolveMonster(monster.id, {
    method: "item",
    itemKey
  });

  if (!evolution) {
    const item = getItem(itemKey);
    throw new Error(`${monster.nickname} cannot use ${item?.name || itemKey} right now.`);
  }

  return evolution;
}

async function awardTraining(monsterId, trainingGain) {
  const monster = await getMonsterById(monsterId);
  if (!monster) {
    return null;
  }

  const oldTraining = normalizeStatProfile(monster.training, TRAINING_CAP_PER_STAT);
  const { nextTraining, appliedTraining } = applyTrainingGain(oldTraining, trainingGain);

  await db.query("UPDATE monsters SET training_json = ? WHERE id = ?", [JSON.stringify(nextTraining), monster.id]);
  const updatedMonster = await getMonsterById(monster.id);

  return {
    monster: updatedMonster,
    oldTraining,
    newTraining: nextTraining,
    appliedTraining,
    gainedTotal: getTrainingTotal(appliedTraining)
  };
}

async function captureMonster(playerId, enemyMonster) {
  const party = await getParty(playerId);
  const availableSlot = [1, 2, 3, 4, 5, 6].find(slot => !party.some(monster => monster.party_slot === slot)) || null;

  const created = await createMonster({
    ownerId: playerId,
    species: enemyMonster.species,
    level: enemyMonster.level,
    partySlot: availableSlot,
    gender: enemyMonster.gender,
    personalityKey: enemyMonster.personalityKey
  });

  return {
    monster: created,
    location: availableSlot ? "party" : "box"
  };
}

async function awardExperience(monsterId, experienceGain) {
  const monster = await getMonsterById(monsterId);
  if (!monster) {
    return null;
  }

  const startingLevel = monster.level;
  const nextExperience = monster.experience + experienceGain;
  let nextLevel = monster.level;
  const oldStats = {
    max_hp: monster.max_hp,
    attack: monster.attack,
    defense: monster.defense,
    speed: monster.speed
  };
  const oldActiveMoves = monster.moves.map(move => summarizeMove(move));

  while (nextExperience >= experienceForLevel(nextLevel + 1)) {
    nextLevel += 1;
  }

  const nextStats = calculateStats(monster.species, nextLevel, {
    potential: monster.potential,
    training: monster.training,
    personalityKey: monster.personalityKey
  });
  const hpGain = nextStats.max_hp - monster.max_hp;
  const nextHp = Math.max(1, Math.min(nextStats.max_hp, monster.current_hp + hpGain));

  await db.query(
    `
      UPDATE monsters
      SET experience = ?, level = ?, current_hp = ?, max_hp = ?, attack = ?, defense = ?, speed = ?
      WHERE id = ?
    `,
    [
      nextExperience,
      nextLevel,
      nextHp,
      nextStats.max_hp,
      nextStats.attack,
      nextStats.defense,
      nextStats.speed,
      monster.id
    ]
  );

  const leveledMonster = await getMonsterById(monster.id);
  const evolution = await evolveMonster(monster.id, {
    method: "level",
    level: nextLevel
  });
  const nextMonster = evolution?.monster || leveledMonster;
  const newActiveMoves = nextMonster.moves.map(move => summarizeMove(move));
  const oldActiveMoveKeys = new Set(oldActiveMoves.map(move => move.key));
  const newActiveMoveKeys = new Set(newActiveMoves.map(move => move.key));
  const learnedMoves = getMovesLearnedBetweenLevels(monster.species, startingLevel, nextLevel);

  return {
    monster: nextMonster,
    oldLevel: startingLevel,
    newLevel: nextLevel,
    gainedLevels: nextLevel - startingLevel,
    experienceGain,
    oldStats,
    newStats: {
      max_hp: nextMonster.max_hp,
      attack: nextMonster.attack,
      defense: nextMonster.defense,
      speed: nextMonster.speed
    },
    statGains: {
      max_hp: nextMonster.max_hp - oldStats.max_hp,
      attack: nextMonster.attack - oldStats.attack,
      defense: nextMonster.defense - oldStats.defense,
      speed: nextMonster.speed - oldStats.speed
    },
    evolution,
    learnedMoves,
    moveSetChanges: {
      activeBefore: oldActiveMoves,
      activeAfter: newActiveMoves,
      activeAdded: newActiveMoves.filter(move => !oldActiveMoveKeys.has(move.key)),
      activeRemoved: oldActiveMoves.filter(move => !newActiveMoveKeys.has(move.key))
    }
  };
}

module.exports = {
  awardTraining,
  awardExperience,
  calculateStats,
  captureMonster,
  evolveMonster,
  evolveMonsterWithItem,
  experienceForLevel,
  getBox,
  getFirstHealthyPartyMonster,
  getMonsterById,
  getParty,
  getPlayerMonsters,
  getTrainingYieldForParty,
  giveStarter,
  healParty,
  hydrateMonster,
  buildMonsterIdentity,
  depositPartyMonsterToBox,
  moveBoxMonsterToParty,
  setMonsterHp,
  setPartyLead,
  swapPartySlots,
  updateMonsterNickname,
  updateMonsterMoveSlot
};
