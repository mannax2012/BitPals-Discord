const { getInventory } = require("../systems/inventorySystem");
const { buildInventoryEmbed } = require("../systems/uiSystem");
const { requirePlayer } = require("./helpers");

module.exports = {
  name: "inventory",
  async execute(message) {
    const player = await requirePlayer(message);
    if (!player) {
      return;
    }

    const inventory = await getInventory(message.author.id);
    await message.reply({
      embeds: [buildInventoryEmbed(message.author.username, player, inventory)]
    });
  }
};
