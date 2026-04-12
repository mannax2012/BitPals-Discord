const { getBox, getParty } = require("../systems/monsterSystem");
const { buildPartyView } = require("../systems/uiSystem");
const { requirePlayer } = require("./helpers");

module.exports = {
  name: "party",
  async execute(message) {
    const player = await requirePlayer(message);
    if (!player) {
      return;
    }

    const party = await getParty(message.author.id);
    const box = await getBox(message.author.id);

    await message.reply(buildPartyView(message.author.username, message.author.id, party, box));
  }
};
