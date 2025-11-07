const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
  title: { type: String, required: true },
  body: { type: String, required: true },
  authorId: { type: String, required: true, index: true },
  tags: [String]
}, { timestamps: true });

module.exports = mongoose.model('Post', postSchema);
