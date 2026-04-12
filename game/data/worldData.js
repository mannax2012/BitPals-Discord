const areas = [
  {
    key: "starter_plains",
    name: "Starter Plains",
    description: "A calm beginner route packed with mixed low-level BitPals and your first badge challenge.",
    requiredBadge: null,
    gymKey: "verdant_gym",
    trainerChance: 0.2,
    recommendedLevels: "2-8",
    isEndgame: false
  },
  {
    key: "tidebreak_coast",
    name: "Tidebreak Coast",
    description: "Salt spray, boardwalk trainers, and a strong Water-type circuit built around fast coastal monsters.",
    requiredBadge: "Bloom Badge",
    gymKey: "tidal_gym",
    trainerChance: 0.3,
    recommendedLevels: "8-14",
    isEndgame: false
  },
  {
    key: "cinder_ridge",
    name: "Cinder Ridge",
    description: "A scorched ridge full of Fire and Rock encounters where raw power starts to matter.",
    requiredBadge: "Tide Badge",
    gymKey: "ember_gym",
    trainerChance: 0.32,
    recommendedLevels: "12-18",
    isEndgame: false
  },
  {
    key: "voltspire_city",
    name: "Voltspire City",
    description: "Dense city lanes, rooftop circuits, and Electric specialists that push faster battle pacing.",
    requiredBadge: "Ember Badge",
    gymKey: "dynamo_gym",
    trainerChance: 0.34,
    recommendedLevels: "16-22",
    isEndgame: false
  },
  {
    key: "stonevault_canyon",
    name: "Stonevault Canyon",
    description: "A cracked canyon route with heavy Rock teams, bruisers, and sturdier wild encounters.",
    requiredBadge: "Volt Badge",
    gymKey: "quarry_gym",
    trainerChance: 0.34,
    recommendedLevels: "20-26",
    isEndgame: false
  },
  {
    key: "canopy_expanse",
    name: "Canopy Expanse",
    description: "A lush deep-forest stretch where Grass-themed teams gain durability and coverage.",
    requiredBadge: "Fault Badge",
    gymKey: "grove_gym",
    trainerChance: 0.35,
    recommendedLevels: "24-30",
    isEndgame: false
  },
  {
    key: "tempest_cape",
    name: "Tempest Cape",
    description: "Cliffside storms pull Water and Electric monsters together into a sharp late-game route.",
    requiredBadge: "Canopy Badge",
    gymKey: "tempest_gym",
    trainerChance: 0.36,
    recommendedLevels: "28-34",
    isEndgame: false
  },
  {
    key: "elite_seven_summit",
    name: "Elite Seven Summit",
    description: "The final climb before endgame. Only trainers with every regional badge can face the summit trial.",
    requiredBadge: "Storm Badge",
    gymKey: "elite_seven_citadel",
    trainerChance: 0.38,
    recommendedLevels: "32-38",
    isEndgame: false
  },
  {
    key: "astral_wilds",
    name: "Astral Wilds",
    description: "An endgame sanctuary filled with rare mixed-type monsters and higher baseline levels.",
    requiredBadge: "Apex Crest",
    gymKey: null,
    trainerChance: 0.4,
    recommendedLevels: "36-45",
    isEndgame: true
  },
  {
    key: "abyssal_depths",
    name: "Abyssal Depths",
    description: "A cold late-game cavern network loaded with rare Water, Rock, and Grass hybrids.",
    requiredBadge: "Apex Crest",
    gymKey: null,
    trainerChance: 0.4,
    recommendedLevels: "38-48",
    isEndgame: true
  },
  {
    key: "emberstorm_caldera",
    name: "Emberstorm Caldera",
    description: "A volatile volcanic endgame zone where Fire, Rock, and Electric species appear at peak rarity.",
    requiredBadge: "Apex Crest",
    gymKey: null,
    trainerChance: 0.42,
    recommendedLevels: "40-50",
    isEndgame: true
  }
];

