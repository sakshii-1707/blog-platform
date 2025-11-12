import mongoose from 'mongoose';

const CommentSchema = new mongoose.Schema(
	{
		postId: { type: String, required: true },
		userId: { type: String, required: true },
		content: { type: String, required: true },
		parentId: { type: String, default: null } // null for top-level comments, comment ID for replies
	},
	{ timestamps: true }
);

export const Comment = mongoose.model('Comment', CommentSchema);


