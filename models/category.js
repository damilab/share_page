const db = require('../db/connection');

const Category = {
  findAll() {
    return db.prepare('SELECT * FROM categories ORDER BY sort_order, id').all();
  },

  findTopLevel() {
    return db.prepare('SELECT * FROM categories WHERE parent_id IS NULL ORDER BY sort_order, id').all();
  },

  findChildren(parentId) {
    return db.prepare('SELECT * FROM categories WHERE parent_id = ? ORDER BY sort_order, id').all(parentId);
  },

  findBySlug(slug) {
    return db.prepare('SELECT * FROM categories WHERE slug = ?').get(slug);
  },

  findById(id) {
    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  },

  getTree() {
    const all = Category.findAll();
    const topLevel = all.filter(c => !c.parent_id);
    return topLevel.map(parent => ({
      ...parent,
      children: all.filter(c => c.parent_id === parent.id)
    }));
  },

  create({ label, description, color, parent_id }) {
    const slug = label.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-|-$/g, '');
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM categories').get();
    const sortOrder = (maxOrder.m || 0) + 1;
    const result = db.prepare(
      'INSERT INTO categories (slug, label, description, color, sort_order, parent_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(slug, label, description || '', color || 'gray', sortOrder, parent_id || null);
    return { id: result.lastInsertRowid, slug, label, description: description || '', color: color || 'gray', sort_order: sortOrder, parent_id: parent_id || null };
  },

  postCount(slug) {
    const row = db.prepare('SELECT COUNT(*) as c FROM posts WHERE category = ?').get(slug);
    return row.c;
  },

  // Count posts in this category + all its children
  postCountWithChildren(id) {
    const cat = Category.findById(id);
    if (!cat) return 0;
    const children = Category.findChildren(id);
    const slugs = [cat.slug, ...children.map(c => c.slug)];
    const placeholders = slugs.map(() => '?').join(',');
    const row = db.prepare(`SELECT COUNT(*) as c FROM posts WHERE category IN (${placeholders})`).get(...slugs);
    return row.c;
  },

  delete(id) {
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
    if (!cat) return null;
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    return cat;
  }
};

module.exports = Category;