const encounters = [
  { areaKey: "starter_plains", species: "Nibbloon", minLevel: 2, maxLevel: 4, weight: 24 },
  { areaKey: "starter_plains", species: "Mossprig", minLevel: 3, maxLevel: 5, weight: 13 },
  { areaKey: "starter_plains", species: "Drizzlefin", minLevel: 3, maxLevel: 5, weight: 13 },
  { areaKey: "starter_plains", species: "Cindercub", minLevel: 3, maxLevel: 5, weight: 11 },
  { areaKey: "starter_plains", species: "Zappit", minLevel: 3, maxLevel: 5, weight: 11 },
  { areaKey: "starter_plains", species: "Graveling", minLevel: 4, maxLevel: 6, weight: 7 },
  { areaKey: "starter_plains", species: "Ashmunk", minLevel: 4, maxLevel: 6, weight: 7 },
  { areaKey: "starter_plains", species: "Brooklit", minLevel: 4, maxLevel: 6, weight: 7 },
  { areaKey: "starter_plains", species: "Budroo", minLevel: 4, maxLevel: 6, weight: 7 },
  { areaKey: "starter_plains", species: "Staticub", minLevel: 4, maxLevel: 6, weight: 6 },
  { areaKey: "starter_plains", species: "Cragoon", minLevel: 4, maxLevel: 6, weight: 5 },
  { areaKey: "starter_plains", species: "Brimtail", minLevel: 5, maxLevel: 7, weight: 4 },
  { areaKey: "starter_plains", species: "Tidepaw", minLevel: 5, maxLevel: 7, weight: 4 },
  { areaKey: "starter_plains", species: "Fernibble", minLevel: 5, maxLevel: 7, weight: 4 },
  { areaKey: "starter_plains", species: "Voltrill", minLevel: 5, maxLevel: 7, weight: 4 },
  { areaKey: "starter_plains", species: "Bouldimp", minLevel: 5, maxLevel: 7, weight: 3 },

  { areaKey: "tidebreak_coast", species: "Brooklit", minLevel: 8, maxLevel: 10, weight: 18 },
  { areaKey: "tidebreak_coast", species: "Drizzlefin", minLevel: 8, maxLevel: 10, weight: 16 },
  { areaKey: "tidebreak_coast", species: "Tidepaw", minLevel: 9, maxLevel: 11, weight: 14 },
  { areaKey: "tidebreak_coast", species: "Ripplet", minLevel: 9, maxLevel: 12, weight: 12 },
  { areaKey: "tidebreak_coast", species: "Mossprig", minLevel: 8, maxLevel: 10, weight: 8 },
  { areaKey: "tidebreak_coast", species: "Currenttle", minLevel: 10, maxLevel: 12, weight: 8 },
  { areaKey: "tidebreak_coast", species: "Misttail", minLevel: 10, maxLevel: 12, weight: 7 },
  { areaKey: "tidebreak_coast", species: "Ampfin", minLevel: 11, maxLevel: 13, weight: 6 },
  { areaKey: "tidebreak_coast", species: "Pebbluff", minLevel: 11, maxLevel: 13, weight: 5 },
  { areaKey: "tidebreak_coast", species: "Geyserkit", minLevel: 12, maxLevel: 14, weight: 4 },

  { areaKey: "cinder_ridge", species: "Cindercub", minLevel: 12, maxLevel: 14, weight: 16 },
  { areaKey: "cinder_ridge", species: "Ashmunk", minLevel: 12, maxLevel: 14, weight: 14 },
  { areaKey: "cinder_ridge", species: "Brimtail", minLevel: 13, maxLevel: 15, weight: 13 },
  { areaKey: "cinder_ridge", species: "Scorchick", minLevel: 13, maxLevel: 16, weight: 10 },
  { areaKey: "cinder_ridge", species: "Graveling", minLevel: 12, maxLevel: 14, weight: 9 },
  { areaKey: "cinder_ridge", species: "Bouldimp", minLevel: 14, maxLevel: 16, weight: 8 },
  { areaKey: "cinder_ridge", species: "Coalimp", minLevel: 14, maxLevel: 17, weight: 7 },
  { areaKey: "cinder_ridge", species: "Flintusk", minLevel: 15, maxLevel: 17, weight: 6 },
  { areaKey: "cinder_ridge", species: "Flashare", minLevel: 15, maxLevel: 18, weight: 5 },
  { areaKey: "cinder_ridge", species: "Magmole", minLevel: 16, maxLevel: 18, weight: 4 },

  { areaKey: "voltspire_city", species: "Zappit", minLevel: 16, maxLevel: 18, weight: 15 },
  { areaKey: "voltspire_city", species: "Staticub", minLevel: 16, maxLevel: 18, weight: 14 },
  { areaKey: "voltspire_city", species: "Voltrill", minLevel: 17, maxLevel: 19, weight: 13 },
  { areaKey: "voltspire_city", species: "Sparkit", minLevel: 17, maxLevel: 20, weight: 10 },
  { areaKey: "voltspire_city", species: "Neonet", minLevel: 18, maxLevel: 20, weight: 9 },
  { areaKey: "voltspire_city", species: "Wiremunk", minLevel: 18, maxLevel: 21, weight: 8 },
  { areaKey: "voltspire_city", species: "Currenttle", minLevel: 18, maxLevel: 21, weight: 8 },
  { areaKey: "voltspire_city", species: "Flinta", minLevel: 19, maxLevel: 21, weight: 6 },
  { areaKey: "voltspire_city", species: "Ampfin", minLevel: 19, maxLevel: 21, weight: 5 },
  { areaKey: "voltspire_city", species: "Lumibbit", minLevel: 20, maxLevel: 22, weight: 4 },

  { areaKey: "stonevault_canyon", species: "Graveling", minLevel: 20, maxLevel: 22, weight: 15 },
  { areaKey: "stonevault_canyon", species: "Cragoon", minLevel: 20, maxLevel: 22, weight: 14 },
  { areaKey: "stonevault_canyon", species: "Bouldimp", minLevel: 21, maxLevel: 23, weight: 13 },
  { areaKey: "stonevault_canyon", species: "Quarryn", minLevel: 21, maxLevel: 24, weight: 10 },
  { areaKey: "stonevault_canyon", species: "Slateet", minLevel: 22, maxLevel: 24, weight: 9 },
  { areaKey: "stonevault_canyon", species: "Dusthorn", minLevel: 22, maxLevel: 25, weight: 8 },
  { areaKey: "stonevault_canyon", species: "Sparkit", minLevel: 22, maxLevel: 24, weight: 7 },
  { areaKey: "stonevault_canyon", species: "Flintusk", minLevel: 23, maxLevel: 25, weight: 6 },
  { areaKey: "stonevault_canyon", species: "Terrail", minLevel: 24, maxLevel: 26, weight: 5 },
  { areaKey: "stonevault_canyon", species: "Basalisk", minLevel: 24, maxLevel: 26, weight: 4 },

  { areaKey: "canopy_expanse", species: "Mossprig", minLevel: 24, maxLevel: 26, weight: 15 },
  { areaKey: "canopy_expanse", species: "Budroo", minLevel: 24, maxLevel: 26, weight: 14 },
  { areaKey: "canopy_expanse", species: "Fernibble", minLevel: 25, maxLevel: 27, weight: 13 },
  { areaKey: "canopy_expanse", species: "Cloverel", minLevel: 25, maxLevel: 28, weight: 10 },
  { areaKey: "canopy_expanse", species: "Bramblet", minLevel: 26, maxLevel: 28, weight: 9 },
  { areaKey: "canopy_expanse", species: "Rootle", minLevel: 26, maxLevel: 29, weight: 8 },
  { areaKey: "canopy_expanse", species: "Brooklit", minLevel: 25, maxLevel: 27, weight: 7 },
  { areaKey: "canopy_expanse", species: "Petalynx", minLevel: 27, maxLevel: 29, weight: 6 },
  { areaKey: "canopy_expanse", species: "Saplingo", minLevel: 27, maxLevel: 30, weight: 5 },
  { areaKey: "canopy_expanse", species: "Bloomunk", minLevel: 28, maxLevel: 30, weight: 4 },
  { areaKey: "canopy_expanse", species: "Meadowlup", minLevel: 28, maxLevel: 30, weight: 4 },

  { areaKey: "tempest_cape", species: "Voltrill", minLevel: 28, maxLevel: 30, weight: 14 },
  { areaKey: "tempest_cape", species: "Ampfin", minLevel: 28, maxLevel: 30, weight: 13 },
  { areaKey: "tempest_cape", species: "Currenttle", minLevel: 29, maxLevel: 31, weight: 12 },
  { areaKey: "tempest_cape", species: "Tidepaw", minLevel: 29, maxLevel: 31, weight: 10 },
  { areaKey: "tempest_cape", species: "Boltad", minLevel: 30, maxLevel: 32, weight: 9 },
  { areaKey: "tempest_cape", species: "Pebbluff", minLevel: 30, maxLevel: 32, weight: 8 },
  { areaKey: "tempest_cape", species: "Flashare", minLevel: 30, maxLevel: 33, weight: 6 },
  { areaKey: "tempest_cape", species: "Zappit", minLevel: 29, maxLevel: 31, weight: 6 },
  { areaKey: "tempest_cape", species: "Lumibbit", minLevel: 31, maxLevel: 34, weight: 5 },
  { areaKey: "tempest_cape", species: "Geyserkit", minLevel: 31, maxLevel: 34, weight: 4 },
  { areaKey: "tempest_cape", species: "Basalisk", minLevel: 32, maxLevel: 34, weight: 3 },

  { areaKey: "elite_seven_summit", species: "Brimtail", minLevel: 32, maxLevel: 34, weight: 10 },
  { areaKey: "elite_seven_summit", species: "Tidepaw", minLevel: 32, maxLevel: 34, weight: 10 },
  { areaKey: "elite_seven_summit", species: "Fernibble", minLevel: 33, maxLevel: 35, weight: 10 },
  { areaKey: "elite_seven_summit", species: "Voltrill", minLevel: 33, maxLevel: 35, weight: 10 },
  { areaKey: "elite_seven_summit", species: "Basalisk", minLevel: 34, maxLevel: 36, weight: 8 },
  { areaKey: "elite_seven_summit", species: "Flinta", minLevel: 34, maxLevel: 36, weight: 8 },
  { areaKey: "elite_seven_summit", species: "Ampfin", minLevel: 34, maxLevel: 36, weight: 8 },
  { areaKey: "elite_seven_summit", species: "Meadowlup", minLevel: 35, maxLevel: 37, weight: 6 },
  { areaKey: "elite_seven_summit", species: "Flashare", minLevel: 35, maxLevel: 37, weight: 5 },
  { areaKey: "elite_seven_summit", species: "Geyserkit", minLevel: 36, maxLevel: 38, weight: 5 },

  { areaKey: "astral_wilds", species: "Meadowlup", minLevel: 36, maxLevel: 40, weight: 11 },
  { areaKey: "astral_wilds", species: "Bloomunk", minLevel: 37, maxLevel: 41, weight: 10 },
  { areaKey: "astral_wilds", species: "Lumibbit", minLevel: 37, maxLevel: 41, weight: 10 },
  { areaKey: "astral_wilds", species: "Flinta", minLevel: 38, maxLevel: 42, weight: 9 },
  { areaKey: "astral_wilds", species: "Ampfin", minLevel: 38, maxLevel: 42, weight: 9 },
  { areaKey: "astral_wilds", species: "Saplingo", minLevel: 39, maxLevel: 43, weight: 8 },
  { areaKey: "astral_wilds", species: "Boltad", minLevel: 39, maxLevel: 43, weight: 7 },
  { areaKey: "astral_wilds", species: "Geyserkit", minLevel: 40, maxLevel: 44, weight: 6 },
  { areaKey: "astral_wilds", species: "Flashare", minLevel: 40, maxLevel: 44, weight: 6 },
  { areaKey: "astral_wilds", species: "Basalisk", minLevel: 41, maxLevel: 45, weight: 4 },

  { areaKey: "abyssal_depths", species: "Geyserkit", minLevel: 38, maxLevel: 42, weight: 12 },
  { areaKey: "abyssal_depths", species: "Pebbluff", minLevel: 38, maxLevel: 42, weight: 11 },
  { areaKey: "abyssal_depths", species: "Basalisk", minLevel: 39, maxLevel: 43, weight: 10 },
  { areaKey: "abyssal_depths", species: "Ampfin", minLevel: 39, maxLevel: 43, weight: 10 },
  { areaKey: "abyssal_depths", species: "Currenttle", minLevel: 40, maxLevel: 44, weight: 9 },
  { areaKey: "abyssal_depths", species: "Brooklit", minLevel: 40, maxLevel: 44, weight: 7 },
  { areaKey: "abyssal_depths", species: "Dusthorn", minLevel: 41, maxLevel: 45, weight: 7 },
  { areaKey: "abyssal_depths", species: "Bloomunk", minLevel: 41, maxLevel: 46, weight: 6 },
  { areaKey: "abyssal_depths", species: "Terrail", minLevel: 42, maxLevel: 47, weight: 5 },
  { areaKey: "abyssal_depths", species: "Meadowlup", minLevel: 43, maxLevel: 48, weight: 3 },

  { areaKey: "emberstorm_caldera", species: "Flashare", minLevel: 40, maxLevel: 44, weight: 12 },
  { areaKey: "emberstorm_caldera", species: "Flinta", minLevel: 40, maxLevel: 44, weight: 11 },
  { areaKey: "emberstorm_caldera", species: "Coalimp", minLevel: 41, maxLevel: 45, weight: 10 },
  { areaKey: "emberstorm_caldera", species: "Flintusk", minLevel: 41, maxLevel: 45, weight: 9 },
  { areaKey: "emberstorm_caldera", species: "Boltad", minLevel: 42, maxLevel: 46, weight: 8 },
  { areaKey: "emberstorm_caldera", species: "Basalisk", minLevel: 42, maxLevel: 46, weight: 8 },
  { areaKey: "emberstorm_caldera", species: "Brimtail", minLevel: 43, maxLevel: 47, weight: 7 },
  { areaKey: "emberstorm_caldera", species: "Magmole", minLevel: 43, maxLevel: 47, weight: 7 },
  { areaKey: "emberstorm_caldera", species: "Terrail", minLevel: 44, maxLevel: 48, weight: 5 },
  { areaKey: "emberstorm_caldera", species: "Sizzlepup", minLevel: 45, maxLevel: 50, weight: 3 }
];

