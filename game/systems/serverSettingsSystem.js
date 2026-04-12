const db = require("../../database/db");

async function getServerSettings(guildId) {
  if (!guildId) {
    return null;
  }

  const [rows] = await db.query(
    "SELECT * FROM server_settings WHERE guild_id = ?",
    [guildId]
  );

  return rows[0] || null;
}

async function setBitPalsChannel(guildId, channelId, setupBy) {
  await db.query(
    `
      INSERT INTO server_settings (guild_id, bitpals_channel_id, setup_by, updated_at)
      VALUES (?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        bitpals_channel_id = VALUES(bitpals_channel_id),
        setup_by = VALUES(setup_by),
        updated_at = NOW()
    `,
    [guildId, channelId, setupBy]
  );

  return getServerSettings(guildId);
}

async function getBitPalsChannelId(guildId) {
  const settings = await getServerSettings(guildId);
  return settings?.bitpals_channel_id || null;
}

async function isBitPalsChannel(guildId, channelId) {
  const configuredChannelId = await getBitPalsChannelId(guildId);
  return Boolean(configuredChannelId && configuredChannelId === channelId);
}

module.exports = {
  getBitPalsChannelId,
  getServerSettings,
  isBitPalsChannel,
  setBitPalsChannel
};
