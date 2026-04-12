const { getActiveBattle } = require("../systems/battleSystem");
const { canAccessItem, getItem, getItemUnlockText } = require("../systems/gameData");
const { addItem, getItemQuantity, removeItem } = require("../systems/inventorySystem");
const { evolveMonsterWithItem } = require("../systems/monsterSystem");
const { buildEvolutionMessage } = require("../systems/uiSystem");
const { requirePlayer } = require("./helpers");

module.exports = {
  name: "use",
  async execute(message, args) {
    const player = await requirePlayer(message);
    if (!player) {
      return;
    }

    if (args.length < 3) {
      return message.reply("Use `!use <item name> <monsterId>`.");
    }

    const activeBattle = await getActiveBattle(message.author.id);
    if (activeBattle) {
      return message.reply("Finish your current battle before using an evolution item.");
    }

    const monsterId = Number(args[args.length - 1]);
    if (!Number.isInteger(monsterId)) {
      return message.reply("Use `!use <item name> <monsterId>`.");
    }

    const itemName = args.slice(1, -1).join(" ").trim();
    const item = getItem(itemName);

    if (!item) {
      return message.reply(`I could not find "${itemName}" in your usable item list.`);
    }

    if (item.fieldUsage !== "evolution") {
      return message.reply(`${item.name} cannot be used directly right now. Only evolution items use the \`!use\` command.`);
    }

    if (!canAccessItem(player, item)) {
      return message.reply(`${item.name} is locked. ${getItemUnlockText(item)}.`);
    }

    const quantity = await getItemQuantity(message.author.id, item.key);
    if (quantity < 1) {
      return message.reply(`You do not have any ${item.name}.`);
    }

    const removed = await removeItem(message.author.id, item.key, 1);
    if (!removed) {
      return message.reply(`You do not have any ${item.name}.`);
    }

    try {
      const evolution = await evolveMonsterWithItem(message.author.id, monsterId, item.key);
      return message.reply(
        buildEvolutionMessage(
          message.author.id,
          {
            evolution,
            nickname: evolution.monster.nickname,
            customNickname: evolution.monster.customNickname || null,
            hasCustomNickname: Boolean(evolution.monster.hasCustomNickname),
            types: evolution.monster.types,
            newLevel: evolution.monster.level
          },
          message.author.username
        )
      );
    } catch (err) {
      await addItem(message.author.id, item.key, 1);
      throw err;
    }
  }
};
