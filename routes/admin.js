const express = require('express');
const router = express.Router();
const Category = require('../models/category');

router.get('/categories', (req, res) => {
  const tree = Category.getTree().map(parent => ({
    ...parent,
    postCount: Category.postCount(parent.slug),
    children: parent.children.map(child => ({
      ...child,
      postCount: Category.postCount(child.slug)
    }))
  }));
  const topLevel = Category.findTopLevel();
  res.render('admin/categories', { pageTitle: 'Manage Categories', categoryTree: tree, topLevel });
});

router.post('/categories', (req, res) => {
  const { label, description, color, parent_id } = req.body;
  if (!label || !label.trim()) return res.redirect('/admin/categories?msg=error&detail=name_required');

  try {
    Category.create({ label: label.trim(), description, color, parent_id: parent_id || null });
    res.redirect('/admin/categories?msg=added');
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      res.redirect('/admin/categories?msg=error&detail=duplicate');
    } else {
      res.redirect('/admin/categories?msg=error');
    }
  }
});

router.post('/categories/:id/delete', (req, res) => {
  const result = Category.delete(req.params.id);
  if (!result) return res.redirect('/admin/categories?msg=error&detail=not_found');
  res.redirect('/admin/categories?msg=deleted');
});

module.exports = router;
