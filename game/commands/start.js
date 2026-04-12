const config = require("../../config");
const { getStarterSpecies } = require("../systems/gameData");
const { claimStarter, getStarterProgress } = require("../systems/starterSystem");
const { buildStarterChoiceView, buildStarterClaimedView } = require("../systems/uiSystem");

module.exports = {
  name: "start",
  async execute(message, args) {
    const requestedStarter = args.slice(1).join(" ").trim();
    const progress = await getStarterProgress(message.author.id);

    if (progress.hasStarter) {
      return message.reply(
        buildStarterClaimedView(message.author.username, {
          alreadyStarted: true,
          starter: progress.starter
        }, message.author.id)
      );
    }

    if (!requestedStarter) {
      return message.reply(buildStarterChoiceView(message.author.username, message.author.id, config.prefix));
    }

    const starterSpecies = getStarterSpecies(requestedStarter);
    if (!starterSpecies) {
      return message.reply(
        buildStarterChoiceView(
          message.author.username,
          message.author.id,
          config.prefix,
          `I could not find "${requestedStarter}" as a starter. Choose Flameling, Squirtie, or Leafy.`
        )
      );
    }

    const result = await claimStarter(message.author.id, starterSpecies);
    return message.reply(buildStarterClaimedView(message.author.username, result, message.author.id));

/*


    }

    const monsters = await getPlayerMonsters(message.author.id);
    const starter = monsters.length > 0
      ? monsters[0]
      : await giveStarter(message.author.id, starterChoice);

    await ensureStarterPack(message.author.id);

    if (!createdProfile && monsters.length > 0) {
      return message.reply(`Your trainer profile is already active. Lead monster: ${starter.nickname} Lv.${starter.level}. Try \`!party\`, \`!explore\`, \`!travel\`, \`!shop\`, or \`!gym\`.`);
    }

    return message.reply(`Welcome to BitPals. Your starter is ${starter.species} Lv.${starter.level}, your bag now has Scout Orbs and Potions, and you begin in Starter Plains. Try \`!explore\`, \`!travel\`, and \`!gym\` to start progressing.`);

    message.reply("Welcome! You received your starter Flameling 🔥");
*/
  }
};
