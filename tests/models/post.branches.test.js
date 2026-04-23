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

describe('Post branches — findDescendants', () => {
  it('returns empty array for leaf post', () => {
    const Post = require('../../models/post');
    const rootId = Post.create({ title: 'Root', body: 'R', category: 'memos' });
    expect(Post.findDescendants(rootId)).toEqual([]);
  });

  it('returns descendants in DFS order with depth', () => {
    const Post = require('../../models/post');
    //       A
    //      / \
    //     B   C
    //     |
    //     D
    const aId = Post.create({ title: 'A', body: 'a', category: 'memos' });
    const bId = Post.create({ title: 'B', body: 'b', category: 'memos', parent_id: aId });
    const cId = Post.create({ title: 'C', body: 'c', category: 'memos', parent_id: aId });
    const dId = Post.create({ title: 'D', body: 'd', category: 'memos', parent_id: bId });

    const rows = Post.findDescendants(aId);
    expect(rows.map(r => ({ title: r.title, depth: r.depth }))).toEqual([
      { title: 'B', depth: 0 },
      { title: 'D', depth: 1 },
      { title: 'C', depth: 0 }
    ]);
  });

  it('promotes children to roots when parent is deleted', () => {
    const Post = require('../../models/post');
    const aId = Post.create({ title: 'A', body: 'a', category: 'memos' });
    const bId = Post.create({ title: 'B', body: 'b', category: 'memos', parent_id: aId });

    Post.delete(aId);
    expect(Post.findById(bId).parent_id).toBeNull();
  });
});

describe('Post branches — findBranchTree', () => {
  it('returns ancestors, current, descendants shape', () => {
    const Post = require('../../models/post');
    const aId = Post.create({ title: 'A', body: 'a', category: 'memos' });
    const bId = Post.create({ title: 'B', body: 'b', category: 'memos', parent_id: aId });
    const cId = Post.create({ title: 'C', body: 'c', category: 'memos', parent_id: bId });

    const tree = Post.findBranchTree(bId);
    expect(tree.ancestors.map(n => n.title)).toEqual(['A']);
    expect(tree.current.title).toBe('B');
    expect(tree.descendants.map(n => n.title)).toEqual(['C']);
  });

  it('returns null current when post does not exist', () => {
    const Post = require('../../models/post');
    const tree = Post.findBranchTree(99999);
    expect(tree.current).toBeNull();
    expect(tree.ancestors).toEqual([]);
    expect(tree.descendants).toEqual([]);
  });
});
