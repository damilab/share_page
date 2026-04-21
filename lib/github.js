const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config/default');
const { extractZip, storeSingleFile } = require('./archive');

function parseGitHubUrl(url) {
  // https://github.com/owner/repo
  // https://github.com/owner/repo/tree/branch/path/to/folder
  // https://github.com/owner/repo/blob/branch/path/to/file
  const match = url.match(/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/(tree|blob)\/([^/]+)\/?(.*?))?$/);
  if (!match) return null;

  const [, owner, repo, type, ref, filePath] = match;
  return {
    owner,
    repo,
    type: type || 'repo',
    ref: ref || 'main',
    path: filePath || ''
  };
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'LabSharePage/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function getDefaultBranch(owner, repo) {
  const data = await fetchUrl(`https://api.github.com/repos/${owner}/${repo}`);
  const info = JSON.parse(data.toString());
  return info.default_branch || 'main';
}

async function importFromGitHub(url) {
  const parsed = parseGitHubUrl(url);
  if (!parsed) throw new Error('Invalid GitHub URL');

  let { owner, repo, type, ref, path: filePath } = parsed;

  // If no branch specified in URL, look up the actual default branch
  if (!ref || ref === 'main') {
    const urlHasBranch = /\/(tree|blob)\//.test(url);
    if (!urlHasBranch) {
      ref = await getDefaultBranch(owner, repo);
    }
  }

  if (type === 'blob' && filePath) {
    // Single file
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${filePath}`;
    const content = await fetchUrl(rawUrl);
    const fileName = path.basename(filePath);
    const tmpPath = path.join(config.upload.tempDir, uuidv4() + '-' + fileName);

    if (!fs.existsSync(config.upload.tempDir)) fs.mkdirSync(config.upload.tempDir, { recursive: true });
    fs.writeFileSync(tmpPath, content);

    const result = storeSingleFile(tmpPath, fileName);
    fs.unlinkSync(tmpPath);
    return { ...result, originalName: `${repo}/${filePath}` };
  }

  // Repo or folder — download as ZIP
  const zipUrl = `https://api.github.com/repos/${owner}/${repo}/zipball/${ref}`;
  const zipBuffer = await fetchUrl(zipUrl);
  const tmpPath = path.join(config.upload.tempDir, uuidv4() + '.zip');

  if (!fs.existsSync(config.upload.tempDir)) fs.mkdirSync(config.upload.tempDir, { recursive: true });
  fs.writeFileSync(tmpPath, zipBuffer);

  const result = extractZip(tmpPath, `${repo}.zip`);
  fs.unlinkSync(tmpPath);

  // If a subfolder path was specified, we need to find and re-root the tree
  // GitHub zipball creates a folder like "owner-repo-sha/"
  if (filePath) {
    result.originalName = `${repo}/${filePath}`;
  } else {
    result.originalName = repo;
  }

  return result;
}

module.exports = { importFromGitHub, parseGitHubUrl };
