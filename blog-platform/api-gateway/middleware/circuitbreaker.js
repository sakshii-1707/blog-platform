const CircuitBreaker = require('opossum');

function circuitBreakerMiddlewareFactory(asyncHandler, opts = {}) {
  const breaker = new CircuitBreaker(asyncHandler, {
    timeout: 6000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
    ...opts,
  });

  return async function (req, res, next) {
    breaker.fire(req, res, next).catch(err => {
      res.status(503).json({ error: 'Upstream unavailable (breaker open)', details: err.message });
    });
  };
}

module.exports = circuitBreakerMiddlewareFactory;
