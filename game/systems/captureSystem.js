const db = require("../../database/db");

async function attemptCapture(playerId) {
  const [[battle]] = await db.query(
    "SELECT * FROM battles WHERE player_id = ? AND active = 1",
    [playerId]
  );

  if (!battle) return null;

  const chance = 0.5;

  if (Math.random() < chance) {
    await db.query(`
      INSERT INTO monsters (owner_id, species, level, current_hp, max_hp, attack, defense, speed)
      VALUES (?, ?, 3, 30, 30, 10, 10, 10)
    `, [playerId, battle.enemy_species]);

    await db.query("UPDATE battles SET active = 0 WHERE id = ?", [battle.id]);

    return true;
  }

  return false;
}

module.exports = { attemptCapture };