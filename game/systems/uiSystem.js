const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require("discord.js");
const {
  canAccessItem,
  getGym,
  getItem,
  getItemUnlockText,
  getLockedShopItemsForPlayer,
  getShopItemsForPlayer,
  getStarterOptions,
  getTypeColor
} = require("./gameData");
const { getItemSellValue } = require("./battleSystem");

function createBar(current, max, size = 12) {
  if (max <= 0) {
    return "[------------]";
  }

  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * size);
  return `[${"#".repeat(filled)}${"-".repeat(size - filled)}]`;
}

function getHealthBarFill(ratio) {
  if (ratio <= 0.25) {
    return "\u{1F7E5}";
  }

  if (ratio <= 0.5) {
    return "\u{1F7E8}";
  }

  return "\u{1F7E9}";
}

function createHealthBar(current, max, size = 12) {
  if (max <= 0) {
    return "\u2B1B".repeat(size);
  }

  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * size);
  const fillIcon = getHealthBarFill(ratio);

  return `${fillIcon.repeat(filled)}${"\u2B1B".repeat(size - filled)}`;
}

function createExperienceBar(current, max, size = 10) {
  if (max <= 0) {
    return "\u2B1B".repeat(size);
  }

  const ratio = Math.max(0, Math.min(1, current / max));
  const filled = Math.round(ratio * size);

  return `${"\u{1F7EA}".repeat(filled)}${"\u2B1B".repeat(size - filled)}`;
}

function formatTypes(types) {
  return types.join(" / ");
}

function getMonsterDisplayName(monster) {
  return monster?.nickname || monster?.species || "Monster";
}

function hasCustomNickname(monster) {
  return Boolean(monster?.hasCustomNickname || monster?.customNickname);
}

function formatMonsterName(monster, includeSpecies = true) {
  const displayName = getMonsterDisplayName(monster);
  const species = monster?.species;

  if (includeSpecies && species && hasCustomNickname(monster) && displayName !== species) {
    return `${displayName} (${species})`;
  }

  return displayName;
}

function formatRewardEntryName(entry) {
  const displayName = entry?.nickname || entry?.species || "Monster";
  const species = entry?.species;

  if ((entry?.hasCustomNickname || entry?.customNickname) && species && displayName !== species) {
    return `${displayName} (${species})`;
  }

  return displayName;
}

function formatMoneyDelta(delta, positiveLabel = "earned", negativeLabel = "lost") {
  if (delta > 0) {
    return `+${delta} credits ${positiveLabel}`;
  }

  if (delta < 0) {
    return `${delta} credits ${negativeLabel}`;
  }

  return "No credit change";
}

function formatExperienceLines(experience = []) {
  if (experience.length === 0) {
    return "No experience awarded.";
  }

  return experience
    .map(entry => `${formatRewardEntryName(entry)} +${entry.experienceGain} EXP${entry.gainedLevels > 0 ? ` (Lv.${entry.oldLevel} -> Lv.${entry.newLevel})` : ""}`)
    .join("\n");
}

function formatMultiplier(multiplier) {
  return `${Number(multiplier || 0).toFixed(2).replace(/\.?0+$/, "")}x`;
}

function formatRewardProfile(profile) {
  if (!profile) {
    return "Standard payout";
  }

  const expText = Number(profile.expMultiplier) > 0
    ? `EXP ${formatMultiplier(profile.expMultiplier)}`
    : "No EXP";
  return `${profile.label}\n${expText} | Credits ${formatMultiplier(profile.moneyMultiplier)}`;
}

function formatLevelUpLines(experience = []) {
  const levelUps = experience.filter(entry => entry.gainedLevels > 0);

  if (levelUps.length === 0) {
    return "No level-ups this battle.";
  }

  if (levelUps.length === 1) {
    return `${formatRewardEntryName(levelUps[0])} leveled up. A detailed level-up card was sent separately.`;
  }

  return `${levelUps.length} monsters leveled up. Detailed level-up cards were sent separately.`;
}

function formatLootLines(rewardItems = []) {
  if (rewardItems.length === 0) {
    return "No item drops this time.";
  }

  return rewardItems.map(item => `${item.name} x${item.quantity}`).join("\n");
}

function formatBattleItemLabel(item) {
  const effectText = item.battleUsage === "heal" && Number(item.healAmount) > 0
    ? ` +${item.healAmount} HP`
    : "";
  return `${item.name}${effectText} x${item.quantity}`;
}

function formatPlaybackText(frame, index = 0, total = 1) {
  if (!frame) {
    return null;
  }

  const title = frame.title || "Resolving turn...";
  const detail = frame.detail ? `\n${frame.detail}` : "";
  const progress = total > 1 ? ` (${index + 1}/${total})` : "";

  return `**Resolving turn${progress}**\n${title}${detail}`;
}

function formatBattleLog(log = [], playback = null, size = 5) {
  const recentLog = (log || []).slice(-size).map(line => `- ${line}`).join("\n");

  if (!playback) {
    return recentLog || "- No turns have been taken yet.";
  }

  return `${playback}\n\n${recentLog || "- No previous battle log yet."}`;
}

function canShowBattleItem(item, battleType, player = null) {
  if (!item || item.quantity < 1) {
    return false;
  }

  if (player && !canAccessItem(player, item)) {
    return false;
  }

  if (item.battleUsage === "heal") {
    return true;
  }

  return item.battleUsage === "capture" && battleType === "wild";
}

function formatMoveDetails(move) {
  const segments = [`${move.name} (${move.type})`];

  if (typeof move.power === "number") {
    segments.push(`Pow ${move.power}`);
  }

  if (typeof move.accuracy === "number") {
    segments.push(`Acc ${move.accuracy}`);
  }

  if (move.priority) {
    segments.push(`Prio ${move.priority > 0 ? `+${move.priority}` : move.priority}`);
  }

  return segments.join(" | ");
}

function formatActiveMoveSummary(moveSetChanges = {}) {
  const activeAfter = moveSetChanges.activeAfter || [];
  const activeAdded = moveSetChanges.activeAdded || [];
  const activeRemoved = moveSetChanges.activeRemoved || [];
  const lines = [];

  if (activeAdded.length > 0) {
    lines.push(`Added: ${activeAdded.map(move => move.name).join(", ")}`);
  }

  if (activeRemoved.length > 0) {
    lines.push(`Replaced: ${activeRemoved.map(move => move.name).join(", ")}`);
  }

  lines.push(`Current set: ${activeAfter.map(move => move.name).join(", ") || "No active moves"}`);
  return lines.join("\n");
}

function chunkButtons(buttons) {
  const rows = [];
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder().addComponents(buttons.slice(index, index + 5)));
  }
  return rows;
}

const STORAGE_PAGE_SIZE = 6;

function clampPage(page, itemCount, pageSize = STORAGE_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(itemCount / pageSize));
  const normalizedPage = Number(page);

  if (!Number.isInteger(normalizedPage)) {
    return 0;
  }

  return Math.max(0, Math.min(totalPages - 1, normalizedPage));
}

function truncateLabel(value, maxLength = 18) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

