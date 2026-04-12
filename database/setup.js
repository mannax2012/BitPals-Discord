const mysql = require("mysql2/promise");
const config = require("../config");
const db = require("./db");

function escapeIdentifier(identifier) {
  return String(identifier).replace(/`/g, "``");
}

async function ensureDatabaseExists() {
  const dbConfig = db.buildDbConfig();
  const adminConfig = { ...dbConfig };
  delete adminConfig.database;

  const connection = await mysql.createConnection(adminConfig);

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${escapeIdentifier(config.db.database)}\``);
  } finally {
    await connection.end();
  }
}

async function tableExists(tableName) {
  const [rows] = await db.query("SHOW TABLES LIKE ?", [tableName]);
  return rows.length > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await db.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
  return rows.length > 0;
}

async function ensureColumn(tableName, columnName, definition) {
  if (!(await columnExists(tableName, columnName))) {
    await db.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${definition}`);
  }
}

async function ensurePlayersTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS players (
      id VARCHAR(50) PRIMARY KEY,
      money INT NOT NULL DEFAULT 1000,
      badges_json TEXT NOT NULL,
      current_area VARCHAR(50) NOT NULL DEFAULT 'starter_plains',
      starter_monster_id INT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("players", "money", "INT NOT NULL DEFAULT 1000");
  await ensureColumn("players", "badges_json", "TEXT NULL");
  await ensureColumn("players", "current_area", "VARCHAR(50) NOT NULL DEFAULT 'starter_plains'");
  await ensureColumn("players", "starter_monster_id", "INT NULL");
  await ensureColumn("players", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  await db.query("UPDATE players SET badges_json = '[]' WHERE badges_json IS NULL OR badges_json = ''");
  await db.query("UPDATE players SET current_area = 'starter_plains' WHERE current_area IS NULL OR current_area = ''");
}

async function ensureMonstersTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS monsters (
      id INT AUTO_INCREMENT PRIMARY KEY,
      owner_id VARCHAR(50) NOT NULL,
      species VARCHAR(50) NOT NULL,
      nickname VARCHAR(50) NULL,
      level INT NOT NULL DEFAULT 5,
      experience INT NOT NULL DEFAULT 0,
      party_slot INT NULL,
      current_hp INT NOT NULL,
      max_hp INT NOT NULL,
      attack INT NOT NULL,
      defense INT NOT NULL,
      speed INT NOT NULL,
      gender VARCHAR(20) NULL,
      personality_key VARCHAR(50) NULL,
      moves_json TEXT NULL,
      potential_json TEXT NULL,
      training_json TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("monsters", "nickname", "VARCHAR(50) NULL");
  await ensureColumn("monsters", "experience", "INT NOT NULL DEFAULT 0");
  await ensureColumn("monsters", "party_slot", "INT NULL");
  await ensureColumn("monsters", "gender", "VARCHAR(20) NULL");
  await ensureColumn("monsters", "personality_key", "VARCHAR(50) NULL");
  await ensureColumn("monsters", "moves_json", "TEXT NULL");
  await ensureColumn("monsters", "potential_json", "TEXT NULL");
  await ensureColumn("monsters", "training_json", "TEXT NULL");
  await ensureColumn("monsters", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  await db.query("UPDATE monsters SET experience = 0 WHERE experience IS NULL");
}

async function ensureBattlesTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS battles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      player_id VARCHAR(50) NOT NULL,
      opponent_player_id VARCHAR(50) NULL,
      battle_type VARCHAR(20) NOT NULL DEFAULT 'wild',
      enemy_species VARCHAR(50) NULL,
      enemy_hp INT NULL,
      battle_state LONGTEXT NULL,
      channel_id VARCHAR(50) NULL,
      message_id VARCHAR(50) NULL,
      action_lock_token VARCHAR(80) NULL,
      action_lock_expires_at DATETIME NULL,
      action_version INT NOT NULL DEFAULT 1,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("battles", "opponent_player_id", "VARCHAR(50) NULL");
  await ensureColumn("battles", "battle_type", "VARCHAR(20) NOT NULL DEFAULT 'wild'");
  await ensureColumn("battles", "battle_state", "LONGTEXT NULL");
  await ensureColumn("battles", "channel_id", "VARCHAR(50) NULL");
  await ensureColumn("battles", "message_id", "VARCHAR(50) NULL");
  await ensureColumn("battles", "action_lock_token", "VARCHAR(80) NULL");
  await ensureColumn("battles", "action_lock_expires_at", "DATETIME NULL");
  await ensureColumn("battles", "action_version", "INT NOT NULL DEFAULT 1");
  await ensureColumn("battles", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
}

async function ensureBattleChallengesTable() {
  if (!(await tableExists("battle_challenges"))) {
    await db.query(`
      CREATE TABLE battle_challenges (
        id INT AUTO_INCREMENT PRIMARY KEY,
        challenger_id VARCHAR(50) NOT NULL,
        challenger_name VARCHAR(100) NOT NULL,
        opponent_id VARCHAR(50) NULL,
        opponent_name VARCHAR(100) NULL,
        channel_id VARCHAR(50) NOT NULL,
        message_id VARCHAR(50) NULL,
        challenge_type VARCHAR(20) NOT NULL DEFAULT 'open',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    return;
  }

  await ensureColumn("battle_challenges", "challenger_name", "VARCHAR(100) NOT NULL DEFAULT 'Trainer'");
  await ensureColumn("battle_challenges", "opponent_name", "VARCHAR(100) NULL");
  await ensureColumn("battle_challenges", "message_id", "VARCHAR(50) NULL");
  await ensureColumn("battle_challenges", "challenge_type", "VARCHAR(20) NOT NULL DEFAULT 'open'");
  await ensureColumn("battle_challenges", "active", "BOOLEAN NOT NULL DEFAULT TRUE");
  await ensureColumn("battle_challenges", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
}

async function ensurePlayerItemsTable() {
  if (!(await tableExists("player_items"))) {
    await db.query(`
      CREATE TABLE player_items (
        player_id VARCHAR(50) NOT NULL,
        item_key VARCHAR(50) NOT NULL,
        quantity INT NOT NULL DEFAULT 0,
        PRIMARY KEY (player_id, item_key)
      )
    `);
  }
}

async function ensureTradeOffersTable() {
  if (!(await tableExists("trade_offers"))) {
    await db.query(`
      CREATE TABLE trade_offers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        proposer_id VARCHAR(50) NOT NULL,
        proposer_name VARCHAR(100) NOT NULL,
        target_id VARCHAR(50) NOT NULL,
        target_name VARCHAR(100) NOT NULL,
        channel_id VARCHAR(50) NOT NULL,
        message_id VARCHAR(50) NULL,
        proposer_monster_id INT NOT NULL,
        target_monster_id INT NOT NULL,
        proposer_monster_name VARCHAR(100) NOT NULL,
        target_monster_name VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    return;
  }

  await ensureColumn("trade_offers", "proposer_name", "VARCHAR(100) NOT NULL DEFAULT 'Trainer'");
  await ensureColumn("trade_offers", "target_name", "VARCHAR(100) NOT NULL DEFAULT 'Trainer'");
  await ensureColumn("trade_offers", "message_id", "VARCHAR(50) NULL");
  await ensureColumn("trade_offers", "proposer_monster_name", "VARCHAR(100) NOT NULL DEFAULT 'BitPal'");
  await ensureColumn("trade_offers", "target_monster_name", "VARCHAR(100) NOT NULL DEFAULT 'BitPal'");
  await ensureColumn("trade_offers", "status", "VARCHAR(20) NOT NULL DEFAULT 'pending'");
  await ensureColumn("trade_offers", "active", "BOOLEAN NOT NULL DEFAULT TRUE");
  await ensureColumn("trade_offers", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn("trade_offers", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
}

async function ensureServerSettingsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS server_settings (
      guild_id VARCHAR(50) PRIMARY KEY,
      bitpals_channel_id VARCHAR(50) NULL,
      setup_by VARCHAR(50) NULL,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await ensureColumn("server_settings", "bitpals_channel_id", "VARCHAR(50) NULL");
  await ensureColumn("server_settings", "setup_by", "VARCHAR(50) NULL");
  await ensureColumn("server_settings", "updated_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
}

async function ensureAccountResetRequestsTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS account_reset_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      guild_id VARCHAR(50) NOT NULL,
      channel_id VARCHAR(50) NOT NULL,
      admin_id VARCHAR(50) NOT NULL,
      target_id VARCHAR(50) NOT NULL,
      token VARCHAR(80) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      resolved_at DATETIME NULL
    )
  `);

  await ensureColumn("account_reset_requests", "guild_id", "VARCHAR(50) NOT NULL");
  await ensureColumn("account_reset_requests", "channel_id", "VARCHAR(50) NOT NULL");
  await ensureColumn("account_reset_requests", "admin_id", "VARCHAR(50) NOT NULL");
  await ensureColumn("account_reset_requests", "target_id", "VARCHAR(50) NOT NULL");
  await ensureColumn("account_reset_requests", "token", "VARCHAR(80) NOT NULL");
  await ensureColumn("account_reset_requests", "status", "VARCHAR(20) NOT NULL DEFAULT 'pending'");
  await ensureColumn("account_reset_requests", "created_at", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
  await ensureColumn("account_reset_requests", "expires_at", "DATETIME NOT NULL");
  await ensureColumn("account_reset_requests", "resolved_at", "DATETIME NULL");
}

async function initializeDatabase() {
  await ensureDatabaseExists();
  await ensurePlayersTable();
  await ensureMonstersTable();
  await db.query(`
    UPDATE players p
    SET starter_monster_id = (
      SELECT m.id
      FROM monsters m
      WHERE m.owner_id = p.id
      ORDER BY CASE WHEN m.party_slot IS NULL THEN 99 ELSE m.party_slot END, m.id
      LIMIT 1
    )
    WHERE starter_monster_id IS NULL
      AND EXISTS (SELECT 1 FROM monsters m WHERE m.owner_id = p.id)
  `);
  await ensureBattlesTable();
  await ensureBattleChallengesTable();
  await ensurePlayerItemsTable();
  await ensureTradeOffersTable();
  await ensureServerSettingsTable();
  await ensureAccountResetRequestsTable();
}

module.exports = { initializeDatabase };
