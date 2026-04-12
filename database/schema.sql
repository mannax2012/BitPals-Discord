CREATE DATABASE IF NOT EXISTS monster_game;
USE monster_game;

CREATE TABLE IF NOT EXISTS players (
    id VARCHAR(50) PRIMARY KEY,
    money INT NOT NULL DEFAULT 1000,
    badges_json TEXT NOT NULL,
    current_area VARCHAR(50) NOT NULL DEFAULT 'starter_plains',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

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
);

CREATE TABLE IF NOT EXISTS player_items (
    player_id VARCHAR(50) NOT NULL,
    item_key VARCHAR(50) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    PRIMARY KEY (player_id, item_key)
);

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
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS battle_challenges (
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
);
