import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import pino from 'pino';
import pinoHttp from 'pino-http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const app = express();

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
app.use(pinoHttp({ logger, genReqId: (req) => req.headers['x-request-id'] || randomUUID() }));

app.use(helmet());
app.use(cors({ origin: true, credentials: true }));

const limiter = rateLimit({
	windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
	max: Number(process.env.RATE_LIMIT_MAX || 100)
});
app.use(limiter);

const PORT = process.env.PORT || 8080;
const userService = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const postService = process.env.POST_SERVICE_URL || 'http://localhost:3002';
const commentService = process.env.COMMENT_SERVICE_URL || 'http://localhost:3003';
const JWT_SECRET = (process.env.DEV_JWT_SECRET || process.env.JWT_PUBLIC_KEY || 'dev-secret')
	.replace(/\\n/g, '\n');

// Health endpoint
app.get('/health', (req, res) => {
	res.set('X-API-Version', 'v1');
	res.json({ status: 'ok', service: 'gateway' });
});

// Basic metrics
app.get('/metrics', (req, res) => {
	const mem = process.memoryUsage();
	res.type('application/json').send({
		uptime: process.uptime(),
		memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
		pid: process.pid,
		service: 'gateway'
	});
});

// Version deprecation example
app.use((req, res, next) => {
	res.set('X-API-Version', 'v1');
	// res.set('Sunset', 'Wed, 01 Jan 2026 00:00:00 GMT'); // example deprecation header
	next();
});

// Auth middleware: validate JWT (except for public routes)
const publicPaths = new Set([
	'/api/v1/auth/login',
	'/api/v1/auth/register',
	'/health'
]);

function authMiddleware(req, res, next) {
	if (req.method === 'OPTIONS') return next();
	if (publicPaths.has(req.path)) return next();
	if (req.path.startsWith('/api/v1/users/public')) return next();
	const authHeader = req.headers.authorization || '';
	const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!token) {
		// Dev-mode grace: allow unauthenticated and inject a dev user so you can post
		if ((process.env.NODE_ENV || 'development') === 'development') {
			req.user = { sub: 'dev-user', role: 'user' };
			req.headers.authorization = `Bearer dev-${req.id}`;
			return next();
		}
		return res.status(401).json({ error: 'Missing token' });
	}
	try {
		const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
		req.user = payload;
		return next();
	} catch (err) {
		req.log.error({ err }, 'JWT validation failed');
		if ((process.env.NODE_ENV || 'development') === 'development') {
			req.log.warn('Falling back to dev user due to invalid JWT');
			req.user = { sub: 'dev-user', role: 'user' };
			return next();
		}
		return res.status(401).json({ error: 'Invalid token' });
	}
}

app.use(authMiddleware);

// Proxy helpers: inject correlation id and user context headers
function withCommonProxyHeaders(proxyReq, req) {
	proxyReq.setHeader('x-request-id', req.id);
	const isDev = (process.env.NODE_ENV || 'development') === 'development';
	const userId = req.user?.sub || req.headers['x-user-id'] || (isDev ? 'dev-user' : undefined);
	const userRole = req.user?.role || req.headers['x-user-role'] || 'user';
	if (userId) proxyReq.setHeader('x-user-id', userId);
	if (userRole) proxyReq.setHeader('x-user-role', userRole);
}

const proxyCommon = {
	changeOrigin: true,
	timeout: 45000,
	proxyTimeout: 45000,
	onError: (err, req, res) => {
		req.log.error({ err }, 'Upstream error');
		if (!res.headersSent) {
			res.status(502).json({ error: 'Upstream service error or timeout' });
		}
	},
	onProxyReq: withCommonProxyHeaders,
	logProvider: () => logger
};

const userProxy = createProxyMiddleware({
	target: userService,
	pathRewrite: { '^/api/v1/users': '' },
	...proxyCommon
});

const authProxy = createProxyMiddleware({
	target: userService,
	// When mounted at /api/v1/auth, the incoming path seen here is like "/register".
	// Prefix with /auth so the user-service receives "/auth/register".
	pathRewrite: (path) => `/auth${path}`,
	...proxyCommon
});

const postProxy = createProxyMiddleware({
	target: postService,
	pathRewrite: { '^/api/v1/posts': '' },
	...proxyCommon
});

const commentProxy = createProxyMiddleware({
	target: commentService,
	pathRewrite: { '^/api/v1/comments': '' },
	...proxyCommon
});

// Routes mapping
app.use('/api/v1/auth', authProxy);
app.use('/api/v1/users', userProxy);
app.use('/api/v1/posts', postProxy);
app.use('/api/v1/comments', commentProxy);

app.listen(PORT, () => {
	logger.info({ port: PORT }, 'API Gateway listening');
});


