const db = require("../../database/db");
const { getActiveBattle } = require("./battleSystem");
const { getMonsterById } = require("./monsterSystem");
const { getPlayer } = require("./playerSystem");

function getMonsterTradeName(monster) {
  if (!monster) {
    return "BitPal";
  }

  const displayName = monster.nickname || monster.species;
  return monster.hasCustomNickname && displayName !== monster.species
    ? `${displayName} (${monster.species})`
    : displayName;
}

async function getTradeOfferById(tradeId) {
  const [rows] = await db.query("SELECT * FROM trade_offers WHERE id = ?", [tradeId]);
  return rows[0] || null;
}

async function setTradeMessageId(tradeId, messageId) {
  await db.query("UPDATE trade_offers SET message_id = ?, updated_at = NOW() WHERE id = ?", [messageId, tradeId]);
  return getTradeOfferById(tradeId);
}

async function ensureCanTrade(playerId) {
  const player = await getPlayer(playerId);
  if (!player) {
    throw new Error("That trainer needs to start BitPals before trading.");
  }

  const activeBattle = await getActiveBattle(playerId);
  if (activeBattle) {
    throw new Error("Both trainers must finish active battles before trading.");
  }

  return player;
}

async function createTradeOffer({
  proposerId,
  proposerName,
  targetId,
  targetName,
  channelId,
  proposerMonsterId,
  targetMonsterId
}) {
  if (proposerId === targetId) {
    throw new Error("You cannot trade with yourself.");
  }

  await ensureCanTrade(proposerId);
  await ensureCanTrade(targetId);

  const proposerMonster = await getMonsterById(proposerMonsterId);
  const targetMonster = await getMonsterById(targetMonsterId);

  if (!proposerMonster || proposerMonster.owner_id !== proposerId) {
    throw new Error("Your offered monster could not be found in your roster.");
  }

  if (!targetMonster || targetMonster.owner_id !== targetId) {
    throw new Error("The requested monster could not be found in that trainer's roster.");
  }

  if (proposerMonster.id === targetMonster.id) {
    throw new Error("A trade needs two different monsters.");
  }

  const [result] = await db.query(
    `
      INSERT INTO trade_offers
      (proposer_id, proposer_name, target_id, target_name, channel_id, proposer_monster_id, target_monster_id, proposer_monster_name, target_monster_name, status, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 1)
    `,
    [
      proposerId,
      proposerName,
      targetId,
      targetName,
      channelId,
      proposerMonster.id,
      targetMonster.id,
      getMonsterTradeName(proposerMonster),
      getMonsterTradeName(targetMonster)
    ]
  );

  return getTradeOfferById(result.insertId);
}

async function cancelTradeOffer(tradeId, playerId) {
  const trade = await getTradeOfferById(tradeId);
  if (!trade || !trade.active || trade.status !== "pending") {
    throw new Error("That trade offer is no longer active.");
  }

  if (trade.proposer_id !== playerId) {
    throw new Error("Only the trainer who created this trade can cancel it.");
  }

  await db.query("UPDATE trade_offers SET active = 0, status = 'cancelled', updated_at = NOW() WHERE id = ?", [tradeId]);
  return getTradeOfferById(tradeId);
}

async function declineTradeOffer(tradeId, playerId) {
  const trade = await getTradeOfferById(tradeId);
  if (!trade || !trade.active || trade.status !== "pending") {
    throw new Error("That trade offer is no longer active.");
  }

  if (trade.target_id !== playerId) {
    throw new Error("Only the requested trainer can decline this trade.");
  }

  await db.query("UPDATE trade_offers SET active = 0, status = 'declined', updated_at = NOW() WHERE id = ?", [tradeId]);
  return getTradeOfferById(tradeId);
}

async function acceptTradeOffer(tradeId, playerId) {
  const trade = await getTradeOfferById(tradeId);
  if (!trade || !trade.active || trade.status !== "pending") {
    throw new Error("That trade offer is no longer active.");
  }

  if (trade.target_id !== playerId) {
    throw new Error("Only the requested trainer can accept this trade.");
  }

  await ensureCanTrade(trade.proposer_id);
  await ensureCanTrade(trade.target_id);

  const pool = db.getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [monsterRows] = await connection.query(
      "SELECT * FROM monsters WHERE id IN (?, ?) FOR UPDATE",
      [trade.proposer_monster_id, trade.target_monster_id]
    );
    const proposerMonster = monsterRows.find(monster => monster.id === trade.proposer_monster_id);
    const targetMonster = monsterRows.find(monster => monster.id === trade.target_monster_id);

    if (!proposerMonster || proposerMonster.owner_id !== trade.proposer_id) {
      throw new Error(`${trade.proposer_monster_name} is no longer available for this trade.`);
    }

    if (!targetMonster || targetMonster.owner_id !== trade.target_id) {
      throw new Error(`${trade.target_monster_name} is no longer available for this trade.`);
    }

    await connection.query(
      "UPDATE monsters SET owner_id = ?, party_slot = ? WHERE id = ?",
      [trade.target_id, targetMonster.party_slot, proposerMonster.id]
    );
    await connection.query(
      "UPDATE monsters SET owner_id = ?, party_slot = ? WHERE id = ?",
      [trade.proposer_id, proposerMonster.party_slot, targetMonster.id]
    );
    await connection.query(
      "UPDATE trade_offers SET active = 0, status = 'completed', updated_at = NOW() WHERE id = ?",
      [trade.id]
    );
    await connection.query(
      `
        UPDATE trade_offers
        SET active = 0, status = 'stale', updated_at = NOW()
        WHERE active = 1
          AND id <> ?
          AND status = 'pending'
          AND (
            proposer_monster_id IN (?, ?)
            OR target_monster_id IN (?, ?)
          )
      `,
      [
        trade.id,
        proposerMonster.id,
        targetMonster.id,
        proposerMonster.id,
        targetMonster.id
      ]
    );

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  return getTradeOfferById(trade.id);
}

module.exports = {
  acceptTradeOffer,
  cancelTradeOffer,
  createTradeOffer,
  declineTradeOffer,
  getMonsterTradeName,
  getTradeOfferById,
  setTradeMessageId
};
