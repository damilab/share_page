import { createRequire } from 'module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDB, teardownTestDB } from '../helpers/setup.js';

const require = createRequire(import.meta.url);

let db;

beforeEach(() => { db = setupTestDB(); });
afterEach(() => { teardownTestDB(db); });

describe('Tag model', () => {
  it('findOrCreate creates a new tag', () => {
    const Tag = require('../../models/tag');
    const tag = Tag.findOrCreate('claude-code');
    expect(tag).toBeDefined();
    expect(tag.name).toBe('claude-code');
    expect(tag.id).toBeGreaterThan(0);
  });

  it('findOrCreate returns existing tag (case insensitive)', () => {
    const Tag = require('../../models/tag');
    const tag1 = Tag.findOrCreate('Claude');
    const tag2 = Tag.findOrCreate('claude');
    expect(tag1.id).toBe(tag2.id);
  });

  it('syncPostTags attaches and replaces tags', () => {
    const Tag = require('../../models/tag');
    const Post = require('../../models/post');
    const id = Post.create({ title: 'T', body: 'B', category: 'memos' });

    Tag.syncPostTags(id, ['alpha', 'beta']);
    expect(Tag.findByPostId(id).map(t => t.name)).toEqual(['alpha', 'beta']);

    Tag.syncPostTags(id, ['beta', 'gamma']);
    expect(Tag.findByPostId(id).map(t => t.name)).toEqual(['beta', 'gamma']);
  });

  it('getPopular returns tags ordered by post count', () => {
    const Tag = require('../../models/tag');
    const Post = require('../../models/post');
    const id1 = Post.create({ title: 'A', body: 'B', category: 'memos' });
    const id2 = Post.create({ title: 'C', body: 'D', category: 'memos' });

    Tag.syncPostTags(id1, ['common', 'rare']);
    Tag.syncPostTags(id2, ['common']);

    const popular = Tag.getPopular(10);
    expect(popular[0].name).toBe('common');
    expect(popular[0].post_count).toBe(2);
  });

  it('search filters tags by name', () => {
    const Tag = require('../../models/tag');
    Tag.findOrCreate('claude-code');
    Tag.findOrCreate('claude-skills');
    Tag.findOrCreate('other');

    const results = Tag.search('claude');
    expect(results.length).toBe(2);
  });
});
