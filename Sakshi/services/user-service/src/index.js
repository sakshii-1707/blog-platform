import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import pino from 'pino';
import pinoHttp from 'pino-http';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { User } from './models/User.js';

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
app.use(pinoHttp({ logger }));
app.use(helmet());
app.use(express.json({ limit: '1mb' }));

const PORT = process.env.PORT || 3001;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/users';

await mongoose.connect(MONGO_URL, { autoIndex: true });
// Ensure indexes built before serving traffic to avoid long first requests
await User.init();
app.locals.ready = true;

app.get('/health', async (req, res) => {
	res.json({ status: 'ok', service: 'user-service' });
});

app.get('/metrics', (req, res) => {
	const mem = process.memoryUsage();
	res.type('application/json').send({
		uptime: process.uptime(),
		memory: { rss: mem.rss, heapUsed: mem.heapUsed, heapTotal: mem.heapTotal },
		pid: process.pid,
		service: 'user-service'
	});
});

const registerSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8),
	name: z.string().min(1)
});

const loginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8)
});

const JWT_SECRET = (process.env.DEV_JWT_SECRET || process.env.JWT_PRIVATE_KEY || 'dev-secret')
	.replace(/\\n/g, '\n');

function signJwt(claims) {
	return jwt.sign(claims, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

app.post('/auth/register', async (req, res) => {
	try {
		const parsed = registerSchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
		const { email, password, name } = parsed.data;
		const existing = await User.findOne({ email });
		if (existing) return res.status(409).json({ error: 'Email already registered' });
		const passwordHash = await bcrypt.hash(password, 10);
		const user = await User.create({ email, passwordHash, name, role: 'user' });
		const token = signJwt({ sub: user.id, email: user.email, role: user.role });
		return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
	} catch (err) {
		req.log.error({ err }, 'register_failed');
		return res.status(500).json({ error: 'Registration failed' });
	}
});

app.post('/auth/login', async (req, res) => {
	try {
		const parsed = loginSchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
		const { email, password } = parsed.data;
		const user = await User.findOne({ email });
		if (!user) return res.status(401).json({ error: 'Invalid credentials' });
		const ok = await bcrypt.compare(password, user.passwordHash);
		if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
		const token = signJwt({ sub: user.id, email: user.email, role: user.role });
		return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
	} catch (err) {
		req.log.error({ err }, 'login_failed');
		return res.status(500).json({ error: 'Login failed' });
	}
});

// Middleware to validate JWT for protected endpoints inside the service boundary (gateway already validates)
function authenticate(req, res, next) {
	const authHeader = req.headers.authorization || '';
	const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
	if (!token) return res.status(401).json({ error: 'Missing token' });
	try {
		req.user = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
		return next();
	} catch {
		return res.status(401).json({ error: 'Invalid token' });
	}
}

app.get('/profile/me', authenticate, async (req, res) => {
	const user = await User.findById(req.user.sub).lean();
	if (!user) return res.status(404).json({ error: 'Not found' });
	res.json({ id: user._id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt });
});

const updateProfileSchema = z.object({
	name: z.string().min(1)
});

app.put('/profile/me', authenticate, async (req, res) => {
	try {
		const parsed = updateProfileSchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
		const { name } = parsed.data;
		const user = await User.findByIdAndUpdate(req.user.sub, { name }, { new: true }).lean();
		if (!user) return res.status(404).json({ error: 'Not found' });
		res.json({ id: user._id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt });
	} catch (err) {
		req.log.error({ err }, 'update_profile_failed');
		return res.status(500).json({ error: 'Failed to update profile' });
	}
});

const changePasswordSchema = z.object({
	currentPassword: z.string().min(8),
	newPassword: z.string().min(8)
});

app.put('/profile/password', authenticate, async (req, res) => {
	try {
		const parsed = changePasswordSchema.safeParse(req.body);
		if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
		const { currentPassword, newPassword } = parsed.data;
		const user = await User.findById(req.user.sub);
		if (!user) return res.status(404).json({ error: 'Not found' });
		const ok = await bcrypt.compare(currentPassword, user.passwordHash);
		if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
		const passwordHash = await bcrypt.hash(newPassword, 10);
		user.passwordHash = passwordHash;
		await user.save();
		res.json({ message: 'Password updated successfully' });
	} catch (err) {
		req.log.error({ err }, 'change_password_failed');
		return res.status(500).json({ error: 'Failed to change password' });
	}
});

app.get('/public/:id', async (req, res) => {
	const user = await User.findById(req.params.id).lean();
	if (!user) return res.status(404).json({ error: 'Not found' });
	res.json({ id: user._id, name: user.name });
});

app.listen(PORT, () => {
	logger.info({ port: PORT }, 'User service listening');
});


