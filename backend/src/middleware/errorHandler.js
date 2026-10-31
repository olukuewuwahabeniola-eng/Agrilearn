/**
 * Central error handler (ready for later features).
 * Express will use this when we add more routes.
 */
function errorHandler(err, req, res, next) {
  console.error(err);

  const status = err.statusCode || 500;

  res.status(status).json({
    success: false,
    message: err.message || "Something went wrong on the server",
  });
}

module.exports = errorHandler;
