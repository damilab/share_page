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

describe('Post branches — findAncestors', () => {
  it('returns empty array for root post', () => {
    const Post = require('../../models/post');
    const rootId = Post.create({ title: 'Root', body: 'R', category: 'memos' });
    expect(Post.findAncestors(rootId)).toEqual([]);
  });

  it('returns ancestors root-first, excluding self', () => {
    const Post = require('../../models/post');
    const aId = Post.create({ title: 'A', body: 'a', category: 'memos' });
    const bId = Post.create({ title: 'B', body: 'b', category: 'memos', parent_id: aId });
    const cId = Post.create({ title: 'C', body: 'c', category: 'memos', parent_id: bId });
    const dId = Post.create({ title: 'D', body: 'd', category: 'memos', parent_id: cId });

    const ancestors = Post.findAncestors(dId);
    expect(ancestors.map(a => a.title)).toEqual(['A', 'B', 'C']);
    expect(ancestors.every(a => a.id !== dId)).toBe(true);
  });
});
