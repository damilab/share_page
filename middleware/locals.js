const Category = require('../models/category');

module.exports = function(req, res, next) {
  res.locals.categories = Category.findAll();
  res.locals.categoryTree = Category.getTree();
  res.locals.currentPath = req.path;
  res.locals.currentQuery = req.query;
  res.locals.formatDate = function(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'Z');
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };
  res.locals.msg = req.query.msg || null;
  next();
};
