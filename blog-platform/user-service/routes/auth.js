const express = require('express');
const router = express.Router();
const Joi = require('joi');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const registerSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  role: Joi.string().valid('user', 'admin').optional()
});

router.post('/register', async (req, res) => {
  const { error } = registerSchema.validate(req.body);
  if (error) {
    console.warn('Validation error:', error.details[0].message);
    return res.status(400).json({ error: error.details[0].message });
  }
  const { username, email, password, role = 'user' } = req.body;
  try {
    if (await User.findOne({ $or: [{ username }, { email }] })) {
      console.warn('Conflict: Username or email exists');
      return res.status(409).json({ error: 'Username or email exists' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const user = new User({ username, email, passwordHash, role });
    await user.save();
    res.status(201).json({ message: 'Registered' });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

const loginSchema = Joi.object({
  username: Joi.string().required(),
  password: Joi.string().required()
});

router.post('/login', async (req, res) => {
  const { error } = loginSchema.validate(req.body);
  if (error) {
    console.warn('Validation error (login):', error.details[0].message);
    return res.status(400).json({ error: error.details[0].message });
  }
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      console.warn('Invalid credentials for', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user._id, username: user.username, role: user.role }, process.env.JWT_SECRET || 'supersecret', { expiresIn: '2h' });
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

module.exports = router;
