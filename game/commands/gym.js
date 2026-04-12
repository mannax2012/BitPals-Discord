const { startGymBattle } = require("../systems/battleSystem");
const { getArea, getDefaultArea, getGym } = require("../systems/gameData");
const { hasBadge } = require("../systems/playerSystem");
const { buildGymButtons, buildGymEmbed } = require("../systems/uiSystem");
const { requirePlayer, sendBattleMessage } = require("./helpers");

module.exports = {
  name: "gym",
  async execute(message, args) {
    const player = await requirePlayer(message);
    if (!player) {
      return;
    }

    const area = getArea(player.current_area) || getDefaultArea();
    const gymKey = area.gymKey;

    if (!gymKey) {
      return message.reply(`There is no official gym challenge in ${area.name}. Try \`!explore\` here or \`!travel <area name>\` to revisit an earlier badge route.`);
    }

    const gym = getGym(gymKey);

    if (args[1] === "challenge") {
      const context = await startGymBattle(message.author.id, gymKey);
      return sendBattleMessage(message, context);
    }

    await message.reply({
      embeds: [buildGymEmbed(player, gymKey, area)],
      components: buildGymButtons(message.author.id, gymKey, hasBadge(player, gym.badgeName))
    });
  }
};
