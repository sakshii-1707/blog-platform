const { v4: uuidv4 } = require('uuid');

function correlationId(req, res, next) {
  let id = req.headers['x-correlation-id'];
  if (!id) id = uuidv4();
  req.correlationId = id;
  res.setHeader('X-Correlation-ID', id);
  next();
}

module.exports = correlationId;
