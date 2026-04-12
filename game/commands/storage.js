const { getBox, getParty } = require("../systems/monsterSystem");
const { buildStorageView } = require("../systems/uiSystem");
const { requirePlayer } = require("./helpers");

module.exports = {
  name: "storage",
  aliases: ["box"],
  async execute(message) {
    const player = await requirePlayer(message);
    if (!player) {
      return;
    }

    const party = await getParty(message.author.id);
    const box = await getBox(message.author.id);

    await message.reply(buildStorageView(message.author.username, message.author.id, party, box));
  }
};
