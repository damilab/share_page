import { createRequire } from 'module';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupTestDB, teardownTestDB } from '../helpers/setup.js';

const require = createRequire(import.meta.url);

let db;

beforeEach(() => { db = setupTestDB(); });
afterEach(() => { teardownTestDB(db); });

describe('Comment model', () => {
  it('creates a comment with author', () => {
    const Post = require('../../models/post');
    const Comment = require('../../models/comment');
    const postId = Post.create({ title: 'T', body: 'B', category: 'memos' });

    const id = Comment.create({ post_id: postId, author: 'Alice', body: 'Hello!' });
    const comments = Comment.findByPostId(postId);
    expect(comments.length).toBe(1);
    expect(comments[0].author).toBe('Alice');
    expect(comments[0].body).toBe('Hello!');
  });

  it('defaults author to Anonymous when empty', () => {
    const Post = require('../../models/post');
    const Comment = require('../../models/comment');
    const postId = Post.create({ title: 'T', body: 'B', category: 'memos' });

    Comment.create({ post_id: postId, author: '', body: 'Anon' });
    const comments = Comment.findByPostId(postId);
    expect(comments[0].author).toBe('Anonymous');
  });

  it('deletes a comment', () => {
    const Post = require('../../models/post');
    const Comment = require('../../models/comment');
    const postId = Post.create({ title: 'T', body: 'B', category: 'memos' });
    const id = Comment.create({ post_id: postId, author: 'A', body: 'B' });

    Comment.delete(id);
    expect(Comment.findByPostId(postId).length).toBe(0);
  });

  it('cascade deletes comments when post is deleted', () => {
    const Post = require('../../models/post');
    const Comment = require('../../models/comment');
    const postId = Post.create({ title: 'T', body: 'B', category: 'memos' });
    Comment.create({ post_id: postId, author: 'A', body: 'Comment 1' });
    Comment.create({ post_id: postId, author: 'B', body: 'Comment 2' });

    Post.delete(postId);
    expect(Comment.findByPostId(postId).length).toBe(0);
  });

  it('countsByPostIds returns correct counts', () => {
    const Post = require('../../models/post');
    const Comment = require('../../models/comment');
    const id1 = Post.create({ title: 'A', body: 'B', category: 'memos' });
    const id2 = Post.create({ title: 'C', body: 'D', category: 'memos' });

    Comment.create({ post_id: id1, author: 'A', body: 'C1' });
    Comment.create({ post_id: id1, author: 'B', body: 'C2' });
    Comment.create({ post_id: id2, author: 'C', body: 'C3' });

    const counts = Comment.countsByPostIds([id1, id2]);
    expect(counts[id1]).toBe(2);
    expect(counts[id2]).toBe(1);
  });
});
