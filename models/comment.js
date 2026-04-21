const db = require('../db/connection');

const Comment = {
  create({ post_id, author, body }) {
    const result = db.prepare(
      'INSERT INTO comments (post_id, author, body) VALUES (?, ?, ?)'
    ).run(post_id, (author && author.trim()) || 'Anonymous', body);
    return result.lastInsertRowid;
  },

  findByPostId(postId) {
    return db.prepare(
      'SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC'
    ).all(postId);
  },

  countByPostId(postId) {
    const row = db.prepare(
      'SELECT COUNT(*) as count FROM comments WHERE post_id = ?'
    ).get(postId);
    return row.count;
  },

  delete(id) {
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
    if (!comment) return null;
    db.prepare('DELETE FROM comments WHERE id = ?').run(id);
    return comment;
  },

  countsByPostIds(postIds) {
    if (postIds.length === 0) return {};
    const placeholders = postIds.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT post_id, COUNT(*) as count FROM comments WHERE post_id IN (${placeholders}) GROUP BY post_id`
    ).all(...postIds);
    const map = {};
    for (const row of rows) map[row.post_id] = row.count;
    return map;
  }
};

module.exports = Comment;
