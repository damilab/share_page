ALTER TABLE posts ADD COLUMN parent_id INTEGER
    REFERENCES posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_id);