const trainers = [
  {
    areaKey: "starter_plains",
    name: "Bug Catcher Milo",
    weight: 12,
    rewardMoney: 180,
    team: [
      { species: "Nibbloon", level: 3 },
      { species: "Mossprig", level: 4 }
    ]
  },
  {
    areaKey: "starter_plains",
    name: "Scout Rhea",
    weight: 10,
    rewardMoney: 220,
    team: [
      { species: "Zappit", level: 4 },
      { species: "Cindercub", level: 4 }
    ]
  },
  {
    areaKey: "starter_plains",
    name: "Picnicker June",
    weight: 11,
    rewardMoney: 210,
    team: [
      { species: "Brooklit", level: 4 },
      { species: "Budroo", level: 4 }
    ]
  },
  {
    areaKey: "tidebreak_coast",
    name: "Lifeguard Mira",
    weight: 12,
    rewardMoney: 420,
    team: [
      { species: "Drizzlefin", level: 9 },
      { species: "Brooklit", level: 10 }
    ]
  },
  {
    areaKey: "tidebreak_coast",
    name: "Deckhand Cove",
    weight: 10,
    rewardMoney: 480,
    team: [
      { species: "Tidepaw", level: 10 },
      { species: "Ampfin", level: 11 }
    ]
  },
  {
    areaKey: "tidebreak_coast",
    name: "Surfer Bay",
    weight: 8,
    rewardMoney: 520,
    team: [
      { species: "Ripplet", level: 11 },
      { species: "Currenttle", level: 11 }
    ]
  },
  {
    areaKey: "cinder_ridge",
    name: "Courier Flint",
    weight: 10,
    rewardMoney: 640,
    team: [
      { species: "Brimtail", level: 13 },
      { species: "Staticub", level: 13 }
    ]
  },
  {
    areaKey: "cinder_ridge",
    name: "Tamer Pyre",
    weight: 10,
    rewardMoney: 700,
    team: [
      { species: "Ashmunk", level: 14 },
      { species: "Coalimp", level: 15 }
    ]
  },
  {
    areaKey: "cinder_ridge",
    name: "Ridge Runner Sol",
    weight: 8,
    rewardMoney: 760,
    team: [
      { species: "Scorchick", level: 15 },
      { species: "Flintusk", level: 16 }
    ]
  },
  {
    areaKey: "voltspire_city",
    name: "Technician Nova",
    weight: 11,
    rewardMoney: 920,
    team: [
      { species: "Staticub", level: 17 },
      { species: "Neonet", level: 18 },
      { species: "Voltrill", level: 18 }
    ]
  },
  {
    areaKey: "voltspire_city",
    name: "Courier Volt",
    weight: 10,
    rewardMoney: 980,
    team: [
      { species: "Zappit", level: 17 },
      { species: "Wiremunk", level: 18 },
      { species: "Flinta", level: 19 }
    ]
  },
  {
    areaKey: "voltspire_city",
    name: "Skater Lux",
    weight: 8,
    rewardMoney: 1040,
    team: [
      { species: "Sparkit", level: 18 },
      { species: "Ampfin", level: 19 },
      { species: "Lumibbit", level: 20 }
    ]
  },
  {
    areaKey: "stonevault_canyon",
    name: "Miner Slate",
    weight: 11,
    rewardMoney: 1280,
    team: [
      { species: "Graveling", level: 21 },
      { species: "Bouldimp", level: 22 },
      { species: "Quarryn", level: 22 }
    ]
  },
  {
    areaKey: "stonevault_canyon",
    name: "Prospector Rune",
    weight: 10,
    rewardMoney: 1340,
    team: [
      { species: "Cragoon", level: 21 },
      { species: "Dusthorn", level: 23 },
      { species: "Slateet", level: 23 }
    ]
  },
  {
    areaKey: "stonevault_canyon",
    name: "Foreman Moss",
    weight: 8,
    rewardMoney: 1400,
    team: [
      { species: "Flintusk", level: 23 },
      { species: "Basalisk", level: 24 },
      { species: "Terrail", level: 25 }
    ]
  },
  {
    areaKey: "canopy_expanse",
    name: "Gardener Wren",
    weight: 11,
    rewardMoney: 1660,
    team: [
      { species: "Fernibble", level: 25 },
      { species: "Bloomunk", level: 26 }
    ]
  },
  {
    areaKey: "canopy_expanse",
    name: "Ranger Clover",
    weight: 10,
    rewardMoney: 1720,
    team: [
      { species: "Bramblet", level: 26 },
      { species: "Petalynx", level: 27 },
      { species: "Saplingo", level: 27 }
    ]
  },
  {
    areaKey: "canopy_expanse",
    name: "Herbalist Fern",
    weight: 8,
    rewardMoney: 1780,
    team: [
      { species: "Rootle", level: 27 },
      { species: "Meadowlup", level: 28 },
      { species: "Bloomunk", level: 29 }
    ]
  },
  {
    areaKey: "tempest_cape",
    name: "Storm Scout Gale",
    weight: 10,
    rewardMoney: 2080,
    team: [
      { species: "Voltrill", level: 29 },
      { species: "Ampfin", level: 30 },
      { species: "Boltad", level: 31 }
    ]
  },
  {
    areaKey: "tempest_cape",
    name: "Captain Nimbus",
    weight: 9,
    rewardMoney: 2160,
    team: [
      { species: "Currenttle", level: 30 },
      { species: "Pebbluff", level: 31 },
      { species: "Geyserkit", level: 32 }
    ]
  },
  {
    areaKey: "tempest_cape",
    name: "Tempest Ace Rook",
    weight: 8,
    rewardMoney: 2240,
    team: [
      { species: "Flashare", level: 31 },
      { species: "Lumibbit", level: 32 },
      { species: "Basalisk", level: 33 }
    ]
  },
  {
    areaKey: "elite_seven_summit",
    name: "Summit Gatekeeper Orion",
    weight: 10,
    rewardMoney: 2800,
    team: [
      { species: "Brimtail", level: 33 },
      { species: "Tidepaw", level: 33 },
      { species: "Fernibble", level: 34 },
      { species: "Voltrill", level: 34 }
    ]
  },
  {
    areaKey: "elite_seven_summit",
    name: "Ascendant Mira",
    weight: 9,
    rewardMoney: 3000,
    team: [
      { species: "Flinta", level: 34 },
      { species: "Ampfin", level: 35 },
      { species: "Meadowlup", level: 35 },
      { species: "Basalisk", level: 36 }
    ]
  },
  {
    areaKey: "astral_wilds",
    name: "Mythic Seeker Lyra",
    weight: 9,
    rewardMoney: 3600,
    team: [
      { species: "Bloomunk", level: 38 },
      { species: "Lumibbit", level: 39 },
      { species: "Flashare", level: 40 }
    ]
  },
  {
    areaKey: "astral_wilds",
    name: "Ace Trainer Orion",
    weight: 8,
    rewardMoney: 3800,
    team: [
      { species: "Saplingo", level: 39 },
      { species: "Geyserkit", level: 40 },
      { species: "Basalisk", level: 41 }
    ]
  },
  {
    areaKey: "abyssal_depths",
    name: "Deep Diver Nerissa",
    weight: 9,
    rewardMoney: 3900,
    team: [
      { species: "Pebbluff", level: 40 },
      { species: "Currenttle", level: 41 },
      { species: "Geyserkit", level: 42 }
    ]
  },
  {
    areaKey: "abyssal_depths",
    name: "Abyss Scout Kade",
    weight: 8,
    rewardMoney: 4100,
    team: [
      { species: "Dusthorn", level: 41 },
      { species: "Bloomunk", level: 42 },
      { species: "Terrail", level: 43 }
    ]
  },
  {
    areaKey: "emberstorm_caldera",
    name: "Caldera Warden Pyre",
    weight: 9,
    rewardMoney: 4300,
    team: [
      { species: "Flashare", level: 42 },
      { species: "Flintusk", level: 43 },
      { species: "Basalisk", level: 44 }
    ]
  },
  {
    areaKey: "emberstorm_caldera",
    name: "Veteran Terra",
    weight: 8,
    rewardMoney: 4500,
    team: [
      { species: "Coalimp", level: 43 },
      { species: "Boltad", level: 44 },
      { species: "Sizzlepup", level: 45 }
    ]
  }
];

module.exports = {
  areas,
  encounters,
  trainers
};