function truncateFieldValue(value, maxLength = 1024) {
  const text = String(value || "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 18)}\n...and more.` : text;
}

function getBattleActionVersion(context) {
  return Number(context.battle.action_version || 1);
}

function battleCustomId(context, action, value = "_") {
  return `battle:${context.battle.id}:${action}:${value}:${getBattleActionVersion(context)}`;
}

function createBattleButtons(context) {
  const { battle, state, activeMonster, inventory, party, player } = context;
  const controlsLocked = Boolean(battle.action_lock_token);

  if (!battle.active) {
    return [];
  }

  if (state.forceSwitch || state.currentMenu === "switch") {
    const switchButtons = party
      .map(monster => new ButtonBuilder()
        .setCustomId(battleCustomId(context, "switch", monster.id))
        .setLabel(`${monster.party_slot}. ${truncateLabel(getMonsterDisplayName(monster), 62)}${monster.current_hp <= 0 ? " (Fainted)" : ""}`)
        .setStyle(monster.current_hp > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setDisabled(controlsLocked || monster.current_hp <= 0 || monster.id === state.playerActiveMonsterId));

    const rows = chunkButtons(switchButtons);

    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(battleCustomId(context, "back"))
          .setLabel(state.forceSwitch ? "Locked" : "Back")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(controlsLocked || state.forceSwitch)
      )
    );

    return rows;
  }

  if (state.currentMenu === "fight") {
    const moveButtons = activeMonster.moves.map(move => new ButtonBuilder()
      .setCustomId(battleCustomId(context, "move", move.key))
      .setLabel(move.name)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(controlsLocked));

    const rows = chunkButtons(moveButtons);
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(battleCustomId(context, "back"))
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(controlsLocked)
      )
    );
    return rows;
  }

  if (state.currentMenu === "bag") {
    const battleItems = inventory.filter(item => canShowBattleItem(item, battle.battle_type, player));
    const bagButtons = battleItems.map(item => new ButtonBuilder()
      .setCustomId(battleCustomId(context, "item", item.key))
      .setLabel(truncateLabel(formatBattleItemLabel(item), 80))
      .setStyle(item.battleUsage === "capture" ? ButtonStyle.Success : ButtonStyle.Primary)
      .setDisabled(controlsLocked)
    );

    return [
      ...chunkButtons(bagButtons),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(battleCustomId(context, "back"))
          .setLabel("Back")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(controlsLocked)
      )
    ];
  }

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(battleCustomId(context, "menu", "fight"))
        .setLabel("Fight")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(controlsLocked),
      new ButtonBuilder()
        .setCustomId(battleCustomId(context, "menu", "bag"))
        .setLabel("Bag")
        .setStyle(ButtonStyle.Success)
        .setDisabled(controlsLocked),
      new ButtonBuilder()
        .setCustomId(battleCustomId(context, "menu", "switch"))
        .setLabel("Switch")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(controlsLocked),
      new ButtonBuilder()
        .setCustomId(battleCustomId(context, "run"))
        .setLabel("Run")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(controlsLocked || battle.battle_type !== "wild")
    )
  ];
}

function buildTrainerBattleButtons(context) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`pvp:${context.battle.id}:menu:fight`)
        .setLabel("Fight")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`pvp:${context.battle.id}:menu:bag`)
        .setLabel("Bag")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`pvp:${context.battle.id}:menu:switch`)
        .setLabel("Switch")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function buildTrainerBattleView(context, options = {}) {
  const [leftSide, rightSide] = context.participants;
  const leftStatus = leftSide.side.forceSwitch
    ? "Must switch"
    : leftSide.side.selectedAction
      ? "Ready"
      : "Choosing";
  const rightStatus = rightSide.side.forceSwitch
    ? "Must switch"
    : rightSide.side.selectedAction
      ? "Ready"
      : "Choosing";
  const playbackText = formatPlaybackText(options.playbackFrame, options.playbackIndex, options.playbackTotal);
  const battleLog = formatBattleLog(context.state.log, playbackText, 6);
  const description = playbackText
    ? "Turn resolution is playing out inside this battle card. Controls are locked until the action finishes."
    : `Turn ${context.state.turnNumber} is live. Both trainers lock in actions before the turn resolves.`;

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle(`Trainer Battle - ${context.title}`)
    .setDescription(description)
    .addFields(
      {
        name: `${leftSide.name} - ${formatMonsterName(leftSide.activeMonster)} Lv.${leftSide.activeMonster.level}`,
        value: `${formatTypes(leftSide.activeMonster.types)}\nHP ${createHealthBar(leftSide.activeMonster.current_hp, leftSide.activeMonster.max_hp)} ${leftSide.activeMonster.current_hp}/${leftSide.activeMonster.max_hp}\nStatus: ${leftStatus}`,
        inline: false
      },
      {
        name: `${rightSide.name} - ${formatMonsterName(rightSide.activeMonster)} Lv.${rightSide.activeMonster.level}`,
        value: `${formatTypes(rightSide.activeMonster.types)}\nHP ${createHealthBar(rightSide.activeMonster.current_hp, rightSide.activeMonster.max_hp)} ${rightSide.activeMonster.current_hp}/${rightSide.activeMonster.max_hp}\nStatus: ${rightStatus}`,
        inline: false
      },
      {
        name: "Battle Log",
        value: battleLog || "- No turns have been taken yet.",
        inline: false
      }
    )
    .setFooter({
      text: `Session #${context.battle.id} | ${context.battle.active ? "In progress" : "Finished"}`
    });

  return {
    embeds: [embed],
    components: context.battle.active ? buildTrainerBattleButtons(context) : []
  };
}

function buildBattleView(context, options = {}) {
  if (context.isPvp) {
    return buildTrainerBattleView(context, options);
  }

  const { battle, state, activeMonster, enemyActive } = context;
  const color = getTypeColor(enemyActive?.types?.[0] || activeMonster?.types?.[0]);
  const playbackText = formatPlaybackText(options.playbackFrame, options.playbackIndex, options.playbackTotal);
  const battleLog = formatBattleLog(state.log, playbackText, 5);
  const resultText = state.rewardSummary?.result === "lose"
    ? "Your party was rushed to the healing center. Use Back To Hub to keep going."
    : state.rewardSummary?.result === "win"
      ? "Battle complete. Use Back To Hub to continue your journey."
      : null;
  const menuHint = playbackText
    ? "Controls are locked while this turn resolves."
    : resultText || (state.forceSwitch
      ? "Choose a healthy monster to keep the battle going."
      : state.currentMenu === "fight"
        ? "Pick a move."
        : state.currentMenu === "bag"
          ? "Use an item."
          : "Choose your next action.");
  const description = !battle.active && state.rewardSummary?.result === "lose"
    ? "Defeat. Your usable BitPals are down, but the healing center has restored your party."
    : !battle.active && state.rewardSummary?.result === "win"
      ? "Victory. The battle is complete."
      : battle.battle_type === "gym"
        ? `Gym battle session active. Badge on the line: ${state.badgeName}`
        : battle.battle_type === "trainer_npc"
          ? `${state.trainerName} wants a proper trainer battle. No running and no captures.`
          : "Wild encounter session active.";

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(context.title)
    .setDescription(description)
    .addFields(
      {
        name: `Opponent - ${enemyActive.species} Lv.${enemyActive.level}`,
        value: `${formatTypes(enemyActive.types)}\nHP ${createHealthBar(enemyActive.currentHp, enemyActive.maxHp)} ${enemyActive.currentHp}/${enemyActive.maxHp}`,
        inline: false
      },
      {
        name: `Your Active - ${formatMonsterName(activeMonster)} Lv.${activeMonster.level}`,
        value: `${formatTypes(activeMonster.types)}\nHP ${createHealthBar(activeMonster.current_hp, activeMonster.max_hp)} ${activeMonster.current_hp}/${activeMonster.max_hp}\nEXP ${createExperienceBar(activeMonster.expCurrent, activeMonster.expNeeded)} ${activeMonster.expCurrent}/${activeMonster.expNeeded}`,
        inline: false
      },
      {
        name: "Battle Log",
        value: battleLog || "- No turns have been taken yet.",
        inline: false
      },
      {
        name: "Action Prompt",
        value: menuHint,
        inline: false
      }
    )
    .setFooter({
      text: `Session #${battle.id} | ${battle.active ? "In progress" : "Finished"}`
    });

  return {
    embeds: [embed],
    components: battle.active
      ? createBattleButtons(context)
      : context.player?.id
        ? [buildHubReturnRow(context.player.id)]
        : []
  };
}

function buildSingleRewardMessage(summary) {
  const encounterLabels = {
    wild: "Wild encounter payout",
    trainer_npc: "Trainer encounter payout",
    gym: "Gym battle payout"
  };
  const resultDescription = summary.result === "lose"
    ? "Your trainer is out of usable BitPals. Your party was rushed to the healing center and restored."
    : encounterLabels[summary.battleType] || "Battle reward summary";

  const embed = new EmbedBuilder()
    .setColor(summary.result === "win" ? 0x2ecc71 : 0xe74c3c)
    .setTitle(summary.result === "win" ? "Battle Rewards" : "Battle Results")
    .setDescription(resultDescription)
    .addFields(
      {
        name: "Credits",
        value: formatMoneyDelta(summary.moneyDelta, "earned", "lost"),
        inline: true
      },
      {
        name: "Payout Tier",
        value: formatRewardProfile(summary.rewardProfile),
        inline: true
      },
      {
        name: "Loot",
        value: formatLootLines(summary.items),
        inline: true
      },
      {
        name: "Badge",
        value: summary.badge || "No badge earned",
        inline: true
      },
      {
        name: "Experience",
        value: formatExperienceLines(summary.experience),
        inline: false
      },
      {
        name: "Level Ups",
        value: formatLevelUpLines(summary.experience),
        inline: false
      },
      {
        name: "Recovery",
        value: summary.healedAtCenter ? "Your party was restored at the healing center." : "No healing center visit needed.",
        inline: false
      }
    );

  return {
    content: `<@${summary.playerId}>`,
    embeds: [embed]
  };
}

