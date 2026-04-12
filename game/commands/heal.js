const { getActiveBattle } = require("../systems/battleSystem");
const { healParty } = require("../systems/monsterSystem");
const { requirePlayer } = require("./helpers");

module.exports = {
  name: "heal",
  async execute(message) {
    const player = await requirePlayer(message);
    if (!player) {
      return;
    }

    const activeBattle = await getActiveBattle(message.author.id);
    if (activeBattle) {
      return message.reply("Finish your active battle before visiting the healing center.");
    }

    await healParty(message.author.id);
    await message.reply("Your whole party has been restored at the healing center.");
  }
};
