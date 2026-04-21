const multer = require('multer');
const path = require('path');
const fs = require('fs');
const config = require('../config/default');

if (!fs.existsSync(config.upload.tempDir)) {
  fs.mkdirSync(config.upload.tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: config.upload.tempDir,
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxSize }
});

module.exports = upload;
