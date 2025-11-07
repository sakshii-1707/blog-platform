const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Malformed token' });
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET || 'supersecret');
    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
}
module.exports = authMiddleware;
