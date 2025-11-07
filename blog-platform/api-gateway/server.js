const express = require('express');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const rateLimit = require('express-rate-limit');
const jwtAuth = require('./middleware/jwt');
const correlationId = require('./middleware/correlation');
const breakerFactory = require('./middleware/circuitbreaker');
const { v4: uuidv4 } = require('uuid');

const PORT = 8080;
const app = express();

const userService = process.env.USER_SERVICE_URL || 'http://localhost:4001';
const postService = process.env.POST_SERVICE_URL || 'http://localhost:4002';
const commentService = process.env.COMMENT_SERVICE_URL || 'http://localhost:4003';

// JSON Logging
app.use(express.json());
app.use(correlationId); // Always assign correlation-id
app.use((req, res, next) => { // JSON logger
  req.startTime = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      time: new Date().toISOString(),
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      user: req.user,
      correlationId: req.correlationId,
      durationMs: Date.now() - req.startTime
    }));
  });
  next();
});
// Rate limiting
app.use(rateLimit({ windowMs: 60*1000, max: 100 }));
// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Correlation-ID');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});
// Health
app.get('/api/v1/health', (req, res) => res.json({ status: 'ok', service: 'gateway' }));
// Metrics
app.get('/api/v1/metrics', (req, res) => res.type('text/plain').send('up 1\n'));
// Gateway traces requests (correlationId on all)
const proxyOpts = (serviceUrl) => ({
  target: serviceUrl,
  changeOrigin: true,
  pathRewrite: {
    '^/api/v1/users': '/api/v1',
    '^/api/v1/posts': '/api/v1',
    '^/api/v1/comments': '/api/v1'
  },
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('X-Correlation-ID', req.correlationId);
    if (req.user) {
      proxyReq.setHeader('X-User-Id', req.user.id);
      proxyReq.setHeader('X-User-Role', req.user.role);
      proxyReq.setHeader('X-User-Name', req.user.username);
    }
  },
  onError: (err, req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 500;
    res.end(JSON.stringify({ error: err.message }));
  },
  onProxyRes: function (proxyRes, req, res) {
    if (proxyRes.statusCode >= 400) {
      let body = '';
      proxyRes.on('data', function (chunk) { body += chunk; });
      proxyRes.on('end', function () {
        res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');
        res.status(proxyRes.statusCode);
        res.end(body);
      });
    }
  },
});
// Force registration requests to user-service
app.use('/api/v1/users/register', (req, res, next) => {
  console.log('Proxying registration to user-service for', req.method, req.originalUrl);
  next();
},
  createProxyMiddleware({
    target: userService,
    changeOrigin: true,
    pathRewrite: {'^/api/v1/users/register': '/api/v1/register'},
    onError: (err, req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.statusCode = 500;
      res.end(JSON.stringify({ error: err.message }));
    },
    onProxyReq: (proxyReq, req, res) => {
      proxyReq.setHeader('X-Correlation-ID', req.correlationId);
    },
    onProxyRes: function (proxyRes, req, res) {
      if (proxyRes.statusCode >= 400) {
        let body = '';
        proxyRes.on('data', function (chunk) { body += chunk; });
        proxyRes.on('end', function () {
          res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');
          res.status(proxyRes.statusCode);
          res.end(body);
        });
      }
    },
  })
);
// Circuit breaker/forward for each service
app.use('/api/v1/users', breakerFactory(
  createProxyMiddleware(proxyOpts(userService))
));
app.use('/api/v1/posts', breakerFactory(
  createProxyMiddleware(proxyOpts(postService))
));
app.use('/api/v1/comments', breakerFactory(
  createProxyMiddleware(proxyOpts(commentService))
));
// Central error handler
app.use((err, req, res, next) => {
  console.error(JSON.stringify({
    error: err.message,
    stack: err.stack,
    correlationId: req.correlationId
  }));
  res.status(500).json({ error: err.message });
});
app.listen(PORT, () => console.log(`API Gateway listening on port ${PORT}`));
