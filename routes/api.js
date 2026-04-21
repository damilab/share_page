const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const hljs = require('highlight.js');
const Post = require('../models/post');
const Tag = require('../models/tag');
const { getExtractedPath, getArchivePath } = require('../lib/archive');
const { importFromGitHub } = require('../lib/github');

const MARKDOWN_EXTENSIONS = new Set(['.md', '.markdown']);
const TEXT_EXTENSIONS = new Set([
  '.txt', '.json', '.js', '.ts', '.jsx', '.tsx', '.py', '.rb',
  '.yaml', '.yml', '.toml', '.xml', '.css', '.scss', '.less',
  '.sh', '.bash', '.zsh', '.fish', '.sql', '.go', '.rs', '.java',
  '.c', '.cpp', '.h', '.hpp', '.swift', '.kt', '.lua', '.r',
  '.env', '.gitignore', '.dockerignore', '.editorconfig',
  '.eslintrc', '.prettierrc', '.babelrc', '.config', '.cfg', '.ini', '.conf'
]);

const HTML_EXTENSIONS = new Set(['.html', '.htm']);
const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.bmp']);

function getFileType(ext) {
  if (HTML_EXTENSIONS.has(ext)) return 'html';
  if (MARKDOWN_EXTENSIONS.has(ext)) return 'markdown';
  if (TEXT_EXTENSIONS.has(ext)) return 'text';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return 'binary';
}

function getLang(ext) {
  const map = {
    '.js': 'javascript', '.ts': 'typescript', '.jsx': 'javascript', '.tsx': 'typescript',
    '.py': 'python', '.rb': 'ruby', '.go': 'go', '.rs': 'rust', '.java': 'java',
    '.c': 'c', '.cpp': 'cpp', '.h': 'c', '.hpp': 'cpp', '.swift': 'swift',
    '.kt': 'kotlin', '.lua': 'lua', '.r': 'r', '.sh': 'bash', '.bash': 'bash',
    '.zsh': 'bash', '.sql': 'sql', '.html': 'html', '.css': 'css', '.scss': 'scss',
    '.less': 'less', '.xml': 'xml', '.yaml': 'yaml', '.yml': 'yaml',
    '.json': 'json', '.toml': 'toml', '.md': 'markdown', '.ini': 'ini'
  };
  return map[ext] || null;
}

router.get('/posts/:id/files', (req, res) => {
  const post = Post.findById(req.params.id);
  if (!post || !post.attachment_file_tree) return res.json({ error: 'No attachments' });
  res.json(JSON.parse(post.attachment_file_tree));
});

router.get('/posts/:id/files/{*filepath}', (req, res) => {
  const post = Post.findById(req.params.id);
  if (!post || !post.attachment_id) return res.status(404).json({ error: 'Not found' });

  const filePath = Array.isArray(req.params.filepath) ? req.params.filepath.join('/') : req.params.filepath;
  const extractedDir = getExtractedPath(post.attachment_id);
  const fullPath = path.join(extractedDir, filePath);

  const normalizedBase = path.resolve(extractedDir);
  const normalizedTarget = path.resolve(fullPath);
  if (!normalizedTarget.startsWith(normalizedBase)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!fs.existsSync(fullPath)) return res.status(404).json({ error: 'File not found' });

  const ext = path.extname(filePath).toLowerCase();
  const fileType = getFileType(ext);

  if (fileType === 'html') {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const highlighted = hljs.highlight(content, { language: 'html' }).value;
    return res.json({ type: 'html', content, highlighted, lang: 'html', fileName: path.basename(filePath) });
  }

  if (fileType === 'markdown') {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const highlighted = hljs.highlight(content, { language: 'markdown' }).value;
    return res.json({ type: 'markdown', content, highlighted, lang: 'markdown', fileName: path.basename(filePath) });
  }

  if (fileType === 'text') {
    const content = fs.readFileSync(fullPath, 'utf-8');
    const lang = getLang(ext);
    let highlighted;
    if (lang && hljs.getLanguage(lang)) {
      highlighted = hljs.highlight(content, { language: lang }).value;
    } else {
      highlighted = hljs.highlightAuto(content).value;
    }
    return res.json({ type: 'text', content, highlighted, lang: lang || 'plaintext', fileName: path.basename(filePath) });
  }

  if (fileType === 'image') {
    const mimeMap = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.ico': 'image/x-icon', '.bmp': 'image/bmp' };
    return res.type(mimeMap[ext] || 'application/octet-stream').sendFile(normalizedTarget);
  }

  res.json({ type: 'binary', fileName: path.basename(filePath), size: fs.statSync(fullPath).size });
});