function buildPvpRewardMessage(summary) {
  const participantFields = summary.players.map(player => ({
    name: `${player.name} - ${player.result === "winner" ? "Winner" : "Runner-up"}`,
    value: [
      `Payout: ${formatRewardProfile(player.rewardProfile).replace("\n", " ")}`,
      `Credits: ${formatMoneyDelta(player.moneyDelta, "earned", "lost")}`,
      `Experience:\n${formatExperienceLines(player.experience)}`,
      `Level Ups:\n${formatLevelUpLines(player.experience)}`
    ].join("\n"),
    inline: false
  }));

  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("Trainer Battle Rewards")
    .setDescription(`${summary.winnerName} defeated ${summary.loserName}.`)
    .addFields(participantFields);

  return {
    content: `<@${summary.winnerId}> <@${summary.loserId}>`,
    embeds: [embed]
  };
}

function buildRewardMessage(summary) {
  if (!summary) {
    return null;
  }

  if (summary.kind === "pvp") {
    return buildPvpRewardMessage(summary);
  }

  return buildSingleRewardMessage(summary);
}

function buildLevelUpMessage(playerId, entry, trainerName = null) {
  const displayName = formatRewardEntryName(entry);
  const speciesName = entry.species || entry.monster?.species || displayName;
  const types = entry.types || entry.monster?.types || [];

  const embed = new EmbedBuilder()
    .setColor(getTypeColor(types[0]))
    .setTitle(`${displayName} leveled up!`)
    .setDescription(
      trainerName
        ? `${trainerName}'s ${displayName} surged from Lv.${entry.oldLevel} to Lv.${entry.newLevel}.`
        : `${displayName} surged from Lv.${entry.oldLevel} to Lv.${entry.newLevel}.`
    )
    .addFields(
      {
        name: "Level Progress",
        value: `Lv.${entry.oldLevel} -> Lv.${entry.newLevel}\nEXP gained: +${entry.experienceGain}`,
        inline: true
      },
      {
        name: "Stat Gains",
        value: [
          `HP: ${entry.oldStats.max_hp} -> ${entry.newStats.max_hp} (+${entry.statGains.max_hp})`,
          `Attack: ${entry.oldStats.attack} -> ${entry.newStats.attack} (+${entry.statGains.attack})`,
          `Defense: ${entry.oldStats.defense} -> ${entry.newStats.defense} (+${entry.statGains.defense})`,
          `Speed: ${entry.oldStats.speed} -> ${entry.newStats.speed} (+${entry.statGains.speed})`
        ].join("\n"),
        inline: false
      },
      {
        name: "Moves Learned",
        value: entry.learnedMoves?.length > 0
          ? entry.learnedMoves.map(move => `Lv.${move.level} - ${formatMoveDetails(move)}`).join("\n")
          : "No new moves learned this time.",
        inline: false
      },
      {
        name: "Battle Move Set",
        value: formatActiveMoveSummary(entry.moveSetChanges),
        inline: false
      }
    );

  return {
    content: `<@${playerId}>`,
    embeds: [embed]
  };
}

function buildLevelUpMessages(summary) {
  if (!summary) {
    return [];
  }

  if (summary.kind === "pvp") {
    return summary.players.flatMap(player =>
      player.experience
        .filter(entry => entry.gainedLevels > 0)
        .map(entry => buildLevelUpMessage(player.playerId, entry, player.name))
    );
  }

  return (summary.experience || [])
    .filter(entry => entry.gainedLevels > 0)
    .map(entry => buildLevelUpMessage(summary.playerId, entry));
}

function buildEvolutionMessage(playerId, entry, trainerName = null) {
  const evolution = entry.evolution;
  const titleTarget = evolution?.monster ? formatMonsterName(evolution.monster) : formatRewardEntryName(entry);
  const triggerText = evolution?.triggerMethod === "item"
    ? `used ${getItem(evolution.triggerItemKey)?.name || evolution.triggerItemKey}`
    : `reached Lv.${entry.newLevel}`;

  const embed = new EmbedBuilder()
    .setColor(getTypeColor(entry.types?.[0] || evolution?.monster?.types?.[0]))
    .setTitle(`${titleTarget} evolved!`)
    .setDescription(
      trainerName
        ? `${trainerName}'s ${titleTarget} evolved from ${evolution.oldSpecies} into ${evolution.newSpecies} after it ${triggerText}.`
        : `${titleTarget} evolved from ${evolution.oldSpecies} into ${evolution.newSpecies} after it ${triggerText}.`
    )
    .addFields(
      {
        name: "Stat Growth",
        value: [
          `HP: ${evolution.oldStats.max_hp} -> ${evolution.newStats.max_hp} (+${evolution.statGains.max_hp})`,
          `Attack: ${evolution.oldStats.attack} -> ${evolution.newStats.attack} (+${evolution.statGains.attack})`,
          `Defense: ${evolution.oldStats.defense} -> ${evolution.newStats.defense} (+${evolution.statGains.defense})`,
          `Speed: ${evolution.oldStats.speed} -> ${evolution.newStats.speed} (+${evolution.statGains.speed})`
        ].join("\n"),
        inline: false
      },
      {
        name: "New Identity",
        value: `${formatMonsterName(evolution.monster)} | ${formatTypes(evolution.monster.types)}\n${formatMonsterIdentity(evolution.monster)}\n${formatEvolutionStatus(evolution.monster)}`,
        inline: false
      }
    );

  return {
    content: `<@${playerId}>`,
    embeds: [embed]
  };
}

function buildEvolutionMessages(summary) {
  if (!summary) {
    return [];
  }

  if (summary.kind === "pvp") {
    return summary.players.flatMap(player =>
      player.experience
        .filter(entry => entry.evolution)
        .map(entry => buildEvolutionMessage(player.playerId, entry, player.name))
    );
  }

  return (summary.experience || [])
    .filter(entry => entry.evolution)
    .map(entry => buildEvolutionMessage(summary.playerId, entry));
}

function buildHelpEmbed(prefix = "!") {
  return new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("BitPals Command Guide")
    .setDescription("Everything players can use right now to start, battle, heal, shop, and challenge other trainers.")
    .addFields(
      {
        name: "Getting Started",
        value: [
          `\`${prefix}start\` - Open the starter selection screen.`,
          `\`${prefix}start fire|water|grass\` - Pick a starter theme on first setup.`,
          `\`${prefix}start Flameling|Squirtie|Leafy\` - Type a starter name instead of using buttons.`,
          `\`${prefix}commands\` - Open the button command hub.`
        ].join("\n"),
        inline: false
      },
      {
        name: "Exploration And Battles",
        value: [
          `\`${prefix}explore\` - Start a wild encounter or random NPC trainer battle.`,
          `\`${prefix}travel <area name>\` - Move to an unlocked area and see its progression gates.`,
          `\`${prefix}battle @user\` - Challenge a specific Discord user.`,
          `\`${prefix}battle open\` - Post an open trainer challenge anyone can accept.`,
          `\`${prefix}battle accept\` - Accept the latest open challenge in the channel.`,
          `\`${prefix}gym\` - View the current area's gym board.`,
          `\`${prefix}gym challenge\` - Start the current area's gym battle.`,
          `\`${prefix}attack\` - Text fallback for a quick attack in non-PvP battles.`,
          `\`${prefix}capture\` - Text fallback to throw your best usable capture orb in wild battles.`
        ].join("\n"),
        inline: false
      },
      {
        name: "Team And Bag",
        value: [
          `\`${prefix}party\` - View your active 6-monster party.`,
          `\`${prefix}storage\` - Open your full storage system.`,
          `\`${prefix}switch <slot>\` - Make a party slot your lead monster.`,
          `\`${prefix}switch <from> <to>\` - Reorder party slots.`,
          `\`${prefix}switch box <monsterId> <slot>\` - Move a boxed monster into your party.`,
          `\`${prefix}inventory\` - View your bag and item counts.`,
          `\`${prefix}shop\` - Open the item shop.`,
          `\`${prefix}shop buy <item name> [quantity]\` - Buy any listed item, including evolution items.`,
          `\`${prefix}shop sell <item name> [quantity]\` - Sell items from your bag for credits.`,
          `\`${prefix}use <item name> <monsterId>\` - Use an evolution item on a specific monster.`,
          `\`${prefix}heal\` - Restore your full team at the healing center.`
        ].join("\n"),
        inline: false
      },
      {
        name: "Tips",
        value: [
          "Most battles are button-based once the battle board appears.",
          "Trainer-vs-trainer battles must be played from the shared battle board buttons.",
          "Reward, loot, EXP, and level-up notices appear in a separate follow-up message after battle.",
          "Some BitPals evolve by level, while others need a special evolution item."
        ].join("\n"),
        inline: false
      }
    )
    .setFooter({
      text: `Try ${prefix}commands for the button hub, or ${prefix}bitpals help for typed fallbacks.`
    });
}

