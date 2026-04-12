const starterMoves = [
  { key: "tackle", name: "Tackle", type: "Normal", power: 40, accuracy: 100, priority: 0 },
  { key: "quick_attack", name: "Quick Attack", type: "Normal", power: 40, accuracy: 100, priority: 1 },
  { key: "body_check", name: "Body Check", type: "Normal", power: 50, accuracy: 95, priority: 0 },
  { key: "ember", name: "Ember", type: "Fire", power: 40, accuracy: 100, priority: 0 },
  { key: "flare_bite", name: "Flare Bite", type: "Fire", power: 55, accuracy: 95, priority: 0 },
  { key: "bubble_jet", name: "Bubble Jet", type: "Water", power: 40, accuracy: 100, priority: 0 },
  { key: "water_pulse", name: "Water Pulse", type: "Water", power: 50, accuracy: 100, priority: 0 },
  { key: "vine_whip", name: "Vine Whip", type: "Grass", power: 45, accuracy: 100, priority: 0 },
  { key: "leaf_blade", name: "Leaf Blade", type: "Grass", power: 55, accuracy: 95, priority: 0 },
  { key: "needle_jab", name: "Needle Jab", type: "Grass", power: 45, accuracy: 100, priority: 0 },
  { key: "spark", name: "Spark", type: "Electric", power: 45, accuracy: 100, priority: 0 },
  { key: "rock_toss", name: "Rock Toss", type: "Rock", power: 50, accuracy: 95, priority: 0 }
];

const generatedMoveNames = {
  Normal: [
    "Headbutt",
    "Double Tap",
    "Pounce",
    "Feint Jab",
    "Dash Strike",
    "Tail Slam",
    "Rally Kick",
    "Wild Rush",
    "Vault Hit",
    "Cross Chop",
    "Barrage Peck",
    "Rushdown",
    "Knuckle Pop",
    "Skybound Slam",
    "Echo Strike",
    "Comet Tackle",
    "Flash Step",
    "Crush Claw",
    "Rapid Ram",
    "Finale Blow"
  ],
  Fire: [
    "Cinder Shot",
    "Flame Wheel",
    "Heat Burst",
    "Ash Swipe",
    "Sear Fang",
    "Magma Toss",
    "Ember Dash",
    "Inferno Kick",
    "Blaze Burst",
    "Fire Lash",
    "Coal Crash",
    "Sunflare",
    "Burnout",
    "Char Claw",
    "Pyro Jab",
    "Volcano Drive"
  ],
  Water: [
    "Aqua Dart",
    "Mist Spray",
    "Torrent Tail",
    "Brine Snap",
    "Wave Crash",
    "Bubble Burst",
    "Current Cut",
    "Rain Pulse",
    "Tidal Slam",
    "Jetstream",
    "Riptide Bite",
    "Foam Jab",
    "Harbor Crash",
    "Geyser Shot",
    "Deep Surge",
    "Cascade Kick"
  ],
  Grass: [
    "Seed Shot",
    "Petal Slice",
    "Thorn Burst",
    "Moss Punch",
    "Root Lash",
    "Sprout Dash",
    "Bloom Burst",
    "Viper Vine",
    "Razor Fern",
    "Sap Strike",
    "Canopy Crash",
    "Pollen Puff",
    "Briar Bash",
    "Grove Grip",
    "Meadow Slice",
    "Ivy Surge"
  ],
  Electric: [
    "Static Snap",
    "Volt Jab",
    "Spark Fang",
    "Charge Pulse",
    "Neon Strike",
    "Thunder Peck",
    "Arc Shot",
    "Flash Kick",
    "Current Crash",
    "Plasma Burst",
    "Bolt Blade",
    "Amp Bash",
    "Surge Dash",
    "Livewire Lash",
    "Storm Shock",
    "Ion Slam"
  ],
  Rock: [
    "Pebble Shot",
    "Stone Slam",
    "Gravel Bash",
    "Crag Crush",
    "Boulder Roll",
    "Quarry Chop",
    "Shard Burst",
    "Canyon Crash",
    "Ridge Ram",
    "Basalt Break",
    "Fossil Fang",
    "Marble Jab",
    "Meteor Toss",
    "Dust Drive",
    "Slate Slice",
    "Terra Crash"
  ]
};