router.get('/posts/:id/download', (req, res) => {
  const post = Post.findById(req.params.id);
  if (!post || !post.attachment_id) return res.status(404).send('Not found');

  // Check if it's a ZIP archive or a single file
  const archivePath = path.resolve(getArchivePath(post.attachment_id));
  if (fs.existsSync(archivePath)) {
    let fileName = post.attachment_original_name || 'attachment';
    if (!fileName.endsWith('.zip')) fileName += '.zip';
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Type', 'application/zip');
    fs.createReadStream(archivePath).pipe(res);
    return;
  }

  // Single file: serve from extracted directory
  const extractedDir = path.resolve(getExtractedPath(post.attachment_id));
  const originalName = post.attachment_original_name || 'attachment';
  const singleFilePath = path.join(extractedDir, originalName);
  if (fs.existsSync(singleFilePath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalName)}"`);
    fs.createReadStream(singleFilePath).pipe(res);
    return;
  }

  res.status(404).send('Attachment not found');
});

router.get('/posts/:id/download/{*filepath}', (req, res) => {
  const post = Post.findById(req.params.id);
  if (!post || !post.attachment_id) return res.status(404).send('Not found');

  const filePath = Array.isArray(req.params.filepath) ? req.params.filepath.join('/') : req.params.filepath;
  const extractedDir = getExtractedPath(post.attachment_id);
  const fullPath = path.join(extractedDir, filePath);

  const normalizedBase = path.resolve(extractedDir);
  const normalizedTarget = path.resolve(fullPath);
  if (!normalizedTarget.startsWith(normalizedBase)) return res.status(403).send('Forbidden');
  if (!fs.existsSync(normalizedTarget)) return res.status(404).send('File not found');

  const fileName = path.basename(filePath);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
  fs.createReadStream(normalizedTarget).pipe(res);
});

router.get('/posts/:id/view/{*filepath}', (req, res) => {
  const post = Post.findById(req.params.id);
  if (!post || !post.attachment_id) return res.status(404).send('Not found');

  const filePath = Array.isArray(req.params.filepath) ? req.params.filepath.join('/') : req.params.filepath;
  const extractedDir = getExtractedPath(post.attachment_id);
  const fullPath = path.join(extractedDir, filePath);

  const normalizedBase = path.resolve(extractedDir);
  const normalizedTarget = path.resolve(fullPath);
  if (!normalizedTarget.startsWith(normalizedBase)) return res.status(403).send('Forbidden');
  if (!fs.existsSync(normalizedTarget)) return res.status(404).send('File not found');

  const ext = path.extname(filePath).toLowerCase();

  // Render Markdown as HTML page
  if (ext === '.md' || ext === '.markdown') {
    const { renderMarkdown } = require('../lib/markdown');
    const content = fs.readFileSync(normalizedTarget, 'utf-8');
    const rendered = renderMarkdown(content);
    const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${path.basename(filePath)}</title>
<link rel="stylesheet" href="/css/output.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css">
</head><body class="bg-white"><div class="container mx-auto max-w-4xl px-6 py-8"><div class="prose prose-gray max-w-none">${rendered}</div></div></body></html>`;
    return res.type('text/html').send(html);
  }

  const mimeMap = {
    '.html': 'text/html', '.htm': 'text/html', '.css': 'text/css',
    '.js': 'application/javascript', '.mjs': 'application/javascript',
    '.json': 'application/json', '.xml': 'application/xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.ico': 'image/x-icon', '.bmp': 'image/bmp',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
    '.pdf': 'application/pdf', '.mp4': 'video/mp4', '.webm': 'video/webm',
  };
  res.type(mimeMap[ext] || 'application/octet-stream');
  fs.createReadStream(normalizedTarget).pipe(res);
});

router.post('/github-import', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.includes('github.com')) {
    return res.status(400).json({ error: 'Invalid GitHub URL' });
  }
  try {
    const result = await importFromGitHub(url);
    res.json({
      attachment_id: result.attachmentId,
      attachment_original_name: result.originalName,
      attachment_file_tree: result.fileTree
    });
  } catch (err) {
    console.error('GitHub import failed:', err);
    res.status(500).json({ error: err.message || 'Failed to import from GitHub' });
  }
});

router.get('/tags', (req, res) => {
  const q = req.query.q;
  if (q) {
    return res.json(Tag.search(q));
  }
  return res.json(Tag.findAll());
});

router.get('/tags/popular', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 10;
  res.json(Tag.getPopular(limit));
});

module.exports = router;
