const { getActiveBattle, useFallbackBattleAction } = require("../systems/battleSystem");
const { requirePlayer, sendBattleTurnMessage } = require("./helpers");

module.exports = {
  name: "capture",
  async execute(message) {
    const player = await requirePlayer(message);
    if (!player) {
      return;
    }

    const activeBattle = await getActiveBattle(message.author.id);
    if (activeBattle?.battle_type === "trainer_pvp") {
      return message.reply("You cannot capture another trainer's monsters.");
    }

    const context = await useFallbackBattleAction(message.author.id, "capture");
    if (!context) {
      return message.reply("No active wild battle found. Use `!explore` to start one.");
    }

    await sendBattleTurnMessage(message, context);
  }
};
