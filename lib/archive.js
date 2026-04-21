const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/default');

function buildFileTree(dir, basePath = '') {
  const items = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relativePath = basePath ? `${basePath}/${entry.name}` : entry.name;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      items.push({
        name: entry.name,
        type: 'directory',
        path: relativePath,
        children: buildFileTree(fullPath, relativePath)
      });
    } else {
      const stat = fs.statSync(fullPath);
      items.push({
        name: entry.name,
        type: 'file',
        path: relativePath,
        size: stat.size,
        extension: path.extname(entry.name).toLowerCase()
      });
    }
  }

  items.sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1;
    if (a.type !== 'directory' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });

  return items;
}

function extractZip(zipPath, originalName) {
  const attachmentId = uuidv4();
  const destDir = path.join(config.upload.baseDir, attachmentId);
  const extractedDir = path.join(destDir, 'extracted');

  fs.mkdirSync(extractedDir, { recursive: true });

  const zip = new AdmZip(zipPath);
  zip.extractAllTo(extractedDir, true);

  fs.copyFileSync(zipPath, path.join(destDir, 'archive.zip'));

  const fileTree = buildFileTree(extractedDir);

  return { attachmentId, fileTree, originalName };
}

function isZipFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return ext === '.zip';
}

function storeSingleFile(filePath, originalName) {
  const attachmentId = uuidv4();
  const destDir = path.join(config.upload.baseDir, attachmentId);
  const extractedDir = path.join(destDir, 'extracted');

  fs.mkdirSync(extractedDir, { recursive: true });

  fs.copyFileSync(filePath, path.join(extractedDir, originalName));

  const stat = fs.statSync(path.join(extractedDir, originalName));
  const fileTree = [{
    name: originalName,
    type: 'file',
    path: originalName,
    size: stat.size,
    extension: path.extname(originalName).toLowerCase()
  }];

  return { attachmentId, fileTree, originalName };
}

function processUpload(filePath, originalName) {
  if (isZipFile(filePath)) {
    return extractZip(filePath, originalName);
  }
  return storeSingleFile(filePath, originalName);
}

function removeAttachment(attachmentId) {
  if (!attachmentId) return;
  const dir = path.join(config.upload.baseDir, attachmentId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function getExtractedPath(attachmentId) {
  return path.join(config.upload.baseDir, attachmentId, 'extracted');
}

function getArchivePath(attachmentId) {
  return path.join(config.upload.baseDir, attachmentId, 'archive.zip');
}

module.exports = { extractZip, storeSingleFile, processUpload, isZipFile, removeAttachment, buildFileTree, getExtractedPath, getArchivePath };
