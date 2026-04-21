-- SQLite doesn't support DROP CONSTRAINT, so recreate the table without it
CREATE TABLE posts_new (
    id                       INTEGER PRIMARY KEY AUTOINCREMENT,
    title                    TEXT    NOT NULL,
    body                     TEXT    NOT NULL DEFAULT '',
    category                 TEXT    NOT NULL,
    attachment_id            TEXT,
    attachment_original_name TEXT,
    attachment_file_tree     TEXT,
    created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO posts_new SELECT * FROM posts;
DROP TABLE posts;
ALTER TABLE posts_new RENAME TO posts;

CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_created  ON posts(created_at DESC);

-- Recreate FTS triggers
DROP TRIGGER IF EXISTS posts_ai;
DROP TRIGGER IF EXISTS posts_ad;
DROP TRIGGER IF EXISTS posts_au;

CREATE TRIGGER posts_ai AFTER INSERT ON posts BEGIN
    INSERT INTO posts_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;

CREATE TRIGGER posts_ad AFTER DELETE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, body) VALUES('delete', old.id, old.title, old.body);
END;

CREATE TRIGGER posts_au AFTER UPDATE ON posts BEGIN
    INSERT INTO posts_fts(posts_fts, rowid, title, body) VALUES('delete', old.id, old.title, old.body);
    INSERT INTO posts_fts(rowid, title, body) VALUES (new.id, new.title, new.body);
END;
