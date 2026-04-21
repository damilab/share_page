function notFoundHandler(req, res) {
  res.status(404).render('errors/404', { pageTitle: 'Not Found' });
}

function errorHandler(err, req, res, next) {
  console.error(err.stack || err);
  res.status(500).render('errors/500', {
    pageTitle: 'Error',
    error: process.env.NODE_ENV === 'production' ? null : err
  });
}

module.exports = { notFoundHandler, errorHandler };
