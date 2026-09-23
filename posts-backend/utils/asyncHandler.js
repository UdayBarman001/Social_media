// Wraps async route/controller functions so rejected promises are forwarded
// to Express's error handler instead of crashing the process or needing a
// try/catch in every controller.

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
