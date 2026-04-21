const path = require('path');

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3333,
  host: '0.0.0.0',
  db: {
    path: path.join(__dirname, '..', 'db', 'share_page.sqlite')
  },
  upload: {
    maxSize: 10 * 1024 * 1024 * 1024,
    tempDir: path.join(__dirname, '..', 'uploads', '_tmp'),
    baseDir: path.join(__dirname, '..', 'uploads')
  },
  pagination: {
    perPage: 12
  }
};
