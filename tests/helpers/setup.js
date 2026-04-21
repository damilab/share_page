import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const require = createRequire(import.meta.url);

const Database = require('better-sqlite3');
const { runMigrations } = require('../../db/migrator');

function setupTestDB() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);

  require.cache[require.resolve('../../db/connection')] = {
    id: require.resolve('../../db/connection'),
    filename: require.resolve('../../db/connection'),
    loaded: true,
    exports: db,
  };
  require.cache[require.resolve('../../db/connection')].exports.createDB = () => db;

  return db;
}

function teardownTestDB(db) {
  db.close();
  delete require.cache[require.resolve('../../db/connection')];
  delete require.cache[require.resolve('../../models/post')];
  delete require.cache[require.resolve('../../models/tag')];
  delete require.cache[require.resolve('../../models/comment')];
}

export { setupTestDB, teardownTestDB };