const moveTypeOffsets = {
  Normal: 0,
  Fire: 1,
  Water: 2,
  Grass: 3,
  Electric: 4,
  Rock: 5
};

function toMoveKey(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function createGeneratedMoves() {
  const generated = [];

  for (const [type, names] of Object.entries(generatedMoveNames)) {
    names.forEach((name, index) => {
      const cycle = index % 8;
      let power = 42 + (cycle * 4) + moveTypeOffsets[type];
      let accuracy = 100 - ((index % 5) * 2);
      let priority = 0;

      if (
        (type === "Normal" && (name === "Feint Jab" || name === "Flash Step")) ||
        (type === "Fire" && name === "Ember Dash") ||
        (type === "Water" && name === "Jetstream") ||
        (type === "Grass" && name === "Sprout Dash") ||
        (type === "Electric" && name === "Surge Dash")
      ) {
        priority = 1;
      }

      if (type === "Rock" && name === "Boulder Roll") {
        priority = -1;
      }

      if (["Skybound Slam", "Volcano Drive", "Deep Surge", "Ivy Surge", "Ion Slam", "Terra Crash"].includes(name)) {
        power += 12;
        accuracy -= 4;
      }

      if (["Blaze Burst", "Wave Crash", "Bloom Burst", "Plasma Burst", "Shard Burst"].includes(name)) {
        power += 6;
        accuracy -= 2;
      }

      generated.push({
        key: toMoveKey(name),
        name,
        type,
        power,
        accuracy,
        priority
      });
    });
  }

  return generated;
}

const moves = [...starterMoves, ...createGeneratedMoves()];

const starterSpecies = [
  {
    name: "Flameling",
    types: ["Fire"],
    catchRate: 0.34,
    baseExp: 42,
    baseStats: { hp: 45, attack: 60, defense: 43, speed: 65 },
    learnset: [
      { level: 1, move: "Tackle" },
      { level: 1, move: "Ember" },
      { level: 7, move: "Quick Attack" },
      { level: 10, move: "Flare Bite" }
    ]
  },
  {
    name: "Squirtie",
    types: ["Water"],
    catchRate: 0.34,
    baseExp: 40,
    baseStats: { hp: 54, attack: 50, defense: 60, speed: 48 },
    learnset: [
      { level: 1, move: "Tackle" },
      { level: 1, move: "Bubble Jet" },
      { level: 7, move: "Water Pulse" },
      { level: 10, move: "Quick Attack" }
    ]
  },
  {
    name: "Leafy",
    types: ["Grass"],
    catchRate: 0.35,
    baseExp: 41,
    baseStats: { hp: 50, attack: 52, defense: 52, speed: 45 },
    learnset: [
      { level: 1, move: "Tackle" },
      { level: 1, move: "Vine Whip" },
      { level: 7, move: "Quick Attack" },
      { level: 10, move: "Leaf Blade" }
    ]
  },
  {
    name: "Nibbloon",
    types: ["Normal"],
    catchRate: 0.5,
    baseExp: 31,
    baseStats: { hp: 52, attack: 48, defense: 44, speed: 58 },
    learnset: [
      { level: 1, move: "Tackle" },
      { level: 4, move: "Quick Attack" },
      { level: 8, move: "Body Check" }
    ]
  },
  {
    name: "Pebblit",
    types: ["Rock"],
    catchRate: 0.3,
    baseExp: 45,
    baseStats: { hp: 56, attack: 60, defense: 64, speed: 32 },
    learnset: [
      { level: 1, move: "Tackle" },
      { level: 4, move: "Rock Toss" },
      { level: 8, move: "Body Check" }
    ]
  },
  {
    name: "Buzzlet",
    types: ["Electric"],
    catchRate: 0.33,
    baseExp: 39,
    baseStats: { hp: 42, attack: 54, defense: 40, speed: 68 },
    learnset: [
      { level: 1, move: "Tackle" },
      { level: 1, move: "Spark" },
      { level: 7, move: "Quick Attack" }
    ]
  },
  {
    name: "Thornlet",
    types: ["Grass"],
    catchRate: 0.28,
    baseExp: 47,
    baseStats: { hp: 58, attack: 60, defense: 50, speed: 42 },
    learnset: [
      { level: 1, move: "Tackle" },
      { level: 1, move: "Needle Jab" },
      { level: 8, move: "Leaf Blade" }
    ]
  }
];

const supportMovePools = {
  Normal: ["Tackle", "Headbutt", "Quick Attack", "Double Tap", "Body Check", "Feint Jab", "Dash Strike", "Tail Slam"],
  Fire: ["Ember", "Cinder Shot", "Flame Wheel", "Heat Burst", "Ash Swipe", "Sear Fang", "Ember Dash", "Inferno Kick", "Blaze Burst", "Fire Lash"],
  Water: ["Bubble Jet", "Aqua Dart", "Mist Spray", "Torrent Tail", "Brine Snap", "Wave Crash", "Current Cut", "Tidal Slam", "Jetstream"],
  Grass: ["Vine Whip", "Seed Shot", "Petal Slice", "Thorn Burst", "Root Lash", "Bloom Burst", "Razor Fern", "Pollen Puff"],
  Electric: ["Spark", "Static Snap", "Volt Jab", "Spark Fang", "Charge Pulse", "Neon Strike", "Arc Shot", "Surge Dash"],
  Rock: ["Rock Toss", "Pebble Shot", "Stone Slam", "Gravel Bash", "Crag Crush", "Shard Burst", "Meteor Toss", "Slate Slice"]
};

const speciesFamilies = {
  Fire: {
    names: [
      ["Cindercub"],
      ["Ashmunk", "Normal"],
      ["Brimtail"],
      ["Scorchick"],
      ["Magmole", "Rock"],
      ["Pyruff"],
      ["Emberoo", "Normal"],
      ["Coalimp", "Rock"],
      ["Flinta", "Electric"],
      ["Sizzlepup"]
    ],
    baseStats: { hp: 47, attack: 59, defense: 44, speed: 60 },
    baseExp: 39,
    catchRate: 0.33,
    moves: ["Ember", "Cinder Shot", "Flame Wheel", "Heat Burst", "Ash Swipe", "Sear Fang", "Magma Toss", "Ember Dash", "Inferno Kick", "Blaze Burst", "Fire Lash", "Volcano Drive"]
  },
  Water: {
    names: [
      ["Drizzlefin"],
      ["Brooklit", "Normal"],
      ["Tidepaw"],
      ["Splashroo"],
      ["Reefin", "Rock"],
      ["Dewhopper"],
      ["Currenttle", "Electric"],
      ["Ripplet"],
      ["Geyserkit", "Rock"],
      ["Misttail", "Normal"]
    ],
    baseStats: { hp: 54, attack: 51, defense: 58, speed: 46 },
    baseExp: 38,
    catchRate: 0.35,
    moves: ["Bubble Jet", "Aqua Dart", "Mist Spray", "Torrent Tail", "Brine Snap", "Wave Crash", "Current Cut", "Rain Pulse", "Tidal Slam", "Jetstream", "Deep Surge", "Cascade Kick"]
  },
  Grass: {
    names: [
      ["Mossprig"],
      ["Budroo", "Normal"],
      ["Fernibble"],
      ["Cloverel"],
      ["Saplingo", "Rock"],
      ["Bramblet"],
      ["Petalynx", "Normal"],
      ["Rootle"],
      ["Meadowlup", "Electric"],
      ["Bloomunk"]
    ],
    baseStats: { hp: 51, attack: 53, defense: 53, speed: 46 },
    baseExp: 40,
    catchRate: 0.36,
    moves: ["Vine Whip", "Seed Shot", "Petal Slice", "Thorn Burst", "Moss Punch", "Root Lash", "Bloom Burst", "Razor Fern", "Sap Strike", "Pollen Puff", "Ivy Surge", "Leaf Blade"]
  },
  Electric: {
    names: [
      ["Zappit"],
      ["Staticub", "Normal"],
      ["Voltrill"],
      ["Ampfin", "Water"],
      ["Sparkit"],
      ["Neonet"],
      ["Flashare", "Fire"],
      ["Wiremunk"],
      ["Boltad", "Rock"],
      ["Lumibbit"]
    ],
    baseStats: { hp: 43, attack: 56, defense: 41, speed: 66 },
    baseExp: 39,
    catchRate: 0.32,
    moves: ["Spark", "Static Snap", "Volt Jab", "Spark Fang", "Charge Pulse", "Neon Strike", "Arc Shot", "Flash Kick", "Plasma Burst", "Bolt Blade", "Surge Dash", "Ion Slam"]
  },
  Rock: {
    names: [
      ["Graveling"],
      ["Cragoon", "Normal"],
      ["Bouldimp"],
      ["Flintusk", "Fire"],
      ["Quarryn"],
      ["Slateet"],
      ["Dusthorn", "Grass"],
      ["Basalisk"],
      ["Pebbluff", "Water"],
      ["Terrail"]
    ],
    baseStats: { hp: 58, attack: 61, defense: 63, speed: 34 },
    baseExp: 43,
    catchRate: 0.29,
    moves: ["Rock Toss", "Pebble Shot", "Stone Slam", "Gravel Bash", "Crag Crush", "Quarry Chop", "Shard Burst", "Canyon Crash", "Basalt Break", "Meteor Toss", "Slate Slice", "Terra Crash"]
  }
};

const learnsetLevels = [1, 1, 6, 10, 14, 18];

function clampCatchRate(value) {
  return Number(Math.max(0.22, Math.min(0.58, value)).toFixed(2));
}

function createGeneratedSpecies() {
  const generated = [];

  for (const [primaryType, family] of Object.entries(speciesFamilies)) {
    family.names.forEach((entry, index) => {
      const [name, secondaryType] = entry;
      const types = secondaryType ? [primaryType, secondaryType] : [primaryType];
      const learnsetMoves = ["Tackle", family.moves[index % family.moves.length]];

      if (secondaryType) {
        const secondaryPool = supportMovePools[secondaryType];
        learnsetMoves.push(secondaryPool[(index + 1) % secondaryPool.length]);
        learnsetMoves.push(family.moves[(index + 3) % family.moves.length]);
        learnsetMoves.push(secondaryPool[(index + 4) % secondaryPool.length]);
      } else {
        learnsetMoves.push("Quick Attack");
        learnsetMoves.push(family.moves[(index + 3) % family.moves.length]);
        learnsetMoves.push(supportMovePools.Normal[(index + 4) % supportMovePools.Normal.length]);
      }

      learnsetMoves.push(family.moves[(index + 7) % family.moves.length]);

      generated.push({
        name,
        types,
        catchRate: clampCatchRate(family.catchRate - ((index % 3) * 0.02) + (secondaryType === "Normal" ? 0.04 : 0)),
        baseExp: family.baseExp + ((index % 4) * 3) + (secondaryType ? 2 : 0),
        baseStats: {
          hp: family.baseStats.hp + ((index % 4) * 2) + (secondaryType === "Rock" ? 2 : 0) - (secondaryType === "Electric" ? 1 : 0),
          attack: family.baseStats.attack + ((index % 5) * 2) + (secondaryType === "Fire" ? 2 : 0),
          defense: family.baseStats.defense + (((index + 2) % 4) * 2) + (secondaryType === "Rock" ? 4 : 0) - (secondaryType === "Normal" ? 1 : 0),
          speed: family.baseStats.speed + (((index + 1) % 5) * 2) + (secondaryType === "Electric" ? 3 : 0) - (secondaryType === "Rock" ? 4 : 0)
        },
        learnset: learnsetMoves.map((move, moveIndex) => ({
          level: learnsetLevels[moveIndex],
          move
        }))
      });
    });
  }

  return generated;
}

const species = [...starterSpecies, ...createGeneratedSpecies()];

const encounters = [
  { area: "Starter Plains", species: "Nibbloon", minLevel: 3, maxLevel: 5, weight: 18 },
  { area: "Starter Plains", species: "Cindercub", minLevel: 4, maxLevel: 6, weight: 10 },
  { area: "Starter Plains", species: "Mossprig", minLevel: 4, maxLevel: 6, weight: 10 },
  { area: "Starter Plains", species: "Drizzlefin", minLevel: 4, maxLevel: 6, weight: 10 },
  { area: "Starter Plains", species: "Zappit", minLevel: 4, maxLevel: 6, weight: 9 },
  { area: "Starter Plains", species: "Graveling", minLevel: 5, maxLevel: 7, weight: 8 },
  { area: "Starter Plains", species: "Ashmunk", minLevel: 5, maxLevel: 7, weight: 7 },
  { area: "Starter Plains", species: "Brooklit", minLevel: 5, maxLevel: 7, weight: 7 },
  { area: "Starter Plains", species: "Budroo", minLevel: 5, maxLevel: 7, weight: 7 },
  { area: "Starter Plains", species: "Staticub", minLevel: 5, maxLevel: 7, weight: 7 },
  { area: "Starter Plains", species: "Cragoon", minLevel: 5, maxLevel: 7, weight: 6 },
  { area: "Starter Plains", species: "Brimtail", minLevel: 6, maxLevel: 8, weight: 5 },
  { area: "Starter Plains", species: "Tidepaw", minLevel: 6, maxLevel: 8, weight: 5 },
  { area: "Starter Plains", species: "Fernibble", minLevel: 6, maxLevel: 8, weight: 5 },
  { area: "Starter Plains", species: "Voltrill", minLevel: 6, maxLevel: 8, weight: 5 },
  { area: "Starter Plains", species: "Bouldimp", minLevel: 6, maxLevel: 8, weight: 4 }
];

const trainers = [
  {
    name: "Bug Catcher Milo",
    rewardMoney: 180,
    team: [
      { species: "Nibbloon", level: 4 },
      { species: "Mossprig", level: 5 }
    ]
  },
  {
    name: "Scout Rhea",
    rewardMoney: 220,
    team: [
      { species: "Zappit", level: 5 },
      { species: "Cindercub", level: 5 }
    ]
  },
  {
    name: "Hiker Moss",
    rewardMoney: 260,
    team: [
      { species: "Graveling", level: 6 },
      { species: "Dusthorn", level: 6 }
    ]
  },
  {
    name: "Picnicker June",
    rewardMoney: 210,
    team: [
      { species: "Brooklit", level: 5 },
      { species: "Budroo", level: 5 }
    ]
  },
  {
    name: "Courier Flint",
    rewardMoney: 240,
    team: [
      { species: "Brimtail", level: 6 },
      { species: "Staticub", level: 6 }
    ]
  },
  {
    name: "Gardener Wren",
    rewardMoney: 250,
    team: [
      { species: "Fernibble", level: 6 },
      { species: "Bloomunk", level: 7 }
    ]
  },
  {
    name: "Deckhand Cove",
    rewardMoney: 280,
    team: [
      { species: "Tidepaw", level: 6 },
      { species: "Ampfin", level: 7 }
    ]
  },
  {
    name: "Ranger Volt",
    rewardMoney: 300,
    team: [
      { species: "Voltrill", level: 7 },
      { species: "Boltad", level: 7 }
    ]
  }
];

module.exports = {
  encounters,
  moves,
  species,
  trainers
};
