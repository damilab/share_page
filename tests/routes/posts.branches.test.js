import { createRequire } from 'module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDB, teardownTestDB } from '../helpers/setup.js';

const require = createRequire(import.meta.url);

let db;
let app;
let request;

beforeEach(() => {
  db = setupTestDB();
  // Clear cached modules so they pick up the in-memory DB
  delete require.cache[require.resolve('../../app')];
  delete require.cache[require.resolve('../../routes/posts')];
  delete require.cache[require.resolve('../../routes/index')];
  delete require.cache[require.resolve('../../routes/api')];
  delete require.cache[require.resolve('../../routes/admin')];
  delete require.cache[require.resolve('../../middleware/locals')];
  delete require.cache[require.resolve('../../models/category')];
  app = require('../../app');
  request = require('supertest');
});
afterEach(() => {
  teardownTestDB(db);
  delete require.cache[require.resolve('../../models/category')];
});

describe('GET /posts/new?from=:id', () => {
  it('prefills title with (branch) suffix and sets hidden parent_id', async () => {
    const Post = require('../../models/post');
    const parentId = Post.create({ title: 'Original', body: 'Body', category: 'memos' });

    const res = await request(app).get(`/posts/new?from=${parentId}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Original (branch)');
    expect(res.text).toContain(`name="parent_id" value="${parentId}"`);
    expect(res.text).toContain('Branched from');
  });

  it('renders normal form when from id does not exist', async () => {
    const res = await request(app).get('/posts/new?from=99999');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Branched from');
    expect(res.text).not.toContain('name="parent_id"');
  });

  it('renders normal form when from param is absent', async () => {
    const res = await request(app).get('/posts/new');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain('Branched from');
  });
});

describe('POST /posts with parent_id', () => {
  it('persists parent_id when valid', async () => {
    const Post = require('../../models/post');
    const parentId = Post.create({ title: 'P', body: 'b', category: 'memos' });

    const res = await request(app)
      .post('/posts')
      .type('form')
      .send({ title: 'Child', body: 'c', category: 'memos', parent_id: String(parentId) });

    expect(res.status).toBe(302);
    const all = require('../../db/connection')
      .prepare('SELECT * FROM posts WHERE title = ?').get('Child');
    expect(all.parent_id).toBe(parentId);
  });

  it('coerces invalid parent_id to NULL', async () => {
    const res = await request(app)
      .post('/posts')
      .type('form')
      .send({ title: 'Orphan', body: 'o', category: 'memos', parent_id: '99999' });

    expect(res.status).toBe(302);
    const post = require('../../db/connection')
      .prepare('SELECT * FROM posts WHERE title = ?').get('Orphan');
    expect(post.parent_id).toBeNull();
  });
});
