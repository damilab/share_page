const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function runMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const applied = new Set(
    db.prepare('SELECT version FROM schema_version').all().map(r => r.version)
  );

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = parseInt(file.split('_')[0], 10);
    if (applied.has(version)) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    db.exec(sql);
    db.prepare('INSERT INTO schema_version (version, name) VALUES (?, ?)').run(version, file);
    console.log(`Migration applied: ${file}`);
  }
}

module.exports = { runMigrations };
