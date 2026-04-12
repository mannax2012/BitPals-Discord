const { moves, species: baseSpecies } = require("../data/contentFactory");
const { evolvedSpecies, evolutionRules } = require("../data/evolutionData");
const { areas, encounters, trainers } = require("../data/worldData");
const gyms = require("../data/gyms.json");
const items = require("../data/items.json");

function normalizeLookupToken(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const species = [...baseSpecies, ...evolvedSpecies].map(entry => ({
  ...entry,
  evolutions: evolutionRules[entry.name] || entry.evolutions || []
}));

const speciesMap = new Map(species.map(entry => [entry.name.toLowerCase(), entry]));
const moveMap = new Map(moves.map(entry => [entry.key, entry]));
const moveNameMap = new Map(moves.map(entry => [entry.name.toLowerCase(), entry]));
const itemMap = new Map(items.map(entry => [entry.key, entry]));
const itemNameMap = new Map(items.flatMap(entry => [
  [normalizeLookupToken(entry.key), entry],
  [normalizeLookupToken(entry.name), entry],
  ...(entry.aliases || []).map(alias => [normalizeLookupToken(alias), entry])
]));
const gymMap = new Map(gyms.map(entry => [entry.key, entry]));
const areaKeyMap = new Map(areas.map(entry => [entry.key, entry]));
const areaNameMap = new Map(areas.map(entry => [normalizeAreaInput(entry.name), entry]));
const STARTER_OPTIONS = [
  {
    species: "Flameling",
    theme: "Fire",
    aliases: ["flameling", "fire"],
    description: "A fast, aggressive starter that leans into early Fire damage."
  },
  {
    species: "Squirtie",
    theme: "Water",
    aliases: ["squirtie", "water"],
    description: "A steady Water starter with balanced stats and dependable matchups."
  },
  {
    species: "Leafy",
    theme: "Grass",
    aliases: ["leafy", "grass"],
    description: "A resilient Grass starter that rewards longer fights and steady growth."
  }
];

const TYPE_CHART = {
  Normal: {},
  Fire: {
    Fire: 0.5,
    Water: 0.5,
    Grass: 2,
    Rock: 0.5
  },
  Water: {
    Fire: 2,
    Water: 0.5,
    Grass: 0.5,
    Rock: 2
  },
  Grass: {
    Fire: 0.5,
    Water: 2,
    Grass: 0.5,
    Rock: 2
  },
  Electric: {
    Water: 2,
    Grass: 0.5,
    Electric: 0.5,
    Rock: 1
  },
  Rock: {
    Fire: 2,
    Electric: 2,
    Water: 0.5,
    Grass: 0.5,
    Rock: 0.5
  }
};

function getSpecies(name) {
  return speciesMap.get(String(name).toLowerCase());
}

function getMove(keyOrName) {
  return moveMap.get(String(keyOrName)) || moveNameMap.get(String(keyOrName).toLowerCase());
}

function getItem(key) {
  return itemMap.get(String(key)) || itemNameMap.get(normalizeLookupToken(key));
}

function canAccessItem(player, itemOrKey) {
  const item = typeof itemOrKey === "object" ? itemOrKey : getItem(itemOrKey);
  if (!item) {
    return false;
  }

  return !item.requiredBadge || Boolean(player?.badges?.includes(item.requiredBadge));
}

function getItemUnlockText(itemOrKey) {
  const item = typeof itemOrKey === "object" ? itemOrKey : getItem(itemOrKey);
  if (!item?.requiredBadge) {
    return "Available from the start";
  }

  return `Requires ${item.requiredBadge}`;
}

function getShopItemsForPlayer(player) {
  return items.filter(item => canAccessItem(player, item));
}

function getLockedShopItemsForPlayer(player) {
  return items.filter(item => !canAccessItem(player, item));
}

function getGym(key) {
  return gymMap.get(key);
}

function normalizeAreaInput(value) {
  return normalizeLookupToken(value);
}

function normalizeItemInput(value) {
  return normalizeLookupToken(value);
}

function getDefaultArea() {
  return areas[0];
}

function getArea(keyOrName) {
  if (!keyOrName) {
    return getDefaultArea();
  }

  return areaKeyMap.get(String(keyOrName)) || areaNameMap.get(normalizeAreaInput(keyOrName)) || null;
}

function getAreas() {
  return [...areas];
}

function canAccessArea(player, areaOrKey) {
  const area = typeof areaOrKey === "object" ? areaOrKey : getArea(areaOrKey);
  if (!area) {
    return false;
  }

  return !area.requiredBadge || Boolean(player?.badges?.includes(area.requiredBadge));
}

function getUnlockedAreas(player) {
  return areas.filter(area => canAccessArea(player, area));
}

function getEvolutionOptions(speciesName) {
  return getSpecies(speciesName)?.evolutions || [];
}

function getNextEvolution(speciesName) {
  return getEvolutionOptions(speciesName)[0] || null;
}

function getTriggeredEvolution(speciesName, trigger = {}) {
  const method = String(trigger.method || "").toLowerCase();
  const options = getEvolutionOptions(speciesName);

  return options.find(option => {
    if (option.method !== method) {
      return false;
    }

    if (method === "level") {
      return Number(trigger.level) >= Number(option.level);
    }

    if (method === "item") {
      return normalizeItemInput(trigger.itemKey) === normalizeItemInput(option.itemKey);
    }

    return false;
  }) || null;
}

function getStarterOptions() {
  return STARTER_OPTIONS.map(option => ({
    ...option,
    data: getSpecies(option.species)
  }));
}

function getStarterSpecies(choice) {
  const normalized = normalizeLookupToken(choice);

  if (!normalized) {
    return null;
  }

  const starter = STARTER_OPTIONS.find(option =>
    option.aliases.some(alias => normalizeLookupToken(alias) === normalized)
    || normalizeLookupToken(option.species) === normalized
  );

  return starter?.species || null;
}

function getLearnedMoveEntries(speciesName, level) {
  const data = getSpecies(speciesName);

  if (!data) {
    return [];
  }

  const availableMoves = data.learnset
    .filter(entry => entry.level <= level)
    .map(entry => ({
      level: entry.level,
      move: getMove(entry.move)
    }))
    .filter(entry => entry.move);

  // Keep the latest learn event for duplicate moves.
  const deduped = [];
  const seen = new Set();

  for (let index = availableMoves.length - 1; index >= 0; index -= 1) {
    const entry = availableMoves[index];
    if (seen.has(entry.move.key)) {
      continue;
    }

    seen.add(entry.move.key);
    deduped.unshift(entry);
  }

  return deduped;
}

function getMovesForSpecies(speciesName, level) {
  const learnedMoves = getLearnedMoveEntries(speciesName, level).map(entry => entry.move);

  const recentMoves = learnedMoves.slice(-4);
  return recentMoves.length > 0 ? recentMoves : [getMove("tackle")];
}

function getTypeMultiplier(moveType, defenderTypes) {
  return defenderTypes.reduce((multiplier, defenderType) => {
    const table = TYPE_CHART[moveType] || {};
    return multiplier * (table[defenderType] || 1);
  }, 1);
}

function rollEncounter(areaKeyOrName = getDefaultArea().key) {
  const area = getArea(areaKeyOrName) || getDefaultArea();
  const areaEncounters = encounters.filter(entry => entry.areaKey === area.key);
  const pool = areaEncounters.length > 0 ? areaEncounters : encounters;
  const totalWeight = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) {
      return entry;
    }
  }

  return pool[pool.length - 1];
}

