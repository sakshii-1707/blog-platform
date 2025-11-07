const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Comment = require('../models/Comment');
const auth = require('../middleware/auth');

const commentSchema = Joi.object({
  body: Joi.string().min(1).max(1000).required(),
  postId: Joi.string().required()
});

// Create comment
router.post('/', auth, async (req, res) => {
  const { error } = commentSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details[0].message });
  try {
    const comment = new Comment({ ...req.body, authorId: req.user.id });
    await comment.save();
    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get comments (for a post, paginated)
router.get('/', async (req, res) => {
  const { postId, page = 1, limit = 10, sort = '-createdAt' } = req.query;
  if (!postId) return res.status(400).json({ error: 'postId required' });
  try {
    const comments = await Comment.find({ postId, softDeleted: false })
      .sort(sort)
      .skip((page-1)*limit)
      .limit(Number(limit));
    const total = await Comment.countDocuments({ postId, softDeleted: false });
    res.json({ data: comments, page: Number(page), limit: Number(limit), total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get comment by id
router.get('/:id', async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment || comment.softDeleted) return res.status(404).json({ error: 'Not found' });
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update comment (owner or admin only)
router.put('/:id', auth, async (req, res) => {
  const { body } = req.body;
  if (!body) return res.status(400).json({ error: 'Body required' });
  try {
    let comment = await Comment.findById(req.params.id);
    if (!comment || comment.softDeleted) return res.status(404).json({ error: 'Not found' });
    if (comment.authorId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    comment.body = body;
    await comment.save();
    res.json(comment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete (soft) comment
router.delete('/:id', auth, async (req, res) => {
  try {
    let comment = await Comment.findById(req.params.id);
    if (!comment || comment.softDeleted) return res.status(404).json({ error: 'Not found' });
    if (comment.authorId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    comment.softDeleted = true;
    await comment.save();
    res.json({ message: 'Soft deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
