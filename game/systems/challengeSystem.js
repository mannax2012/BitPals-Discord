const db = require("../../database/db");

async function createChallenge({ challengerId, challengerName, opponentId = null, opponentName = null, channelId, challengeType = "open" }) {
  const [result] = await db.query(
    `
      INSERT INTO battle_challenges (challenger_id, challenger_name, opponent_id, opponent_name, channel_id, challenge_type, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `,
    [challengerId, challengerName, opponentId, opponentName, channelId, challengeType]
  );

  return getChallengeById(result.insertId);
}

async function getChallengeById(challengeId) {
  const [rows] = await db.query("SELECT * FROM battle_challenges WHERE id = ?", [challengeId]);
  return rows[0] || null;
}

async function setChallengeMessageId(challengeId, messageId) {
  await db.query("UPDATE battle_challenges SET message_id = ? WHERE id = ?", [messageId, challengeId]);
  return getChallengeById(challengeId);
}

async function getLatestJoinableChallenge(channelId, userId) {
  const [rows] = await db.query(
    `
      SELECT *
      FROM battle_challenges
      WHERE channel_id = ?
        AND active = 1
        AND challenger_id <> ?
        AND (opponent_id IS NULL OR opponent_id = ?)
      ORDER BY id DESC
      LIMIT 1
    `,
    [channelId, userId, userId]
  );

  return rows[0] || null;
}

async function closeChallenge(challengeId) {
  await db.query("UPDATE battle_challenges SET active = 0 WHERE id = ?", [challengeId]);
}

module.exports = {
  closeChallenge,
  createChallenge,
  getChallengeById,
  getLatestJoinableChallenge,
  setChallengeMessageId
};