function formatBadgeCase(player) {
  return player?.badges?.length > 0 ? player.badges.join(", ") : "No badges yet";
}

function buildCommandHubEmbed(username, player, currentArea, notice = null) {
  const currentGym = currentArea?.gymKey ? getGym(currentArea.gymKey) : null;
  const hasProfile = Boolean(player);
  const statusLines = hasProfile
    ? [
      `Area: ${currentArea?.name || "Starter Plains"}`,
      `Credits: ${player.money || 0}`,
      `Badges: ${formatBadgeCase(player)}`,
      currentGym
        ? player.badges?.includes(currentGym.badgeName)
          ? `Gym: ${currentGym.name} cleared`
          : `Gym: ${currentGym.name} available`
        : "Gym: No official gym in this area"
    ]
    : [
      "No trainer profile found yet.",
      "Press Start / Starter to choose your first BitPal."
    ];

  return new EmbedBuilder()
    .setColor(0x3c82e8)
    .setTitle("BitPals Command Hub")
    .setDescription(notice || `${username}, this is your button controller. Use it for the main game flow and keep typed commands as a backup.`)
    .addFields(
      {
        name: "Trainer Status",
        value: statusLines.join("\n"),
        inline: false
      },
      {
        name: "Main Loop",
        value: "Explore for encounters, heal at the center, travel after badges, challenge gyms, and manage your party from the buttons below.",
        inline: false
      },
      {
        name: "Fallback",
        value: "If a button flow ever fails or Discord gets weird, `!bitpals help` still shows the typed backup commands.",
        inline: false
      }
    );
}

function buildHubReturnRow(ownerId, label = "Back To Hub") {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`hub:${ownerId}:home`)
      .setLabel(label)
      .setStyle(ButtonStyle.Secondary)
  );
}

function withHubReturn(payload, ownerId, label = "Back To Hub") {
  const components = [...(payload.components || [])];
  if (components.length < 5) {
    components.push(buildHubReturnRow(ownerId, label));
  }

  return {
    ...payload,
    components
  };
}

function buildCommandHubButtons(ownerId, hasStarter = false) {
  if (!hasStarter) {
    return [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`hub:${ownerId}:start`)
          .setLabel("Start / Starter")
          .setStyle(ButtonStyle.Success)
      )
    ];
  }

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hub:${ownerId}:explore`)
        .setLabel("Explore")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`hub:${ownerId}:travel`)
        .setLabel("Travel")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`hub:${ownerId}:gym`)
        .setLabel("Gym")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`hub:${ownerId}:heal`)
        .setLabel("Heal Center")
        .setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hub:${ownerId}:party`)
        .setLabel("Party")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`hub:${ownerId}:storage`)
        .setLabel("Storage")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`hub:${ownerId}:bag`)
        .setLabel("Bag")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`hub:${ownerId}:shop`)
        .setLabel("Shop")
        .setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`hub:${ownerId}:trade`)
        .setLabel("Trade")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`hub:${ownerId}:battle_open`)
        .setLabel("Open Challenge")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`hub:${ownerId}:battle_direct`)
        .setLabel("Direct Challenge")
        .setStyle(ButtonStyle.Primary)
    )
  ];
}

function buildCommandHubView(username, ownerId, player = null, currentArea = null, notice = null, hasStarter = Boolean(player)) {
  return {
    embeds: [buildCommandHubEmbed(username, player, currentArea, notice)],
    components: buildCommandHubButtons(ownerId, hasStarter)
  };
}

function buildTravelButtons(ownerId, currentArea, unlockedAreas) {
  const areaButtons = unlockedAreas.map(area => new ButtonBuilder()
    .setCustomId(`travel:${ownerId}:go:${area.key}`)
    .setLabel(truncateLabel(area.name, 80))
    .setStyle(area.key === currentArea?.key ? ButtonStyle.Secondary : ButtonStyle.Primary)
    .setDisabled(area.key === currentArea?.key));

  return [
    ...chunkButtons(areaButtons),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`travel:${ownerId}:hub`)
        .setLabel("Back To Hub")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function buildDirectChallengeModal(ownerId) {
  const trainerInput = new TextInputBuilder()
    .setCustomId("trainer")
    .setLabel("Trainer")
    .setPlaceholder("Mention, user ID, username, or server display name")
    .setRequired(true)
    .setMaxLength(80)
    .setStyle(TextInputStyle.Short);

  return new ModalBuilder()
    .setCustomId(`challenge_direct:${ownerId}`)
    .setTitle("Direct Trainer Challenge")
    .addComponents(new ActionRowBuilder().addComponents(trainerInput));
}

function buildTradeOfferModal(ownerId) {
  const trainerInput = new TextInputBuilder()
    .setCustomId("trainer")
    .setLabel("Trainer")
    .setPlaceholder("Mention, user ID, username, or server display name")
    .setRequired(true)
    .setMaxLength(80)
    .setStyle(TextInputStyle.Short);
  const offeredMonsterInput = new TextInputBuilder()
    .setCustomId("offered_monster_id")
    .setLabel("Your Monster ID")
    .setPlaceholder("Example: 12")
    .setRequired(true)
    .setMaxLength(10)
    .setStyle(TextInputStyle.Short);
  const requestedMonsterInput = new TextInputBuilder()
    .setCustomId("requested_monster_id")
    .setLabel("Requested Monster ID")
    .setPlaceholder("Example: 27")
    .setRequired(true)
    .setMaxLength(10)
    .setStyle(TextInputStyle.Short);

  return new ModalBuilder()
    .setCustomId(`trade_offer:${ownerId}`)
    .setTitle("Create Trade Offer")
    .addComponents(
      new ActionRowBuilder().addComponents(trainerInput),
      new ActionRowBuilder().addComponents(offeredMonsterInput),
      new ActionRowBuilder().addComponents(requestedMonsterInput)
    );
}

function getTradeStatusText(trade) {
  const status = String(trade.status || "pending").toLowerCase();
  if (status === "completed") {
    return "Completed";
  }

  if (status === "declined") {
    return "Declined";
  }

  if (status === "cancelled") {
    return "Cancelled";
  }

  if (status === "stale") {
    return "Expired because one of the monsters changed trades.";
  }

  return "Waiting for response";
}

function buildTradeOfferEmbed(trade) {
  const isActive = Boolean(trade.active) && trade.status === "pending";
  return new EmbedBuilder()
    .setColor(isActive ? 0x3c82e8 : 0x7f8c8d)
    .setTitle("BitPals Trade Offer")
    .setDescription(`${trade.proposer_name} wants to trade with ${trade.target_name}.`)
    .addFields(
      {
        name: `${trade.proposer_name} Offers`,
        value: `#${trade.proposer_monster_id} ${trade.proposer_monster_name}`,
        inline: true
      },
      {
        name: `${trade.target_name} Gives`,
        value: `#${trade.target_monster_id} ${trade.target_monster_name}`,
        inline: true
      },
      {
        name: "Status",
        value: getTradeStatusText(trade),
        inline: false
      }
    )
    .setFooter({
      text: `Trade #${trade.id}`
    });
}

function buildTradeOfferButtons(trade, disabled = false) {
  const inactive = disabled || !trade.active || trade.status !== "pending";
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`trade:${trade.id}:accept`)
        .setLabel("Accept Trade")
        .setStyle(ButtonStyle.Success)
        .setDisabled(inactive),
      new ButtonBuilder()
        .setCustomId(`trade:${trade.id}:decline`)
        .setLabel("Decline")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(inactive),
      new ButtonBuilder()
        .setCustomId(`trade:${trade.id}:cancel`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(inactive)
    )
  ];
}

