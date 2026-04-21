const db = require('../db/connection');

const Tag = {
  findAll() {
    return db.prepare('SELECT * FROM tags ORDER BY name').all();
  },

  search(query) {
    return db.prepare('SELECT * FROM tags WHERE name LIKE ? ORDER BY name LIMIT 20')
      .all(`%${query}%`);
  },

  findByPostId(postId) {
    return db.prepare(`
      SELECT t.* FROM tags t
      JOIN post_tags pt ON t.id = pt.tag_id
      WHERE pt.post_id = ?
      ORDER BY t.name
    `).all(postId);
  },

  findOrCreate(name) {
    const trimmed = name.trim();
    if (!trimmed) return null;

    let tag = db.prepare('SELECT * FROM tags WHERE name = ?').get(trimmed);
    if (!tag) {
      const result = db.prepare('INSERT INTO tags (name) VALUES (?)').run(trimmed);
      tag = { id: result.lastInsertRowid, name: trimmed };
    }
    return tag;
  },

  syncPostTags(postId, tagNames) {
    const setTags = db.transaction((postId, names) => {
      db.prepare('DELETE FROM post_tags WHERE post_id = ?').run(postId);
      for (const name of names) {
        const tag = Tag.findOrCreate(name);
        if (tag) {
          db.prepare('INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)')
            .run(postId, tag.id);
        }
      }
    });
    setTags(postId, tagNames);
  },

  getPopular(limit = 10) {
    return db.prepare(`
      SELECT t.*, COUNT(pt.post_id) as post_count
      FROM tags t
      JOIN post_tags pt ON t.id = pt.tag_id
      GROUP BY t.id
      ORDER BY post_count DESC
      LIMIT ?
    `).all(limit);
  }
};

module.exports = Tag;
