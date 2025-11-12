import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { z } from 'zod';
import axios from 'axios';
import CircuitBreaker from 'opossum';
import { Post } from './models/Post.js';

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3002;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/posts';
await mongoose.connect(MONGO_URL, { autoIndex: true });

// Health
app.get('/health', (req, res) => {
	res.json({ status: 'ok', service: 'post-service' });
});

app.get('/metrics', (req, res) => {
	const mem = process.memoryUsage();
	res.type('application/json').send({
		uptime: process.uptime(),
		memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
		pid: process.pid,
		service: 'post-service'
	});
});

// Auth (validate in service as well)
function authenticate(req, res, next) {
	let uid = req.headers['x-user-id'];
	let role = req.headers['x-user-role'] || 'user';
	if (!uid) {
		// Try to derive from Authorization if present (decode payload only)
		const authHeader = req.headers.authorization || '';
		const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
		if (token) {
			try {
				const payload = JSON.parse(Buffer.from((token.split('.')[1] || ''), 'base64').toString('utf8'));
				if (payload?.sub) {
					uid = payload.sub;
					role = payload.role || role;
				}
			} catch { /* ignore */ }
		}
	}
	if (!uid && (process.env.NODE_ENV || 'development') === 'development') {
		uid = 'dev-user';
	}
	if (!uid) return res.status(401).json({ error: 'Missing user' });
	req.user = { id: uid, role };
	return next();
}

// Circuit breaker for outbound calls (e.g., to user service if needed)
const axiosInstance = axios.create({ timeout: 3000 });
const breaker = new CircuitBreaker((url, opts) => axiosInstance.get(url, opts), {
	timeout: 4000,
	errorThresholdPercentage: 50,
	resetTimeout: 5000
});
breaker.fallback(() => ({ data: null, status: 200 }));

const postSchema = z.object({
	title: z.string().min(1),
	content: z.string().min(1)
});

// List with pagination
app.get('/', async (req, res) => {
	const page = Math.max(1, Number(req.query.page || 1));
	const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10)));
	const skip = (page - 1) * limit;
	const [items, total] = await Promise.all([
		Post.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
		Post.countDocuments({})
	]);
	res.set('X-Total-Count', String(total));
	res.json(items.map(p => ({ id: p._id, title: p.title, content: p.content, userId: p.userId, createdAt: p.createdAt })));
});

// Create
app.post('/', authenticate, async (req, res) => {
	const parsed = postSchema.safeParse(req.body);
	if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
	const { title, content } = parsed.data;
	const post = await Post.create({ title, content, userId: req.user.id });
	res.status(201).json({ id: post._id, title: post.title, content: post.content, userId: post.userId, createdAt: post.createdAt });
});

// Read
app.get('/:id', async (req, res) => {
	const post = await Post.findById(req.params.id).lean();
	if (!post) return res.status(404).json({ error: 'Not found' });
	res.json({ id: post._id, title: post.title, content: post.content, userId: post.userId, createdAt: post.createdAt });
});

// Update
app.put('/:id', authenticate, async (req, res) => {
	const parsed = postSchema.partial().refine(d => Object.keys(d).length > 0).safeParse(req.body);
	if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
	const post = await Post.findById(req.params.id);
	if (!post) return res.status(404).json({ error: 'Not found' });
	if (post.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
	if (parsed.data.title) post.title = parsed.data.title;
	if (parsed.data.content) post.content = parsed.data.content;
	await post.save();
	res.json({ id: post._id, title: post.title, content: post.content, userId: post.userId, createdAt: post.createdAt, updatedAt: post.updatedAt });
});

// Delete
app.delete('/:id', authenticate, async (req, res) => {
	const post = await Post.findById(req.params.id);
	if (!post) return res.status(404).json({ error: 'Not found' });
	if (post.userId !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
	await post.deleteOne();
	res.status(204).end();
});

app.listen(PORT, () => {
	logger.info({ port: PORT }, 'Post service listening');
});