function buildPublicLaunchView() {
  const embed = new EmbedBuilder()
    .setColor(0x3c82e8)
    .setTitle("Play BitPals")
    .setDescription("Press the button below to open your private BitPals command hub. Your party, bag, shop, travel, and solo battles will stay visible only to you.")
    .addFields(
      {
        name: "Clean Channel Mode",
        value: "This post is the shared launch point. Battle rewards, level-ups, and evolution notices are sent by DM to keep this channel readable.",
        inline: false
      },
      {
        name: "Public Moments",
        value: "Trainer-vs-trainer challenge offers still appear in the channel so other trainers can accept them.",
        inline: false
      }
    );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("launch:bitpals")
          .setLabel("Start Game / Open Hub")
          .setStyle(ButtonStyle.Success)
      )
    ]
  };
}

function buildAccountResetConfirmView(request, guildName = "this server") {
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle("Confirm BitPals Account Reset")
    .setDescription(
      [
        `A server administrator in ${guildName} requested a full reset of your BitPals trainer account.`,
        "This deletes your trainer profile, monsters, inventory, and closes active battles/trades/challenges.",
        "Only press Confirm if you personally want to start over as a brand-new trainer."
      ].join("\n\n")
    )
    .setFooter({ text: `Reset request #${request.id} | Expires in 15 minutes` });

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`account_reset:${request.id}:confirm:${request.token}`)
          .setLabel("Confirm Reset")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`account_reset:${request.id}:cancel:${request.token}`)
          .setLabel("Cancel")
          .setStyle(ButtonStyle.Secondary)
      )
    ]
  };
}

function buildAccountResetResolvedView(status) {
  const confirmed = status === "confirmed";
  const embed = new EmbedBuilder()
    .setColor(confirmed ? 0xe74c3c : 0x95a5a6)
    .setTitle(confirmed ? "BitPals Account Reset Complete" : "BitPals Account Reset Cancelled")
    .setDescription(
      confirmed
        ? "Your trainer account has been reset. Return to the BitPals channel and choose a new starter."
        : "Your trainer account was not changed."
    );

  return {
    embeds: [embed],
    components: []
  };
}

function getStarterButtonStyle(theme) {
  if (theme === "Fire") {
    return ButtonStyle.Danger;
  }

  if (theme === "Water") {
    return ButtonStyle.Primary;
  }

  if (theme === "Grass") {
    return ButtonStyle.Success;
  }

  return ButtonStyle.Secondary;
}

function buildStarterChoiceView(username, ownerId, prefix = "!", notice = null) {
  const starters = getStarterOptions();
  const embed = new EmbedBuilder()
    .setColor(0xf39c12)
    .setTitle("Choose Your Starter BitPal")
    .setDescription(
      [
        notice || `${username}, pick one starter to begin your BitPals journey.`,
        `Use the buttons below, or type \`${prefix}start <monsterName>\`.`
      ].join("\n")
    )
    .addFields(
      starters.map(starter => ({
        name: `${starter.species} - ${starter.theme}`,
        value: [
          starter.description,
          starter.data ? `Type: ${formatTypes(starter.data.types)} | Base EXP: ${starter.data.baseExp}` : "Starter data unavailable."
        ].join("\n"),
        inline: false
      }))
    )
    .setFooter({
      text: "This starter choice can only be claimed by the trainer who opened it."
    });

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        starters.map(starter => new ButtonBuilder()
          .setCustomId(`starter:${ownerId}:choose:${starter.species}`)
          .setLabel(`Choose ${starter.species}`)
          .setStyle(getStarterButtonStyle(starter.theme)))
      )
    ]
  };
}

function buildStarterClaimedView(username, result, ownerId = null) {
  const starter = result.starter;
  const embed = new EmbedBuilder()
    .setColor(getTypeColor(starter.types?.[0]))
    .setTitle(result.alreadyStarted ? "Trainer Already Registered" : "Starter Claimed")
    .setDescription(
      result.alreadyStarted
        ? `${username}, your trainer profile is already active. Your lead BitPal is ${formatMonsterName(starter)} Lv.${starter.level}.`
        : `${username}, welcome to BitPals. Your starter is ${formatMonsterName(starter)} Lv.${starter.level}, and your bag now has Scout Orbs and Potions.`
    )
    .addFields(
      {
        name: "Starter",
        value: `${formatMonsterName(starter)}\n${formatTypes(starter.types)}\nHP ${createHealthBar(starter.current_hp, starter.max_hp)} ${starter.current_hp}/${starter.max_hp}`,
        inline: false
      },
      {
        name: "Next Steps",
        value: ownerId
          ? "Press Refresh Hub to return to the button controller, then use Explore, Party, Travel, and Gym from there."
          : "Use `!commands` to open the button hub, then use Explore, Party, Travel, and Gym from there.",
        inline: false
      }
    );

  return {
    embeds: [embed],
    components: ownerId
      ? [
        buildHubReturnRow(ownerId, "Refresh Hub")
      ]
      : []
  };
}

function buildTrainerActionMenu(context, playerId, menu) {
  const participant = context.byId[playerId];
  const side = participant.side;

  if (menu === "fight") {
    return {
      content: side.forceSwitch ? "Your active monster fainted. You must switch." : `Choose a move for ${formatMonsterName(participant.activeMonster)}.`,
      components: side.forceSwitch
        ? []
        : chunkButtons(
          participant.activeMonster.moves.map(move => new ButtonBuilder()
            .setCustomId(`pvp:${context.battle.id}:move:${move.key}`)
            .setLabel(move.name)
            .setStyle(ButtonStyle.Primary))
        ),
      flags: MessageFlags.Ephemeral
    };
  }

  if (menu === "bag") {
    const usableItems = participant.inventory.filter(item => canShowBattleItem(item, "trainer_pvp", participant.player));

    return {
      content: side.forceSwitch ? "Your active monster fainted. You must switch." : "Choose a healing item.",
      components: side.forceSwitch || usableItems.length === 0
        ? []
        : chunkButtons(
          usableItems.map(item => new ButtonBuilder()
            .setCustomId(`pvp:${context.battle.id}:item:${item.key}`)
            .setLabel(truncateLabel(formatBattleItemLabel(item), 80))
            .setStyle(ButtonStyle.Success))
        ),
      flags: MessageFlags.Ephemeral
    };
  }

  const switchOptions = participant.party
    .map(monster => new ButtonBuilder()
      .setCustomId(`pvp:${context.battle.id}:switch:${monster.id}`)
      .setLabel(`${monster.party_slot}. ${truncateLabel(getMonsterDisplayName(monster), 62)}${monster.current_hp <= 0 ? " (Fainted)" : ""}`)
      .setStyle(monster.current_hp > 0 ? ButtonStyle.Secondary : ButtonStyle.Danger)
      .setDisabled(monster.current_hp <= 0 || monster.id === side.activeMonsterId));

  return {
    content: "Choose the monster you want to switch in.",
    components: switchOptions.length > 0 ? chunkButtons(switchOptions) : [],
    flags: MessageFlags.Ephemeral
  };
}

function buildChallengeEmbed(challenge) {
  const targetText = challenge.opponent_id
    ? `${challenge.opponent_name || "Specific trainer"} only`
    : "Any trainer can accept this battle";

  return new EmbedBuilder()
    .setColor(0xe67e22)
    .setTitle("Trainer Challenge")
    .setDescription(`${challenge.challenger_name} wants a trainer battle.`)
    .addFields(
      {
        name: "Type",
        value: challenge.challenge_type === "targeted" ? "Direct challenge" : "Open challenge",
        inline: true
      },
      {
        name: "Acceptance",
        value: targetText,
        inline: false
      }
    )
    .setFooter({
      text: `Challenge #${challenge.id}`
    });
}

