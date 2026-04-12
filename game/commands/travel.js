const { getActiveBattle } = require("../systems/battleSystem");
const { getArea, getAreas, getDefaultArea, getUnlockedAreas } = require("../systems/gameData");
const { setCurrentArea } = require("../systems/playerSystem");
const { buildTravelButtons, buildTravelEmbed } = require("../systems/uiSystem");
const { requirePlayer } = require("./helpers");

module.exports = {
  name: "travel",
  async execute(message, args) {
    const player = await requirePlayer(message);
    if (!player) {
      return;
    }

    const currentArea = getArea(player.current_area) || getDefaultArea();
    const unlockedAreas = getUnlockedAreas(player);
    const allAreas = getAreas();
    const requestedAreaName = args.slice(1).join(" ").trim();

    if (!requestedAreaName) {
      return message.reply({
        embeds: [buildTravelEmbed(player, currentArea, unlockedAreas, allAreas)],
        components: buildTravelButtons(message.author.id, currentArea, unlockedAreas)
      });
    }

    const requestedArea = getArea(requestedAreaName);
    if (!requestedArea) {
      return message.reply({
        embeds: [
          buildTravelEmbed(
            player,
            currentArea,
            unlockedAreas,
            allAreas,
            `I could not find "${requestedAreaName}". Travel only works with known area names from the map below.`
          )
        ],
        components: buildTravelButtons(message.author.id, currentArea, unlockedAreas)
      });
    }

    if (!unlockedAreas.some(area => area.key === requestedArea.key)) {
      return message.reply({
        embeds: [
          buildTravelEmbed(
            player,
            currentArea,
            unlockedAreas,
            allAreas,
            `${requestedArea.name} is still locked. Earn ${requestedArea.requiredBadge} first to open that route.`
          )
        ],
        components: buildTravelButtons(message.author.id, currentArea, unlockedAreas)
      });
    }

    if (requestedArea.key === currentArea.key) {
      return message.reply({
        embeds: [
          buildTravelEmbed(
            player,
            currentArea,
            unlockedAreas,
            allAreas,
            `You are already in ${currentArea.name}.`
          )
        ],
        components: buildTravelButtons(message.author.id, currentArea, unlockedAreas)
      });
    }

    const activeBattle = await getActiveBattle(message.author.id);
    if (activeBattle) {
      return message.reply("Finish your current battle before traveling to a new area.");
    }

    const updatedPlayer = await setCurrentArea(message.author.id, requestedArea.key);

    await message.reply({
      embeds: [
        buildTravelEmbed(
          updatedPlayer,
          requestedArea,
          getUnlockedAreas(updatedPlayer),
          allAreas,
          `You traveled to ${requestedArea.name}. Wild encounters and trainer encounters now pull from this area.`
        )
      ],
      components: buildTravelButtons(message.author.id, requestedArea, getUnlockedAreas(updatedPlayer))
    });
  }
};
