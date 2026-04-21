PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS posts (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    title                    TEXT    NOT NULL,
    body                     TEXT    NOT NULL DEFAULT '',
    category                 TEXT    NOT NULL CHECK(category IN (
                                 'system-prompts','md-skills','meeting-materials','memos'
                             )),
    attachment_id            TEXT,
    attachment_original_name TEXT,
    attachment_file_tree     TEXT,
    created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_created  ON posts(created_at DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
    title,
    body,
    content='posts',
    content_rowid='id',
    tokenize='unicode61'
);

CREATE TRIGGER IF NOT EXISTS posts_ai AFTER INSERT ON posts BEGIN
    INSERT INTO posts_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;

CREATE TRIGGER IF NOT EXISTS posts_ad AFTER DELETE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, body) VALUES('delete', old.id, old.title, old.body);
END;

CREATE TRIGGER IF NOT EXISTS posts_au AFTER UPDATE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, body) VALUES('delete', old.id, old.title, old.body);
    INSERT INTO posts_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;
