const { getActiveBattle, useFallbackBattleAction } = require("../systems/battleSystem");
const { requirePlayer, sendBattleTurnMessage } = require("./helpers");

module.exports = {
  name: "attack",
  async execute(message) {
    const player = await requirePlayer(message);
    if (!player) {
      return;
    }

    const activeBattle = await getActiveBattle(message.author.id);
    if (activeBattle?.battle_type === "trainer_pvp") {
      return message.reply("Trainer battles between Discord users use the battle buttons on the shared battle board.");
    }

    const context = await useFallbackBattleAction(message.author.id, "attack");
    if (!context) {
      return message.reply("No active wild or NPC trainer battle found. Use `!explore` to start one.");
    }

    await sendBattleTurnMessage(message, context);
  }
};
