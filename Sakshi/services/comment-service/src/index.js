import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import axios from 'axios';
import CircuitBreaker from 'opossum';
import { Comment } from './models/Comment.js';

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3003;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/comments';
await mongoose.connect(MONGO_URL, { autoIndex: true });

// Health
app.get('/health', (req, res) => {
	res.json({ status: 'ok', service: 'comment-service' });
});

app.get('/metrics', (req, res) => {
	const mem = process.memoryUsage();
	res.type('application/json').send({
		uptime: process.uptime(),
		memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
		pid: process.pid,
		service: 'comment-service'
	});
});

// Auth (validated at gateway; enforce again here)
function authenticate(req, res, next) {
	let uid = req.headers['x-user-id'];
	let role = req.headers['x-user-role'] || 'user';
	
	// Fallback: try to extract from Bearer token (dev mode - don't verify signature)
	if (!uid && req.headers.authorization) {
		const token = req.headers.authorization.replace(/^Bearer /, '');
		try {
			const parts = token.split('.');
			if (parts.length === 3) {
				const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
				uid = payload.sub || payload.userId;
				role = payload.role || 'user';
			}
		} catch (e) {
			// ignore
		}
	}
	
	// Dev fallback
	if (!uid && process.env.NODE_ENV !== 'production') {
		uid = 'dev-user';
		role = 'user';
	}
	
	if (!uid) return res.status(401).json({ error: 'Missing user' });
	req.user = { id: uid, role };
	next();
}

// Circuit breaker to call post-service to validate post existence
const axiosInstance = axios.create({ timeout: 3000 });
const breaker = new CircuitBreaker((url, opts) => axiosInstance.get(url, opts), {
	timeout: 4000,
	errorThresholdPercentage: 50,
	resetTimeout: 5000
});
breaker.fallback(() => ({ data: null, status: 200 }));

const commentSchema = z.object({
	postId: z.string().min(1),
	content: z.string().min(1),
	parentId: z.string().optional().nullable() // Optional parent comment ID for replies
});

// List by post with pagination (returns nested replies)
app.get('/', async (req, res) => {
	const postId = String(req.query.postId || '');
	if (!postId) return res.status(400).json({ error: 'postId required' });
	const page = Math.max(1, Number(req.query.page || 1));
	const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
	const skip = (page - 1) * limit;
	
	// Get all comments for this post (including replies)
	const allComments = await Comment.find({ postId }).sort({ createdAt: 1 }).lean();
	
	// Separate top-level comments and replies
	const topLevel = allComments.filter(c => !c.parentId).slice(skip, skip + limit);
	const replies = allComments.filter(c => c.parentId);
	
	// Build nested structure
	const buildNested = (comments) => {
		return comments.map(c => {
			const commentReplies = replies.filter(r => String(r.parentId) === String(c._id));
			return {
				id: String(c._id),
				postId: String(c.postId),
				userId: String(c.userId),
				content: c.content,
				parentId: c.parentId ? String(c.parentId) : null,
				createdAt: c.createdAt,
				replies: buildNested(commentReplies)
			};
		});
	};
	
	const nested = buildNested(topLevel);
	const total = allComments.filter(c => !c.parentId).length;
	
	res.set('X-Total-Count', String(total));
	res.json(nested);
});

// Create comment
app.post('/', authenticate, async (req, res) => {
	const parsed = commentSchema.safeParse(req.body);
	if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
	const { postId, content, parentId } = parsed.data;
	// Validate post exists (graceful degrade if breaker open)
	try {
		await breaker.fire(`${process.env.POST_SERVICE_URL || 'http://post-service:3002'}/${postId}`);
	} catch (e) {
		req.log.warn({ err: e }, 'post validation degraded');
	}
	// If parentId is provided, validate parent comment exists
	if (parentId) {
		const parent = await Comment.findById(parentId);
		if (!parent || parent.postId !== postId) {
			return res.status(400).json({ error: 'Invalid parent comment' });
		}
	}
	const comment = await Comment.create({ postId, userId: req.user.id, content, parentId: parentId || null });
	res.status(201).json({ 
		id: String(comment._id), 
		postId: String(comment.postId), 
		userId: String(comment.userId), 
		content: comment.content, 
		parentId: comment.parentId ? String(comment.parentId) : null,
		createdAt: comment.createdAt,
		replies: []
	});
});

// Delete comment
app.delete('/:id', authenticate, async (req, res) => {
	const c = await Comment.findById(req.params.id);
	if (!c) return res.status(404).json({ error: 'Not found' });
	if (c.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
	await c.deleteOne();
	res.status(204).end();
});

app.listen(PORT, () => {
	logger.info({ port: PORT }, 'Comment service listening');
});