function buildChallengeButtons(challenge, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`challenge:${challenge.id}:accept`)
        .setLabel("Accept")
        .setStyle(ButtonStyle.Success)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`challenge:${challenge.id}:cancel`)
        .setLabel("Cancel")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
    )
  ];
}

function getEditableMoveSlotCount(monster) {
  return Math.max(monster.moves.length, Math.min(4, monster.learnedMoves?.length || 0));
}

function formatMonsterMoveList(moves = []) {
  if (moves.length === 0) {
    return "No active moves set.";
  }

  return moves
    .map((move, index) => `${index + 1}. ${formatMoveDetails(move)}`)
    .join("\n");
}

function formatLearnedMoveList(learnedMoves = []) {
  if (learnedMoves.length === 0) {
    return "No learned moves yet.";
  }

  return learnedMoves
    .map(move => `${move.active ? "[Active]" : "[Learned]"} Lv.${move.learnedAt} - ${formatMoveDetails(move)}`)
    .join("\n");
}

function formatMonsterIdentity(monster) {
  const personalityText = monster.personalityEffects && monster.personalityEffects !== "Neutral"
    ? `${monster.personalityName} (${monster.personalityEffects})`
    : `${monster.personalityName} (${monster.personalityEffects || "Neutral"})`;

  return `Gender: ${monster.gender} | Personality: ${personalityText}`;
}

function formatEvolutionStatus(monster) {
  if (!monster.nextEvolution) {
    return "Final stage";
  }

  if (monster.nextEvolution.method === "level") {
    return `Next: ${monster.nextEvolution.species} at Lv.${monster.nextEvolution.level}`;
  }

  if (monster.nextEvolution.method === "item") {
    const item = getItem(monster.nextEvolution.itemKey);
    return `Next: ${monster.nextEvolution.species} using ${item?.name || monster.nextEvolution.itemKey}`;
  }

  return `Next: ${monster.nextEvolution.species}`;
}

function formatProfileLine(label, value, maxValue) {
  return `${label}: ${createBar(value, maxValue, 8)} ${value}/${maxValue}`;
}

function formatPotentialProfile(monster) {
  return [
    formatProfileLine("HP", monster.potential.hp, 31),
    formatProfileLine("Attack", monster.potential.attack, 31),
    formatProfileLine("Defense", monster.potential.defense, 31),
    formatProfileLine("Speed", monster.potential.speed, 31),
    `Total Potential: ${monster.potentialTotal}/124`
  ].join("\n");
}

function formatTrainingProfile(monster) {
  return [
    formatProfileLine("HP", monster.training.hp, 252),
    formatProfileLine("Attack", monster.training.attack, 252),
    formatProfileLine("Defense", monster.training.defense, 252),
    formatProfileLine("Speed", monster.training.speed, 252),
    `Total Training: ${monster.trainingTotal}/510`
  ].join("\n");
}

function buildPartyButtons(ownerId, party) {
  const buttons = party.map(monster => new ButtonBuilder()
    .setCustomId(`party:${ownerId}:view:${monster.id}`)
    .setLabel(`${monster.party_slot}. ${truncateLabel(getMonsterDisplayName(monster), 70)}`)
    .setStyle(monster.current_hp > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary));

  return chunkButtons(buttons);
}

function buildPartyMenuButtons(ownerId, boxCount, partyCount = 0) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`party:${ownerId}:switchslots`)
        .setLabel("Switch Slots")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(partyCount < 2),
      new ButtonBuilder()
        .setCustomId(`storage:${ownerId}:page:0`)
        .setLabel(`Open Storage (${boxCount})`)
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function buildPartyView(username, ownerId, party, box) {
  return {
    embeds: [buildPartyEmbed(username, party, box)],
    components: [
      ...(party.length > 0 ? buildPartyButtons(ownerId, party) : []),
      ...buildPartyMenuButtons(ownerId, box.length, party.length)
    ]
  };
}

function buildPartySwitchModal(ownerId) {
  const fromSlotInput = new TextInputBuilder()
    .setCustomId("from_slot")
    .setLabel("From Party Slot")
    .setPlaceholder("Example: 2")
    .setRequired(true)
    .setMaxLength(1)
    .setStyle(TextInputStyle.Short);
  const toSlotInput = new TextInputBuilder()
    .setCustomId("to_slot")
    .setLabel("To Party Slot")
    .setPlaceholder("Example: 1")
    .setRequired(true)
    .setMaxLength(1)
    .setStyle(TextInputStyle.Short);

  return new ModalBuilder()
    .setCustomId(`party_switch:${ownerId}`)
    .setTitle("Switch Party Slots")
    .addComponents(
      new ActionRowBuilder().addComponents(fromSlotInput),
      new ActionRowBuilder().addComponents(toSlotInput)
    );
}

function buildPartyMonsterEmbed(username, monster, notice = null, footerText = null) {
  const embed = new EmbedBuilder()
    .setColor(getTypeColor(monster.types?.[0]))
    .setTitle(`${username}'s ${formatMonsterName(monster)}`)
    .setDescription(
      [
        `${monster.species} | Lv.${monster.level} | ${formatTypes(monster.types)}`,
        hasCustomNickname(monster) ? `Nickname: ${monster.customNickname}` : "Nickname: None",
        formatMonsterIdentity(monster),
        notice || "View current battle stats, active move set, and every learned move here."
      ].join("\n")
    )
    .addFields(
      {
        name: "Battle Stats",
        value: [
          `HP ${createHealthBar(monster.current_hp, monster.max_hp)} ${monster.current_hp}/${monster.max_hp}`,
          `Attack: ${monster.attack}`,
          `Defense: ${monster.defense}`,
          `Speed: ${monster.speed}`
        ].join("\n"),
        inline: false
      },
      {
        name: "Experience",
        value: `EXP ${createExperienceBar(monster.expCurrent, monster.expNeeded)} ${monster.expCurrent}/${monster.expNeeded}\nTo next level: ${monster.expToNext}`,
        inline: true
      },
      {
        name: "Evolution",
        value: formatEvolutionStatus(monster),
        inline: true
      },
      {
        name: "Potential",
        value: formatPotentialProfile(monster),
        inline: false
      },
      {
        name: "Training",
        value: formatTrainingProfile(monster),
        inline: false
      },
      {
        name: "Active Move Set",
        value: formatMonsterMoveList(monster.moves),
        inline: false
      },
      {
        name: "Learned Moves",
        value: formatLearnedMoveList(monster.learnedMoves),
        inline: false
      }
    )
    .setFooter({
      text: footerText || `Party slot ${monster.party_slot} | Monster #${monster.id}`
    });

  return embed;
}

function buildPartyMonsterButtons(ownerId, monster, partyCount = 1) {
  const slotCount = getEditableMoveSlotCount(monster);
  const editButtons = [];

  for (let slot = 1; slot <= slotCount; slot += 1) {
    const currentMove = monster.moves[slot - 1];
    editButtons.push(
      new ButtonBuilder()
        .setCustomId(`party:${ownerId}:edit:${monster.id}:${slot}`)
        .setLabel(currentMove ? `Edit ${slot}: ${currentMove.name}` : `Set Slot ${slot}`)
        .setStyle(ButtonStyle.Primary)
    );
  }

  const rows = chunkButtons(editButtons);
  rows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`party:${ownerId}:nickname:${monster.id}`)
        .setLabel("Change Nickname")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`party:${ownerId}:resetname:${monster.id}`)
        .setLabel("Reset Nickname")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasCustomNickname(monster)),
      new ButtonBuilder()
        .setCustomId(`party:${ownerId}:deposit:${monster.id}`)
        .setLabel("Send To Storage")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(partyCount <= 1),
      new ButtonBuilder()
        .setCustomId(`party:${ownerId}:lead:${monster.id}`)
        .setLabel("Make Lead")
        .setStyle(ButtonStyle.Success)
        .setDisabled(monster.party_slot === 1),
      new ButtonBuilder()
        .setCustomId(`party:${ownerId}:back`)
        .setLabel("Back To Party")
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return rows;
}

function buildPartyMonsterView(username, ownerId, monster, partyCount = 1, notice = null) {
  return {
    embeds: [buildPartyMonsterEmbed(username, monster, notice)],
    components: buildPartyMonsterButtons(ownerId, monster, partyCount)
  };
}

