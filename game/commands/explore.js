const { getArea, getDefaultArea } = require("../systems/gameData");
const { getActiveBattle, getBattleContextById, startTrainerEncounter, startWildBattle } = require("../systems/battleSystem");
const { buildTrainerBattleContext } = require("../systems/trainerBattleSystem");
const { requirePlayer, sendBattleMessage } = require("./helpers");

module.exports = {
  name: "explore",
  async execute(message) {
    const player = await requirePlayer(message);
    if (!player) {
      return;
    }

    const area = getArea(player.current_area) || getDefaultArea();
    const activeBattle = await getActiveBattle(message.author.id);
    if (activeBattle) {
      const context = activeBattle.battle_type === "trainer_pvp"
        ? await buildTrainerBattleContext(activeBattle.id)
        : await getBattleContextById(activeBattle.id);
      await sendBattleMessage(message, context, "You already have an active battle. Bringing it back into focus.");
      return;
    }

    const trainerRoll = Math.random() < (area.trainerChance || 0.3);
    const context = trainerRoll
      ? await startTrainerEncounter(message.author.id, area.key)
      : await startWildBattle(message.author.id, area.key);
    await sendBattleMessage(message, context);
  }
};
