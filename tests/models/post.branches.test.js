import { createRequire } from 'module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDB, teardownTestDB } from '../helpers/setup.js';

const require = createRequire(import.meta.url);

let db;
beforeEach(() => { db = setupTestDB(); });
afterEach(() => { teardownTestDB(db); });

describe('Post branches — create', () => {
  it('stores parent_id when provided', () => {
    const Post = require('../../models/post');
    const parentId = Post.create({ title: 'Parent', body: 'P', category: 'memos' });
    const childId = Post.create({ title: 'Child', body: 'C', category: 'memos', parent_id: parentId });
    const child = Post.findById(childId);
    expect(child.parent_id).toBe(parentId);
  });

  it('stores NULL parent_id when omitted', () => {
    const Post = require('../../models/post');
    const id = Post.create({ title: 'Solo', body: 'B', category: 'memos' });
    const post = Post.findById(id);
    expect(post.parent_id).toBeNull();
  });
});