function buildNicknameModal(ownerId, monster) {
  const input = new TextInputBuilder()
    .setCustomId("nickname")
    .setLabel("Nickname")
    .setPlaceholder(`Leave blank to reset to ${monster.species}`)
    .setRequired(false)
    .setMaxLength(24)
    .setStyle(TextInputStyle.Short);

  if (hasCustomNickname(monster)) {
    input.setValue(monster.customNickname);
  }

  return new ModalBuilder()
    .setCustomId(`nickname:${ownerId}:${monster.id}`)
    .setTitle(`Rename ${truncateLabel(formatMonsterName(monster), 32)}`)
    .addComponents(new ActionRowBuilder().addComponents(input));
}

function buildPartyMoveEditorView(username, ownerId, monster, slot) {
  const slotNumber = Number(slot);
  const moveButtons = (monster.learnedMoves || []).map(move => new ButtonBuilder()
    .setCustomId(`party:${ownerId}:assign:${monster.id}:${slotNumber}:${move.key}`)
    .setLabel(move.name)
    .setStyle(move.active ? ButtonStyle.Success : ButtonStyle.Primary)
    .setDisabled(monster.moves[slotNumber - 1]?.key === move.key));

  const embed = buildPartyMonsterEmbed(
    username,
    monster,
    `Choose the move for slot ${slotNumber}. Learned moves stay listed here, and the active set updates immediately.`
  );

  const activeMoveFieldIndex = (embed.data.fields || []).findIndex(field => field.name === "Active Move Set");
  const replacementField = {
    name: `Editing Slot ${slotNumber}`,
    value: monster.moves[slotNumber - 1]
      ? `Current move: ${formatMoveDetails(monster.moves[slotNumber - 1])}`
      : "Current move: Empty slot",
    inline: false
  };

  if (activeMoveFieldIndex >= 0) {
    embed.spliceFields(activeMoveFieldIndex, 1, replacementField);
  } else {
    embed.addFields(replacementField);
  }

  return {
    embeds: [embed],
    components: [
      ...chunkButtons(moveButtons),
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`party:${ownerId}:view:${monster.id}`)
          .setLabel("Back To Monster")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`party:${ownerId}:back`)
          .setLabel("Back To Party")
          .setStyle(ButtonStyle.Secondary)
      )
    ]
  };
}

function buildPartyEmbed(username, party, box) {
  const embed = new EmbedBuilder()
    .setColor(0x4ca64c)
    .setTitle(`${username}'s Party`)
    .setDescription("Your active team is capped at 6 monsters. Use the buttons below to inspect a monster, edit its battle move set, or open storage to manage the rest of your roster.");

  if (party.length === 0) {
    embed.addFields({
      name: "Party",
      value: "No party monsters found yet.",
      inline: false
    });
  } else {
    for (const monster of party) {
      embed.addFields({
        name: `${monster.party_slot}. ${formatMonsterName(monster)} Lv.${monster.level}`,
        value: `${formatTypes(monster.types)}\n${monster.gender} | ${monster.personalityName}\nHP ${createHealthBar(monster.current_hp, monster.max_hp)} ${monster.current_hp}/${monster.max_hp}\nEXP ${createExperienceBar(monster.expCurrent, monster.expNeeded)} ${monster.expCurrent}/${monster.expNeeded}\nPotential ${monster.potentialTotal}/124 | Training ${monster.trainingTotal}/510`,
        inline: false
      });
    }
  }

  embed.addFields({
    name: "Storage Box",
    value: box.length > 0
      ? `${box.length} stored monster${box.length === 1 ? "" : "s"} ready in the storage system. Use the Storage button below or \`!storage\` to browse them.`
      : "No monsters are currently stored.",
    inline: false
  });

  return embed;
}

function buildStorageButtons(ownerId, box, page) {
  const currentPage = clampPage(page, box.length);
  const pageStart = currentPage * STORAGE_PAGE_SIZE;
  const pageEntries = box.slice(pageStart, pageStart + STORAGE_PAGE_SIZE);
  const buttons = pageEntries.map(monster => new ButtonBuilder()
    .setCustomId(`storage:${ownerId}:view:${monster.id}:${currentPage}`)
    .setLabel(`#${monster.id} ${truncateLabel(getMonsterDisplayName(monster), 14)}`)
    .setStyle(monster.current_hp > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary));

  return chunkButtons(buttons);
}

function buildStorageNavigationButtons(ownerId, box, page) {
  const currentPage = clampPage(page, box.length);
  const totalPages = Math.max(1, Math.ceil(box.length / STORAGE_PAGE_SIZE));
  const previousPage = Math.max(0, currentPage - 1);
  const nextPage = Math.min(totalPages - 1, currentPage + 1);

  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`storage:${ownerId}:page:${previousPage}:prev`)
        .setLabel("Previous")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage <= 0),
      new ButtonBuilder()
        .setCustomId(`party:${ownerId}:back`)
        .setLabel("Back To Party")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`storage:${ownerId}:page:${nextPage}:next`)
        .setLabel("Next")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage >= totalPages - 1)
    )
  ];
}

function buildStorageEmbed(username, party, box, page = 0, notice = null) {
  const currentPage = clampPage(page, box.length);
  const totalPages = Math.max(1, Math.ceil(box.length / STORAGE_PAGE_SIZE));
  const pageStart = currentPage * STORAGE_PAGE_SIZE;
  const pageEntries = box.slice(pageStart, pageStart + STORAGE_PAGE_SIZE);
  const embed = new EmbedBuilder()
    .setColor(0x5b7cfa)
    .setTitle(`${username}'s Storage`)
    .setDescription(
      notice || `Stored monsters stay boxed until you withdraw them. Active party: ${party.length}/6 | Stored monsters: ${box.length}`
    );

  if (pageEntries.length === 0) {
    embed.addFields({
      name: "Storage",
      value: "No monsters are currently stored.",
      inline: false
    });
  } else {
    for (const monster of pageEntries) {
      embed.addFields({
        name: `#${monster.id} ${formatMonsterName(monster)} Lv.${monster.level}`,
        value: `${formatTypes(monster.types)}\n${monster.gender} | ${monster.personalityName}\nHP ${createHealthBar(monster.current_hp, monster.max_hp)} ${monster.current_hp}/${monster.max_hp}\nPotential ${monster.potentialTotal}/124 | Training ${monster.trainingTotal}/510`,
        inline: false
      });
    }
  }

  embed.setFooter({
    text: `Page ${currentPage + 1}/${totalPages} | ${box.length} stored total`
  });

  return embed;
}

function buildStorageView(username, ownerId, party, box, page = 0, notice = null) {
  return {
    embeds: [buildStorageEmbed(username, party, box, page, notice)],
    components: [
      ...buildStorageButtons(ownerId, box, page),
      ...buildStorageNavigationButtons(ownerId, box, page)
    ]
  };
}

function buildStorageMonsterButtons(ownerId, monster, party, page = 0) {
  const numericPage = Number(page);
  const currentPage = Number.isInteger(numericPage) && numericPage >= 0 ? numericPage : 0;
  const withdrawButtons = [];

  for (let slot = 1; slot <= 6; slot += 1) {
    const occupant = party.find(member => member.party_slot === slot);
    withdrawButtons.push(
      new ButtonBuilder()
        .setCustomId(`storage:${ownerId}:withdraw:${monster.id}:${slot}:${currentPage}`)
        .setLabel(occupant ? `Slot ${slot}: ${truncateLabel(getMonsterDisplayName(occupant), 10)}` : `Slot ${slot}: Open`)
        .setStyle(occupant ? ButtonStyle.Secondary : ButtonStyle.Success)
    );
  }

  return [
    ...chunkButtons(withdrawButtons),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`storage:${ownerId}:page:${currentPage}`)
        .setLabel("Back To Storage")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`party:${ownerId}:back`)
        .setLabel("Back To Party")
        .setStyle(ButtonStyle.Secondary)
    )
  ];
}

function buildStorageMonsterView(username, ownerId, monster, party, page = 0, notice = null) {
  return {
    embeds: [
      buildPartyMonsterEmbed(
        username,
        monster,
        notice || "Choose a party slot to withdraw this monster. If a slot is occupied, that party monster will be sent back to storage.",
        `Storage | Monster #${monster.id}`
      )
    ],
    components: buildStorageMonsterButtons(ownerId, monster, party, page)
  };
}

