const evolvedSpecies = [
  {
    name: "Flarelisk",
    types: ["Fire", "Normal"],
    catchRate: 0.16,
    baseExp: 88,
    baseStats: { hp: 68, attack: 82, defense: 58, speed: 88 },
    learnset: [
      { level: 1, move: "Tackle" },
      { level: 1, move: "Ember" },
      { level: 7, move: "Quick Attack" },
      { level: 10, move: "Flare Bite" },
      { level: 16, move: "Flame Wheel" },
      { level: 22, move: "Heat Burst" },
      { level: 28, move: "Blaze Burst" },
      { level: 34, move: "Fire Lash" }
    ]
  },
  {
    name: "Infernagon",
    types: ["Fire", "Rock"],
    catchRate: 0.07,
    baseExp: 152,
    baseStats: { hp: 92, attack: 108, defense: 82, speed: 104 },
    learnset: [
      { level: 1, move: "Ember" },
      { level: 1, move: "Flame Wheel" },
      { level: 16, move: "Heat Burst" },
      { level: 24, move: "Blaze Burst" },
      { level: 30, move: "Fire Lash" },
      { level: 36, move: "Inferno Kick" },
      { level: 42, move: "Volcano Drive" },
      { level: 46, move: "Coal Crash" }
    ]
  },
  {
    name: "Maritide",
    types: ["Water", "Normal"],
    catchRate: 0.16,
    baseExp: 86,
    baseStats: { hp: 76, attack: 68, defense: 82, speed: 64 },
    learnset: [
      { level: 1, move: "Tackle" },
      { level: 1, move: "Bubble Jet" },
      { level: 7, move: "Water Pulse" },
      { level: 10, move: "Quick Attack" },
      { level: 16, move: "Aqua Dart" },
      { level: 22, move: "Brine Snap" },
      { level: 28, move: "Tidal Slam" },
      { level: 34, move: "Wave Crash" }
    ]
  },
  {
    name: "Leviasea",
    types: ["Water", "Electric"],
    catchRate: 0.07,
    baseExp: 150,
    baseStats: { hp: 102, attack: 82, defense: 100, speed: 84 },
    learnset: [
      { level: 1, move: "Bubble Jet" },
      { level: 1, move: "Water Pulse" },
      { level: 16, move: "Aqua Dart" },
      { level: 24, move: "Brine Snap" },
      { level: 30, move: "Tidal Slam" },
      { level: 36, move: "Wave Crash" },
      { level: 42, move: "Deep Surge" },
      { level: 46, move: "Cascade Kick" }
    ]
  },
  {
    name: "Thornbloom",
    types: ["Grass", "Normal"],
    catchRate: 0.16,
    baseExp: 87,
    baseStats: { hp: 74, attack: 72, defense: 74, speed: 62 },
    learnset: [
      { level: 1, move: "Tackle" },
      { level: 1, move: "Vine Whip" },
      { level: 7, move: "Quick Attack" },
      { level: 10, move: "Leaf Blade" },
      { level: 16, move: "Seed Shot" },
      { level: 22, move: "Petal Slice" },
      { level: 28, move: "Bloom Burst" },
      { level: 34, move: "Razor Fern" }
    ]
  },
  {
    name: "Verdantusk",
    types: ["Grass", "Rock"],
    catchRate: 0.07,
    baseExp: 149,
    baseStats: { hp: 100, attack: 90, defense: 94, speed: 72 },
    learnset: [
      { level: 1, move: "Vine Whip" },
      { level: 1, move: "Leaf Blade" },
      { level: 16, move: "Seed Shot" },
      { level: 24, move: "Petal Slice" },
      { level: 30, move: "Bloom Burst" },
      { level: 36, move: "Razor Fern" },
      { level: 42, move: "Ivy Surge" },
      { level: 46, move: "Canopy Crash" }
    ]
  },
  {
    name: "Gobblit",
    types: ["Normal"],
    catchRate: 0.22,
    baseExp: 76,
    baseStats: { hp: 72, attack: 66, defense: 58, speed: 68 },
    learnset: [
      { level: 1, move: "Tackle" },
      { level: 4, move: "Quick Attack" },
      { level: 8, move: "Body Check" },
      { level: 14, move: "Headbutt" },
      { level: 20, move: "Double Tap" },
      { level: 26, move: "Tail Slam" },
      { level: 32, move: "Crush Claw" }
    ]
  },
  {
    name: "Banquetusk",
    types: ["Normal", "Rock"],
    catchRate: 0.1,
    baseExp: 138,
    baseStats: { hp: 108, attack: 96, defense: 78, speed: 76 },
    learnset: [
      { level: 1, move: "Body Check" },
      { level: 14, move: "Headbutt" },
      { level: 20, move: "Double Tap" },
      { level: 26, move: "Tail Slam" },
      { level: 30, move: "Rushdown" },
      { level: 36, move: "Skybound Slam" },
      { level: 42, move: "Finale Blow" }
    ]
  },
  {
    name: "Voltiger",
    types: ["Electric", "Normal"],
    catchRate: 0.18,
    baseExp: 89,
    baseStats: { hp: 64, attack: 80, defense: 58, speed: 92 },
    learnset: [
      { level: 1, move: "Tackle" },
      { level: 1, move: "Spark" },
      { level: 7, move: "Quick Attack" },
      { level: 18, move: "Volt Jab" },
      { level: 24, move: "Charge Pulse" },
      { level: 30, move: "Arc Shot" },
      { level: 36, move: "Plasma Burst" }
    ]
  },
  {
    name: "Tempestra",
    types: ["Electric", "Fire"],
    catchRate: 0.08,
    baseExp: 148,
    baseStats: { hp: 90, attack: 102, defense: 74, speed: 114 },
    learnset: [
      { level: 1, move: "Spark" },
      { level: 1, move: "Volt Jab" },
      { level: 18, move: "Charge Pulse" },
      { level: 24, move: "Arc Shot" },
      { level: 30, move: "Plasma Burst" },
      { level: 36, move: "Bolt Blade" },
      { level: 42, move: "Storm Shock" },
      { level: 46, move: "Ion Slam" }
    ]
  },
  {
    name: "Cragmite",
    types: ["Rock", "Normal"],
    catchRate: 0.18,
    baseExp: 94,
    baseStats: { hp: 82, attack: 88, defense: 94, speed: 42 },
    learnset: [
      { level: 1, move: "Tackle" },
      { level: 4, move: "Rock Toss" },
      { level: 8, move: "Body Check" },
      { level: 20, move: "Stone Slam" },
      { level: 26, move: "Gravel Bash" },
      { level: 32, move: "Crag Crush" },
      { level: 38, move: "Basalt Break" }
    ]
  },
  {
    name: "Monolyth",
    types: ["Rock", "Fire"],
    catchRate: 0.08,
    baseExp: 154,
    baseStats: { hp: 112, attack: 114, defense: 122, speed: 48 },
    learnset: [
      { level: 1, move: "Rock Toss" },
      { level: 1, move: "Stone Slam" },
      { level: 20, move: "Gravel Bash" },
      { level: 26, move: "Crag Crush" },
      { level: 32, move: "Basalt Break" },
      { level: 38, move: "Meteor Toss" },
      { level: 44, move: "Terra Crash" }
    ]
  },
  {
    name: "Briarjaw",
    types: ["Grass", "Normal"],
    catchRate: 0.16,
    baseExp: 92,
    baseStats: { hp: 84, attack: 92, defense: 72, speed: 58 },
    learnset: [
      { level: 1, move: "Tackle" },
      { level: 1, move: "Needle Jab" },
      { level: 8, move: "Leaf Blade" },
      { level: 20, move: "Thorn Burst" },
      { level: 26, move: "Root Lash" },
      { level: 32, move: "Briar Bash" },
      { level: 38, move: "Grove Grip" }
    ]
  },
  {
    name: "Thornlord",
    types: ["Grass", "Rock"],
    catchRate: 0.08,
    baseExp: 151,
    baseStats: { hp: 110, attack: 118, defense: 94, speed: 68 },
    learnset: [
      { level: 1, move: "Needle Jab" },
      { level: 1, move: "Leaf Blade" },
      { level: 20, move: "Thorn Burst" },
      { level: 26, move: "Root Lash" },
      { level: 32, move: "Briar Bash" },
      { level: 38, move: "Grove Grip" },
      { level: 44, move: "Ivy Surge" }
    ]
  }
];

const evolutionRules = {
  Flameling: [{ species: "Flarelisk", method: "level", level: 16 }],
  Flarelisk: [{ species: "Infernagon", method: "level", level: 36 }],
  Squirtie: [{ species: "Maritide", method: "level", level: 16 }],
  Maritide: [{ species: "Leviasea", method: "level", level: 36 }],
  Leafy: [{ species: "Thornbloom", method: "level", level: 16 }],
  Thornbloom: [{ species: "Verdantusk", method: "level", level: 36 }],
  Nibbloon: [{ species: "Gobblit", method: "level", level: 14 }],
  Gobblit: [{ species: "Banquetusk", method: "level", level: 30 }],
  Zappit: [{ species: "Voltiger", method: "level", level: 18 }],
  Voltiger: [{ species: "Tempestra", method: "item", itemKey: "volt_module" }],
  Pebblit: [{ species: "Cragmite", method: "level", level: 20 }],
  Cragmite: [{ species: "Monolyth", method: "item", itemKey: "terra_core" }],
  Thornlet: [{ species: "Briarjaw", method: "level", level: 20 }],
  Briarjaw: [{ species: "Thornlord", method: "item", itemKey: "grove_stone" }]
};

module.exports = {
  evolvedSpecies,
  evolutionRules
};
