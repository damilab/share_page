const express = require('express');
const router = express.Router();
const fs = require('fs');
const Post = require('../models/post');
const Tag = require('../models/tag');
const Comment = require('../models/comment');
const upload = require('../middleware/upload');
const { processUpload, removeAttachment } = require('../lib/archive');
const { renderMarkdown } = require('../lib/markdown');
const Category = require('../models/category');

router.get('/new', (req, res) => {
  res.render('posts/new', { pageTitle: 'New Post' });
});

router.post('/', upload.single('attachment'), (req, res) => {
  const { title, body, category } = req.body;

  let attachmentData = {};
  if (req.body.github_attachment_id) {
    attachmentData = {
      attachment_id: req.body.github_attachment_id,
      attachment_original_name: req.body.github_attachment_name,
      attachment_file_tree: JSON.parse(req.body.github_attachment_tree || '[]')
    };
  } else if (req.file) {
    try {
      const result = processUpload(req.file.path, req.file.originalname);
      attachmentData = {
        attachment_id: result.attachmentId,
        attachment_original_name: result.originalName,
        attachment_file_tree: result.fileTree
      };
    } catch (err) {
      console.error('File processing failed:', err);
    } finally {
      fs.unlinkSync(req.file.path);
    }
  }

  const id = Post.create({ title, body, category, ...attachmentData });
  if (req.body.tags) {
    const tagNames = req.body.tags.split(',').map(t => t.trim()).filter(Boolean);
    Tag.syncPostTags(id, tagNames);
  }
  res.redirect(`/posts/${id}?msg=created`);
});

router.get('/:id', (req, res) => {
  const post = Post.findByIdWithTags(req.params.id);
  if (!post) return res.status(404).render('errors/404', { pageTitle: 'Not Found' });

  const renderedBody = renderMarkdown(post.body);
  const fileTree = post.attachment_file_tree ? JSON.parse(post.attachment_file_tree) : null;
  const categoryInfo = Category.findBySlug(post.category);
  const comments = Comment.findByPostId(post.id);

  res.render('posts/show', {
    pageTitle: post.title,
    post,
    renderedBody,
    fileTree,
    categoryInfo,
    comments
  });
});

router.get('/:id/raw', (req, res) => {
  const post = Post.findById(req.params.id);
  if (!post) return res.status(404).send('Not found');
  res.type('text/plain').send(post.body);
});

router.get('/:id/edit', (req, res) => {
  const post = Post.findByIdWithTags(req.params.id);
  if (!post) return res.status(404).render('errors/404', { pageTitle: 'Not Found' });

  res.render('posts/edit', {
    pageTitle: `Edit: ${post.title}`,
    post
  });
});

router.delete('/:id', (req, res) => {
  const post = Post.findById(req.params.id);
  if (!post) return res.status(404).render('errors/404', { pageTitle: 'Not Found' });

  if (post.attachment_id) removeAttachment(post.attachment_id);
  Post.delete(post.id);
  res.redirect('/?msg=deleted');
});

router.post('/:id', upload.single('attachment'), (req, res) => {
  const post = Post.findById(req.params.id);
  if (!post) return res.status(404).render('errors/404', { pageTitle: 'Not Found' });

  const { title, body, category, remove_attachment } = req.body;

  let attachmentData = {};

  if (remove_attachment === '1') {
    if (post.attachment_id) removeAttachment(post.attachment_id);
    attachmentData = {
      attachment_id: null,
      attachment_original_name: null,
      attachment_file_tree: null
    };
  }

  if (req.file) {
    try {
      if (post.attachment_id) removeAttachment(post.attachment_id);
      const result = processUpload(req.file.path, req.file.originalname);
      attachmentData = {
        attachment_id: result.attachmentId,
        attachment_original_name: result.originalName,
        attachment_file_tree: result.fileTree
      };
    } catch (err) {
      console.error('File processing failed:', err);
    } finally {
      fs.unlinkSync(req.file.path);
    }
  }

  Post.update(post.id, { title, body, category, ...attachmentData });
  if (req.body.tags !== undefined) {
    const tagNames = req.body.tags.split(',').map(t => t.trim()).filter(Boolean);
    Tag.syncPostTags(post.id, tagNames);
  }
  res.redirect(`/posts/${post.id}?msg=updated`);
});

router.post('/:id/comments', (req, res) => {
  const post = Post.findById(req.params.id);
  if (!post) return res.status(404).render('errors/404', { pageTitle: 'Not Found' });

  const { author, body } = req.body;
  if (body && body.trim()) {
    Comment.create({ post_id: post.id, author, body: body.trim() });
  }
  res.redirect(`/posts/${post.id}#comments`);
});

router.post('/:id/comments/:commentId/delete', (req, res) => {
  const post = Post.findById(req.params.id);
  if (!post) return res.status(404).render('errors/404', { pageTitle: 'Not Found' });

  Comment.delete(req.params.commentId);
  res.redirect(`/posts/${post.id}#comments`);
});

module.exports = router;
