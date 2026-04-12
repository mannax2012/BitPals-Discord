const db = require("../../database/db");
const { getItem, items } = require("./gameData");

async function getInventory(playerId) {
  const [rows] = await db.query("SELECT item_key, quantity FROM player_items WHERE player_id = ?", [playerId]);
  const quantities = new Map(rows.map(row => [row.item_key, row.quantity]));

  return items.map(item => ({
    ...item,
    quantity: quantities.get(item.key) || 0
  }));
}

async function getItemQuantity(playerId, itemKey) {
  const [rows] = await db.query(
    "SELECT quantity FROM player_items WHERE player_id = ? AND item_key = ?",
    [playerId, itemKey]
  );

  return rows[0]?.quantity || 0;
}

async function addItem(playerId, itemKey, quantity) {
  const item = getItem(itemKey);
  if (!item) {
    throw new Error(`Unknown item: ${itemKey}`);
  }

  await db.query(
    `
      INSERT INTO player_items (player_id, item_key, quantity)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
    `,
    [playerId, itemKey, quantity]
  );

  return getInventory(playerId);
}

async function removeItem(playerId, itemKey, quantity = 1) {
  const currentQuantity = await getItemQuantity(playerId, itemKey);

  if (currentQuantity < quantity) {
    return false;
  }

  await db.query(
    "UPDATE player_items SET quantity = quantity - ? WHERE player_id = ? AND item_key = ?",
    [quantity, playerId, itemKey]
  );

  return true;
}

async function ensureStarterPack(playerId) {
  const inventory = await getInventory(playerId);
  const hasItems = inventory.some(item => item.quantity > 0);

  if (hasItems) {
    return inventory;
  }

  await addItem(playerId, "capture_orb", 5);
  await addItem(playerId, "potion", 2);
  return getInventory(playerId);
}

module.exports = {
  addItem,
  ensureStarterPack,
  getInventory,
  getItemQuantity,
  removeItem
};