function buildInventoryEmbed(username, player, inventory) {
  const ownedItems = inventory.filter(item => item.quantity > 0);
  const evolutionItems = ownedItems.filter(item => item.fieldUsage === "evolution");
  const itemsText = ownedItems
    .map(item => `${item.name} x${item.quantity} - ${item.description}`)
    .join("\n");

  const embed = new EmbedBuilder()
    .setColor(0x3c82e8)
    .setTitle(`${username}'s Inventory`)
    .setDescription(`Money: ${player.money} credits`)
    .addFields({
      name: "Items",
      value: itemsText || "Your bag is empty.",
      inline: false
    });

  if (evolutionItems.length > 0) {
    embed.addFields({
      name: "Evolution Use",
      value: `Use \`!use <item name> <monsterId>\` to trigger item evolutions.\nReady items: ${evolutionItems.map(item => `${item.name} x${item.quantity}`).join(", ")}`,
      inline: false
    });
  }

  return embed;
}

function buildShopEmbed(player, inventory) {
  const quantities = new Map(inventory.map(item => [item.key, item.quantity || 0]));
  const availableStock = getShopItemsForPlayer(player).map(item => ({
    ...item,
    quantity: quantities.get(item.key) || 0
  }));
  const sellableItems = inventory.filter(item => item.quantity > 0 && item.price > 0);
  const lockedStock = getLockedShopItemsForPlayer(player);
  const stockText = availableStock
    .map(item => `${item.name} - Buy ${item.price} credits / Sell ${getItemSellValue(item)} credits - You own ${item.quantity}\n${item.description}`)
    .join("\n\n");
  const sellText = sellableItems
    .map(item => `${item.name} x${item.quantity} - sells for ${getItemSellValue(item)} credits each`)
    .join("\n\n");
  const lockedText = lockedStock
    .map(item => `${item.name} - ${getItemUnlockText(item)}`)
    .join("\n");

  return new EmbedBuilder()
    .setColor(0xe8c23c)
    .setTitle("BitPals Supply Shop")
    .setDescription(`Current money: ${player.money} credits\nBadge progress unlocks stronger healing items, evolution catalysts, and higher-tier capture orbs.`)
    .addFields(
      {
        name: "Available Stock",
        value: truncateFieldValue(stockText || "No stock unlocked yet."),
        inline: false
      },
      {
        name: "Sell From Bag",
        value: truncateFieldValue(sellText || "You do not have any items to sell right now."),
        inline: false
      },
      {
        name: "Locked Stock",
        value: truncateFieldValue(lockedText || "All stock unlocked."),
        inline: false
      },
      {
        name: "How To Trade",
        value: "Use `!shop buy <item name> [quantity]` or `!shop sell <item name> [quantity]`. Buttons buy or sell 1 item at a time.",
        inline: false
      }
    );
}

function buildShopButtons(player, inventory = []) {
  const buyButtons = getShopItemsForPlayer(player)
    .filter(item => item.battleUsage === "heal" || item.battleUsage === "capture")
    .map(item => new ButtonBuilder()
      .setCustomId(`shop:${player.id}:buy:${item.key}`)
      .setLabel(`Buy ${truncateLabel(item.name, 72)}`)
      .setStyle(item.battleUsage === "capture" ? ButtonStyle.Success : ButtonStyle.Primary));

  const sellButtons = inventory
    .filter(item => item.quantity > 0 && item.price > 0)
    .map(item => new ButtonBuilder()
      .setCustomId(`shop:${player.id}:sell:${item.key}`)
      .setLabel(`Sell ${truncateLabel(item.name, 71)}`)
      .setStyle(ButtonStyle.Secondary));

  return chunkButtons([...buyButtons, ...sellButtons].slice(0, 20));
}

function buildGymEmbed(player, gymKey, area = null) {
  const gym = getGym(gymKey);
  const badgeOwned = player.badges.includes(gym.badgeName);
  const areaName = area?.name;

  return new EmbedBuilder()
    .setColor(getTypeColor(gym.themeType))
    .setTitle(gym.name)
    .setDescription(`${gym.leader} is waiting${areaName ? ` in ${areaName}` : ""}. Reward: ${gym.badgeName} and ${gym.rewardMoney} credits.`)
    .addFields(
      {
        name: "Area",
        value: areaName || "Special challenge area",
        inline: true
      },
      {
        name: "Theme",
        value: `${gym.themeType}-type focus`,
        inline: true
      },
      {
        name: "Team Size",
        value: String(gym.team.length),
        inline: true
      },
      {
        name: "Status",
        value: badgeOwned ? `Cleared - ${gym.badgeName} earned` : `Uncleared - ${gym.badgeName} available`,
        inline: false
      },
      {
        name: "Your Badge Case",
        value: player.badges.length > 0 ? player.badges.join(", ") : "No badges yet",
        inline: false
      }
    );
}

function buildTravelEmbed(player, currentArea, unlockedAreas, allAreas, notice = null) {
  const currentGym = currentArea?.gymKey ? getGym(currentArea.gymKey) : null;
  const unlockedText = unlockedAreas
    .map(area => {
      const gym = area.gymKey ? getGym(area.gymKey) : null;
      const currentMarker = area.key === currentArea?.key ? " (Current)" : "";
      const endgameMarker = area.isEndgame ? " [Endgame]" : "";
      const gymText = gym
        ? player.badges.includes(gym.badgeName)
          ? `Gym cleared: ${gym.badgeName}`
          : `Gym ready: ${gym.name}`
        : "No official gym";

      return `${area.name}${currentMarker}${endgameMarker} - Lv.${area.recommendedLevels} - ${gymText}`;
    })
    .join("\n");

  const lockedText = allAreas
    .filter(area => !unlockedAreas.some(unlocked => unlocked.key === area.key))
    .map(area => `${area.name} - Unlocks after earning ${area.requiredBadge}`)
    .join("\n");

  return new EmbedBuilder()
    .setColor(getTypeColor(currentGym?.themeType || "Normal"))
    .setTitle("Travel Map")
    .setDescription(notice || "Travel between unlocked areas to change your exploration pool and current gym target.")
    .addFields(
      {
        name: `Current Area - ${currentArea.name}`,
        value: [
          currentArea.description,
          `Recommended levels: ${currentArea.recommendedLevels}`,
          currentGym
            ? player.badges.includes(currentGym.badgeName)
              ? `Gym status: ${currentGym.name} cleared`
              : `Gym status: ${currentGym.name} is undefeated`
            : "Gym status: No official gym in this area"
        ].join("\n"),
        inline: false
      },
      {
        name: "Unlocked Routes",
        value: unlockedText || "No unlocked travel destinations yet.",
        inline: false
      },
      {
        name: "Locked Routes",
        value: lockedText || "Every route is unlocked.",
        inline: false
      }
    )
    .setFooter({
      text: "Use the travel buttons to move, then Explore or Gym from the hub."
    });
}

function buildGymButtons(playerId, gymKey, disabled = false) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`gym:${playerId}:challenge:${gymKey}`)
        .setLabel("Challenge Gym")
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    )
  ];
}

module.exports = {
  buildAccountResetConfirmView,
  buildAccountResetResolvedView,
  buildBattleView,
  buildChallengeButtons,
  buildChallengeEmbed,
  buildCommandHubView,
  buildDirectChallengeModal,
  buildEvolutionMessage,
  buildEvolutionMessages,
  buildGymButtons,
  buildGymEmbed,
  buildHubReturnRow,
  buildInventoryEmbed,
  buildLevelUpMessages,
  buildNicknameModal,
  buildPartyEmbed,
  buildPartyMoveEditorView,
  buildPartyMonsterView,
  buildPartySwitchModal,
  buildPartyView,
  buildHelpEmbed,
  buildPublicLaunchView,
  buildRewardMessage,
  buildShopButtons,
  buildShopEmbed,
  buildStarterChoiceView,
  buildStarterClaimedView,
  buildStorageMonsterView,
  buildStorageView,
  buildTravelButtons,
  buildTravelEmbed,
  buildTrainerActionMenu,
  buildTradeOfferButtons,
  buildTradeOfferEmbed,
  buildTradeOfferModal,
  withHubReturn,
  createBar
};
