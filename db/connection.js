const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const config = require('../config/default');
const { runMigrations } = require('./migrator');

function createDB({ inMemory = false } = {}) {
  let db;
  if (inMemory) {
    db = new Database(':memory:');
  } else {
    const dbDir = path.dirname(config.db.path);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    db = new Database(config.db.path);
  }

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  return db;
}

// Singleton for production use
const db = createDB();

module.exports = db;
module.exports.createDB = createDB;