function randomLevel(minLevel, maxLevel) {
  return Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
}

function rollTrainerEncounter(areaKeyOrName = getDefaultArea().key) {
  const area = getArea(areaKeyOrName) || getDefaultArea();
  const pool = trainers.filter(entry => entry.areaKey === area.key);
  const trainerPool = pool.length > 0 ? pool : trainers;
  const totalWeight = trainerPool.reduce((sum, entry) => sum + (entry.weight || 1), 0);
  let roll = Math.random() * totalWeight;

  for (const trainer of trainerPool) {
    roll -= trainer.weight || 1;
    if (roll <= 0) {
      return trainer;
    }
  }

  return trainerPool[trainerPool.length - 1];
}

function getTypeColor(type) {
  const colors = {
    Fire: 0xe86b3c,
    Water: 0x3c82e8,
    Grass: 0x4ca64c,
    Electric: 0xe8c23c,
    Rock: 0x9f8b59,
    Normal: 0x7f8c8d
  };

  return colors[type] || 0x5865f2;
}

module.exports = {
  areas,
  canAccessArea,
  canAccessItem,
  encounters,
  getGym,
  getItem,
  getItemUnlockText,
  getArea,
  getAreas,
  getDefaultArea,
  getEvolutionOptions,
  getLearnedMoveEntries,
  getLockedShopItemsForPlayer,
  getMove,
  getMovesForSpecies,
  getNextEvolution,
  getShopItemsForPlayer,
  getSpecies,
  getStarterSpecies,
  getStarterOptions,
  getTriggeredEvolution,
  getTypeColor,
  getTypeMultiplier,
  gyms,
  items,
  moves,
  normalizeItemInput,
  normalizeAreaInput,
  randomLevel,
  rollEncounter,
  rollTrainerEncounter,
  species,
  trainers,
  getUnlockedAreas
};
