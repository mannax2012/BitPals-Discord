const REWARD_PROFILES = {
  wild: {
    key: "wild",
    label: "Wild Encounter",
    expMultiplier: 1,
    moneyMultiplier: 0
  },
  trainer_npc: {
    key: "trainer_npc",
    label: "Trainer Encounter",
    expMultiplier: 1.6,
    moneyMultiplier: 1.45
  },
  gym: {
    key: "gym",
    label: "Gym Leader",
    expMultiplier: 2.1,
    moneyMultiplier: 1.75
  },
  elite_seven: {
    key: "elite_seven",
    label: "Elite Seven",
    expMultiplier: 3,
    moneyMultiplier: 2.5
  },
  trainer_pvp_winner: {
    key: "trainer_pvp_winner",
    label: "Trainer Battle Winner",
    expMultiplier: 0,
    moneyMultiplier: 1.6
  },
  trainer_pvp_loser: {
    key: "trainer_pvp_loser",
    label: "Trainer Battle Participation",
    expMultiplier: 0,
    moneyMultiplier: 0
  }
};

function isEliteSevenBattle(state = {}) {
  return state.rewardTier === "elite_seven"
    || state.gymKey === "elite_seven_citadel"
    || state.badgeName === "Apex Crest"
    || /elite seven/i.test(`${state.gymName || ""} ${state.gymLeader || ""}`);
}

function getSingleBattleRewardProfile(battleType, state = {}) {
  if (battleType === "gym" && isEliteSevenBattle(state)) {
    return REWARD_PROFILES.elite_seven;
  }

  return REWARD_PROFILES[battleType] || REWARD_PROFILES.wild;
}

function getPvpRewardProfile(result) {
  return result === "winner"
    ? REWARD_PROFILES.trainer_pvp_winner
    : REWARD_PROFILES.trainer_pvp_loser;
}

function applyRewardMultiplier(amount, multiplier, minimum = 0) {
  const baseAmount = Number(amount) || 0;
  const normalizedMultiplier = Number(multiplier) || 0;

  if (baseAmount <= 0 || normalizedMultiplier <= 0) {
    return 0;
  }

  return Math.max(minimum, Math.floor(baseAmount * normalizedMultiplier));
}

function summarizeRewardProfile(profile) {
  return {
    key: profile.key,
    label: profile.label,
    expMultiplier: profile.expMultiplier,
    moneyMultiplier: profile.moneyMultiplier
  };
}

module.exports = {
  applyRewardMultiplier,
  getPvpRewardProfile,
  getSingleBattleRewardProfile,
  summarizeRewardProfile
};
