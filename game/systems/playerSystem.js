const db = require("../../database/db");
const DEFAULT_AREA_KEY = "starter_plains";

function normalizePlayer(row) {
  if (!row) {
    return null;
  }

  let badges = [];

  try {
    badges = JSON.parse(row.badges_json || "[]");
  } catch (err) {
    badges = [];
  }

  return {
    ...row,
    badges,
    current_area: row.current_area || DEFAULT_AREA_KEY
  };
}

async function getPlayer(id) {
  const [rows] = await db.query("SELECT * FROM players WHERE id = ?", [id]);
  return normalizePlayer(rows[0]);
}

async function createPlayer(id) {
  await db.query(
    "INSERT IGNORE INTO players (id, badges_json, current_area) VALUES (?, '[]', ?)",
    [id, DEFAULT_AREA_KEY]
  );

  return getPlayer(id);
}

async function getOrCreatePlayer(id) {
  const player = await getPlayer(id);
  if (player) {
    return player;
  }

  return createPlayer(id);
}

async function setCurrentArea(id, areaKey) {
  await createPlayer(id);
  await db.query(
    "UPDATE players SET current_area = ? WHERE id = ?",
    [String(areaKey || DEFAULT_AREA_KEY), id]
  );

  return getPlayer(id);
}

async function setMoney(id, amount) {
  await createPlayer(id);
  await db.query("UPDATE players SET money = ? WHERE id = ?", [Math.max(0, amount), id]);
  return getPlayer(id);
}

async function adjustMoney(id, delta) {
  const player = await getOrCreatePlayer(id);
  return setMoney(id, player.money + delta);
}

async function addBadge(id, badgeName) {
  const player = await getOrCreatePlayer(id);

  if (player.badges.includes(badgeName)) {
    return player;
  }

  const badges = [...player.badges, badgeName];
  await db.query("UPDATE players SET badges_json = ? WHERE id = ?", [JSON.stringify(badges), id]);
  return getPlayer(id);
}

function hasBadge(player, badgeName) {
  return Boolean(player?.badges?.includes(badgeName));
}

module.exports = {
  addBadge,
  adjustMoney,
  createPlayer,
  getOrCreatePlayer,
  getPlayer,
  hasBadge,
  setCurrentArea,
  setMoney
};
