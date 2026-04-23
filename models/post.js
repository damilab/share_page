const db = require('../db/connection');

const Post = {
  findAll({ category, tag, q, page = 1, perPage = 12 } = {}) {
    const offset = (page - 1) * perPage;
    const conditions = [];
    const params = {};

    if (q && q.trim()) {
      const searchTerm = q.trim().replace(/"/g, '""');
      conditions.push('posts.id IN (SELECT rowid FROM posts_fts WHERE posts_fts MATCH @q)');
      params.q = `"${searchTerm}"`;
    }
    if (category) {
      if (Array.isArray(category)) {
        const placeholders = category.map((_, i) => `@cat${i}`);
        conditions.push(`posts.category IN (${placeholders.join(',')})`);
        category.forEach((c, i) => { params[`cat${i}`] = c; });
      } else {
        conditions.push('posts.category = @category');
        params.category = category;
      }
    }
    if (tag) {
      conditions.push('posts.id IN (SELECT post_id FROM post_tags JOIN tags ON tags.id = post_tags.tag_id WHERE tags.name = @tag)');
      params.tag = tag;
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const countSql = `SELECT COUNT(*) as total FROM posts ${where}`;
    const { total } = db.prepare(countSql).get(Object.keys(params).length > 0 ? params : {});

    let dataSql;
    if (q && q.trim()) {
      dataSql = `
        SELECT posts.*, bm25(posts_fts) as rank
        FROM posts
        JOIN posts_fts ON posts.id = posts_fts.rowid
        ${where.replace('posts.id IN (SELECT rowid FROM posts_fts WHERE posts_fts MATCH @q)', 'posts_fts MATCH @q')}
        ORDER BY rank
        LIMIT @limit OFFSET @offset`;
    } else {
      dataSql = `SELECT * FROM posts ${where} ORDER BY created_at DESC LIMIT @limit OFFSET @offset`;
    }

    params.limit = perPage;
    params.offset = offset;

    const posts = db.prepare(dataSql).all(params);
    const totalPages = Math.ceil(total / perPage);

    return { posts, total, page, perPage, totalPages };
  },

  findById(id) {
    return db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  },

  findByIdWithTags(id) {
    const post = Post.findById(id);
    if (!post) return null;
    const Tag = require('./tag');
    post.tags = Tag.findByPostId(id);
    return post;
  },

  findAncestors(id) {
    return db.prepare(`
      WITH RECURSIVE ancestors(id, parent_id, title, category, created_at, depth) AS (
        SELECT id, parent_id, title, category, created_at, 0
          FROM posts WHERE id = @id
        UNION ALL
        SELECT p.id, p.parent_id, p.title, p.category, p.created_at, a.depth + 1
          FROM posts p JOIN ancestors a ON p.id = a.parent_id
      )
      SELECT id, parent_id, title, category, created_at, depth
        FROM ancestors WHERE id != @id
        ORDER BY depth DESC
    `).all({ id });
  },

  create({ title, body, category, parent_id, attachment_id, attachment_original_name, attachment_file_tree }) {
    const stmt = db.prepare(`
      INSERT INTO posts (title, body, category, parent_id, attachment_id, attachment_original_name, attachment_file_tree)
      VALUES (@title, @body, @category, @parent_id, @attachment_id, @attachment_original_name, @attachment_file_tree)
    `);
    const result = stmt.run({
      title,
      body,
      category,
      parent_id: parent_id || null,
      attachment_id: attachment_id || null,
      attachment_original_name: attachment_original_name || null,
      attachment_file_tree: attachment_file_tree ? JSON.stringify(attachment_file_tree) : null
    });
    return result.lastInsertRowid;
  },

  update(id, { title, body, category, attachment_id, attachment_original_name, attachment_file_tree }) {
    const existing = Post.findById(id);
    if (!existing) return null;

    const stmt = db.prepare(`
      UPDATE posts SET
        title = @title,
        body = @body,
        category = @category,
        attachment_id = @attachment_id,
        attachment_original_name = @attachment_original_name,
        attachment_file_tree = @attachment_file_tree,
        updated_at = datetime('now')
      WHERE id = @id
    `);
    stmt.run({
      id,
      title,
      body,
      category,
      attachment_id: attachment_id !== undefined ? attachment_id : existing.attachment_id,
      attachment_original_name: attachment_original_name !== undefined ? attachment_original_name : existing.attachment_original_name,
      attachment_file_tree: attachment_file_tree !== undefined
        ? (attachment_file_tree ? JSON.stringify(attachment_file_tree) : null)
        : existing.attachment_file_tree
    });
    return Post.findById(id);
  },

  delete(id) {
    const post = Post.findById(id);
    if (!post) return null;
    db.prepare('DELETE FROM posts WHERE id = ?').run(id);
    return post;
  }
};

module.exports = Post;
