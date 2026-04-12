const mysql = require("mysql2/promise");
const config = require("../config");

let pool;

function buildDbConfig() {
  return {
    ...config.db,
    host: config.db.host === "localhost" ? "127.0.0.1" : config.db.host,
    port: config.db.port || 3306
  };
}

function getPool() {
  if (!pool) {
    pool = mysql.createPool(buildDbConfig());
  }

  return pool;
}

async function query(...args) {
  return getPool().query(...args);
}

async function execute(...args) {
  return getPool().execute(...args);
}

async function end() {
  if (!pool) {
    return;
  }

  const activePool = pool;
  pool = null;
  await activePool.end();
}

module.exports = {
  buildDbConfig,
  end,
  execute,
  getPool,
  query
};
