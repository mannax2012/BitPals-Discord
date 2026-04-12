const crypto = require("crypto");
const db = require("../../database/db");

function createResetToken() {
  return crypto.randomBytes(12).toString("hex");
}

async function createAccountResetRequest({ guildId, channelId, adminId, targetId }) {
  const token = createResetToken();

  const [result] = await db.query(
    `
      INSERT INTO account_reset_requests
      (guild_id, channel_id, admin_id, target_id, token, status, expires_at)
      VALUES (?, ?, ?, ?, ?, 'pending', DATE_ADD(NOW(), INTERVAL 15 MINUTE))
    `,
    [guildId, channelId, adminId, targetId, token]
  );

  return getAccountResetRequest(result.insertId);
}

async function getAccountResetRequest(requestId) {
  const [rows] = await db.query(
    "SELECT * FROM account_reset_requests WHERE id = ?",
    [requestId]
  );

  return rows[0] || null;
}

async function setAccountResetStatus(requestId, status) {
  await db.query(
    "UPDATE account_reset_requests SET status = ?, resolved_at = NOW() WHERE id = ? AND status = 'pending'",
    [status, requestId]
  );

  return getAccountResetRequest(requestId);
}

async function resetPlayerAccount(requestId, token, targetId) {
  const connection = await db.getPool().getConnection();

  try {
    await connection.beginTransaction();

    const [requests] = await connection.query(
      `
        SELECT *
        FROM account_reset_requests
        WHERE id = ?
          AND token = ?
          AND target_id = ?
          AND status = 'pending'
          AND expires_at > NOW()
        FOR UPDATE
      `,
      [requestId, token, targetId]
    );

    const request = requests[0];
    if (!request) {
      throw new Error("That reset request is no longer valid.");
    }

    await connection.query(
      "UPDATE battles SET active = 0, action_lock_token = NULL, action_lock_expires_at = NULL, updated_at = NOW() WHERE player_id = ? OR opponent_player_id = ?",
      [targetId, targetId]
    );
    await connection.query(
      "UPDATE battle_challenges SET active = 0 WHERE challenger_id = ? OR opponent_id = ?",
      [targetId, targetId]
    );
    await connection.query(
      "UPDATE trade_offers SET active = 0, status = 'cancelled', updated_at = NOW() WHERE proposer_id = ? OR target_id = ?",
      [targetId, targetId]
    );
    await connection.query("DELETE FROM player_items WHERE player_id = ?", [targetId]);
    await connection.query("DELETE FROM monsters WHERE owner_id = ?", [targetId]);
    await connection.query("DELETE FROM players WHERE id = ?", [targetId]);
    await connection.query(
      "UPDATE account_reset_requests SET status = 'confirmed', resolved_at = NOW() WHERE id = ?",
      [requestId]
    );

    await connection.commit();
    return {
      ...request,
      status: "confirmed"
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  createAccountResetRequest,
  getAccountResetRequest,
  resetPlayerAccount,
  setAccountResetStatus
};
