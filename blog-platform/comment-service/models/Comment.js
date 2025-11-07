const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  body: { type: String, required: true },
  authorId: { type: String, required: true, index: true },
  postId: { type: String, required: true, index: true },
  softDeleted: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);
