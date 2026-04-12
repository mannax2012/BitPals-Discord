const { getActiveBattle, processBattleAction } = require("../systems/battleSystem");
const { getParty, moveBoxMonsterToParty, setPartyLead, swapPartySlots } = require("../systems/monsterSystem");
const { requirePlayer, sendBattleTurnMessage } = require("./helpers");

function formatMonsterName(monster) {
  if (!monster) {
    return "That monster";
  }

  const nickname = monster.nickname || monster.species;
  return monster.hasCustomNickname && monster.species && nickname !== monster.species
    ? `${nickname} (${monster.species})`
    : nickname;
}

module.exports = {
  name: "switch",
  async execute(message, args) {
    const player = await requirePlayer(message);
    if (!player) {
      return;
    }

    const activeBattle = await getActiveBattle(message.author.id);
    const firstArg = args[1];
    const secondArg = args[2];
    const thirdArg = args[3];

    if (!firstArg) {
      return message.reply("Use `!switch <slot>` to set your lead monster, `!switch <from> <to>` to reorder party slots, or `!switch box <monsterId> <slot>` to pull from storage.");
    }

    if (activeBattle) {
      if (activeBattle.battle_type === "trainer_pvp") {
        return message.reply("Trainer battles between Discord users use the battle buttons on the shared battle board.");
      }

      const targetSlot = Number(firstArg);
      if (!Number.isInteger(targetSlot) || targetSlot < 1 || targetSlot > 6) {
        return message.reply("During battle, use `!switch <party slot>` to swap in a healthy monster.");
      }

      const party = await getParty(message.author.id);
      const targetMonster = party.find(monster => monster.party_slot === targetSlot);

      if (!targetMonster) {
        return message.reply(`No party monster is in slot ${targetSlot}.`);
      }

      const context = await processBattleAction(message.author.id, activeBattle.id, "switch", String(targetMonster.id));
      return sendBattleTurnMessage(message, context);
    }

    if (String(firstArg).toLowerCase() === "box") {
      const monsterId = Number(secondArg);
      const slot = Number(thirdArg);

      if (!Number.isInteger(monsterId) || !Number.isInteger(slot) || slot < 1 || slot > 6) {
        return message.reply("Use `!switch box <monsterId> <party slot>`.");
      }

      const updatedParty = await moveBoxMonsterToParty(message.author.id, monsterId, slot);
      const movedMonster = updatedParty.find(monster => monster.id === monsterId) || updatedParty.find(monster => monster.party_slot === slot);
      return message.reply(`${formatMonsterName(movedMonster)} moved into party slot ${slot}.`);
    }

    const fromSlot = Number(firstArg);
    const toSlot = secondArg ? Number(secondArg) : 1;

    if (!Number.isInteger(fromSlot) || !Number.isInteger(toSlot) || fromSlot < 1 || fromSlot > 6 || toSlot < 1 || toSlot > 6) {
      return message.reply("Use `!switch <slot>` or `!switch <from> <to>` with values from 1 to 6.");
    }

    if (secondArg) {
      const party = await getParty(message.author.id);
      const fromMonster = party.find(monster => monster.party_slot === fromSlot);
      const toMonster = party.find(monster => monster.party_slot === toSlot);

      if (!fromMonster) {
        return message.reply(`No party monster is in slot ${fromSlot}.`);
      }

      if (fromSlot === toSlot) {
        return message.reply(`${formatMonsterName(fromMonster)} is already in party slot ${fromSlot}.`);
      }

      await swapPartySlots(message.author.id, fromSlot, toSlot);

      if (toMonster) {
        return message.reply(`${formatMonsterName(fromMonster)} moved to slot ${toSlot}; ${formatMonsterName(toMonster)} moved to slot ${fromSlot}.`);
      }

      return message.reply(`${formatMonsterName(fromMonster)} moved from slot ${fromSlot} to empty slot ${toSlot}.`);
    }

    const party = await getParty(message.author.id);
    const leadMonster = party.find(monster => monster.party_slot === fromSlot);

    if (!leadMonster) {
      return message.reply(`No party monster is in slot ${fromSlot}.`);
    }

    if (fromSlot === 1) {
      return message.reply(`${formatMonsterName(leadMonster)} is already your lead monster.`);
    }

    await setPartyLead(message.author.id, fromSlot);
    return message.reply(`${formatMonsterName(leadMonster)} is now your lead monster in slot 1.`);
  }
};
