import { createRequire } from 'module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDB, teardownTestDB } from '../helpers/setup.js';

const require = createRequire(import.meta.url);

let db;

beforeEach(() => { db = setupTestDB(); });
afterEach(() => { teardownTestDB(db); });

describe('Post model', () => {
  it('creates and retrieves a post', () => {
    const Post = require('../../models/post');
    const id = Post.create({ title: 'Hello', body: '# World', category: 'memos' });
    const post = Post.findById(id);
    expect(post.title).toBe('Hello');
    expect(post.body).toBe('# World');
    expect(post.category).toBe('memos');
  });

  it('updates a post', () => {
    const Post = require('../../models/post');
    const id = Post.create({ title: 'Old', body: 'Body', category: 'memos' });
    Post.update(id, { title: 'New', body: 'Updated', category: 'memos' });
    const post = Post.findById(id);
    expect(post.title).toBe('New');
  });

  it('deletes a post', () => {
    const Post = require('../../models/post');
    const id = Post.create({ title: 'T', body: 'B', category: 'memos' });
    Post.delete(id);
    expect(Post.findById(id)).toBeUndefined();
  });

  it('filters by category', () => {
    const Post = require('../../models/post');
    Post.create({ title: 'A', body: 'B', category: 'memos' });
    Post.create({ title: 'C', body: 'D', category: 'md-skills' });
    const result = Post.findAll({ category: 'memos' });
    expect(result.total).toBe(1);
    expect(result.posts[0].title).toBe('A');
  });

  it('filters by tag', () => {
    const Post = require('../../models/post');
    const Tag = require('../../models/tag');
    const id1 = Post.create({ title: 'Tagged', body: 'B', category: 'memos' });
    const id2 = Post.create({ title: 'Untagged', body: 'B', category: 'memos' });
    Tag.syncPostTags(id1, ['special']);

    const result = Post.findAll({ tag: 'special' });
    expect(result.total).toBe(1);
    expect(result.posts[0].title).toBe('Tagged');
  });

  it('searches by title and body via FTS', () => {
    const Post = require('../../models/post');
    Post.create({ title: 'Claude Config', body: 'System prompt for Claude', category: 'system-prompts' });
    Post.create({ title: 'Meeting Notes', body: 'Weekly sync', category: 'meeting-materials' });

    const result = Post.findAll({ q: 'Claude' });
    expect(result.total).toBe(1);
    expect(result.posts[0].title).toBe('Claude Config');
  });

  it('findByIdWithTags includes tags', () => {
    const Post = require('../../models/post');
    const Tag = require('../../models/tag');
    const id = Post.create({ title: 'T', body: 'B', category: 'memos' });
    Tag.syncPostTags(id, ['alpha', 'beta']);

    const post = Post.findByIdWithTags(id);
    expect(post.tags.map(t => t.name)).toEqual(['alpha', 'beta']);
  });
});
