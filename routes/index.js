const express = require('express');
const router = express.Router();
const Post = require('../models/post');
const config = require('../config/default');

router.get('/', (req, res) => {
  const { category, tag, q, page } = req.query;
  const currentPage = parseInt(page, 10) || 1;

  const Category = require('../models/category');
  let categoryFilter = category || null;
  let parentCategory = null;
  let subCategories = [];
  let activeSub = null;

  if (category) {
    const cat = Category.findBySlug(category);
    if (cat) {
      if (!cat.parent_id) {
        // Selected a parent category
        parentCategory = cat;
        subCategories = Category.findChildren(cat.id);
        if (subCategories.length > 0) {
          categoryFilter = [cat.slug, ...subCategories.map(c => c.slug)];
        }
      } else {
        // Selected a sub-category
        activeSub = cat;
        parentCategory = Category.findById(cat.parent_id);
        subCategories = Category.findChildren(cat.parent_id);
        categoryFilter = category;
      }
    }
  }

  const result = Post.findAll({
    category: categoryFilter,
    tag: tag || null,
    q: q || null,
    page: currentPage,
    perPage: config.pagination.perPage
  });

  const Tag = require('../models/tag');
  const popularTags = Tag.getPopular(10);

  const Comment = require('../models/comment');
  const postIds = result.posts.map(p => p.id);
  const commentCounts = Comment.countsByPostIds(postIds);

  res.render('home', {
    pageTitle: 'Home',
    posts: result.posts,
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
    activeCategory: category || null,
    activeTag: tag || null,
    searchQuery: q || '',
    popularTags,
    commentCounts,
    parentCategory,
    subCategories,
    activeSub
  });
});

module.exports = router;
