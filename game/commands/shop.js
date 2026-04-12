const { buyItem, sellItem } = require("../systems/battleSystem");
const { getItem } = require("../systems/gameData");
const { getInventory } = require("../systems/inventorySystem");
const { buildShopButtons, buildShopEmbed } = require("../systems/uiSystem");
const { requirePlayer } = require("./helpers");

function parseShopItemArgs(rawArgs, usageText) {
  if (rawArgs.length === 0) {
    return { error: usageText };
  }

  const trailingQuantity = Number(rawArgs[rawArgs.length - 1]);
  const hasQuantityArg = Number.isInteger(trailingQuantity) && trailingQuantity > 0 && rawArgs.length > 1;
  const quantity = hasQuantityArg ? trailingQuantity : 1;
  const itemTokens = hasQuantityArg ? rawArgs.slice(0, -1) : rawArgs;
  const itemName = itemTokens.join(" ").trim();

  if (!itemName) {
    return { error: usageText };
  }

  return { itemName, quantity };
}

module.exports = {
  name: "shop",
  async execute(message, args) {
    const player = await requirePlayer(message);
    if (!player) {
      return;
    }

    const subcommand = String(args?.[1] || "").toLowerCase();
    if (subcommand === "buy") {
      const parsed = parseShopItemArgs(args.slice(2), "Use `!shop buy <item name> [quantity]`.");
      if (parsed.error) {
        return message.reply(parsed.error);
      }

      const item = getItem(parsed.itemName);
      if (!item) {
        return message.reply(`I could not find "${parsed.itemName}" in the shop stock.`);
      }

      const purchase = await buyItem(message.author.id, item.key, parsed.quantity);
      return message.reply({
        content: `Bought ${purchase.quantity}x ${purchase.item.name} for ${purchase.item.price * purchase.quantity} credits.`,
        embeds: [buildShopEmbed(purchase.player, purchase.inventory)],
        components: buildShopButtons(purchase.player, purchase.inventory)
      });
    }

    if (subcommand === "sell") {
      const parsed = parseShopItemArgs(args.slice(2), "Use `!shop sell <item name> [quantity]`.");
      if (parsed.error) {
        return message.reply(parsed.error);
      }

      const item = getItem(parsed.itemName);
      if (!item) {
        return message.reply(`I could not find "${parsed.itemName}" in your sellable item list.`);
      }

      const sale = await sellItem(message.author.id, item.key, parsed.quantity);
      return message.reply({
        content: `Sold ${sale.quantity}x ${sale.item.name} for ${sale.totalValue} credits.`,
        embeds: [buildShopEmbed(sale.player, sale.inventory)],
        components: buildShopButtons(sale.player, sale.inventory)
      });
    }

    const inventory = await getInventory(message.author.id);
    await message.reply({
      embeds: [buildShopEmbed(player, inventory)],
      components: buildShopButtons(player, inventory)
    });
  }
};
