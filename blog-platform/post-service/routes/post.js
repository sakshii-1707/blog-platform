const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Post = require('../models/Post');
const auth = require('../middleware/auth');

const postSchema = Joi.object({
  title: Joi.string().min(1).max(120).required(),
  body: Joi.string().min(1).required(),
  tags: Joi.array().items(Joi.string()).optional()
});

// Create post
router.post('/', auth, async (req, res) => {
  const { error } = postSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  try {
    const post = new Post({ ...req.body, authorId: req.user.id });
    await post.save();
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get posts (paginated)
router.get(['/', ''], async (req, res) => {
  const { page = 1, limit = 10, sort = '-createdAt' } = req.query;
  try {
    const posts = await Post.find()
      .sort(sort)
      .skip((page-1)*limit)
      .limit(Number(limit));
    const total = await Post.countDocuments();
    res.json({ data: posts, page: Number(page), limit: Number(limit), total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get post by id
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update post (owner or admin only)
router.put('/:id', auth, async (req, res) => {
  const { error } = postSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  try {
    let post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (post.authorId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    post = await Post.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete post (owner or admin only)
router.delete('/:id', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Not found' });
    if (post.authorId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
