const db = require("../../database/db");
const { getStarterSpecies } = require("./gameData");
const { ensureStarterPack } = require("./inventorySystem");
const { getMonsterById, getPlayerMonsters, giveStarter } = require("./monsterSystem");
const { createPlayer, getPlayer } = require("./playerSystem");

async function getStarterProgress(playerId) {
  const player = await getPlayer(playerId);
  const monsters = await getPlayerMonsters(playerId);
  const starter = player?.starter_monster_id
    ? await getMonsterById(player.starter_monster_id)
    : monsters[0] || null;

  return {
    player,
    monsters,
    starter,
    hasStarter: Boolean(starter || monsters.length > 0)
  };
}

async function withStarterClaimLock(playerId, callback) {
  const connection = await db.getPool().getConnection();
  const lockName = `bitpals:starter:${playerId}`.slice(0, 64);
  let acquired = false;

  try {
    const [rows] = await connection.query("SELECT GET_LOCK(?, 5) AS acquired", [lockName]);
    acquired = rows[0]?.acquired === 1;

    if (!acquired) {
      throw new Error("Your starter claim is already processing. Try again in a moment.");
    }

    return await callback();
  } finally {
    if (acquired) {
      await connection.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => null);
    }

    connection.release();
  }
}

async function claimStarter(playerId, starterInput) {
  const starterSpecies = getStarterSpecies(starterInput);
  if (!starterSpecies) {
    throw new Error("Choose one of the starter BitPals: Flameling, Squirtie, or Leafy.");
  }

  return withStarterClaimLock(playerId, async () => {
  let player = await getPlayer(playerId);
  let createdProfile = false;

  if (!player) {
    player = await createPlayer(playerId);
    createdProfile = true;
  }

  if (player.starter_monster_id) {
    const starter = await getMonsterById(player.starter_monster_id);
    if (starter) {
      return {
        alreadyStarted: true,
        createdProfile: false,
        player,
        starter
      };
    }
  }

  const monsters = await getPlayerMonsters(playerId);
  if (monsters.length > 0) {
    await db.query(
      "UPDATE players SET starter_monster_id = ? WHERE id = ? AND starter_monster_id IS NULL",
      [monsters[0].id, playerId]
    );

    return {
      alreadyStarted: true,
      createdProfile: false,
      player: await getPlayer(playerId),
      starter: monsters[0]
    };
  }

  const starter = await giveStarter(playerId, starterSpecies);
  await db.query(
    "UPDATE players SET starter_monster_id = ? WHERE id = ? AND starter_monster_id IS NULL",
    [starter.id, playerId]
  );
  await ensureStarterPack(playerId);

  return {
    alreadyStarted: false,
    createdProfile,
    player: await getPlayer(playerId),
    starter
  };
  });
}

module.exports = {
  claimStarter,
  getStarterProgress
};
