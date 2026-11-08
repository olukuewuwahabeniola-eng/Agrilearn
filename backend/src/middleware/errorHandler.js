function publicErrorMessage(err, status) {
  if (err?.code === "LIMIT_FILE_SIZE") {
    return "That file is too large.";
  }
  if (err?.code === "LIMIT_FILE_COUNT") {
    return "Too many files were uploaded.";
  }
  if (status >= 500) {
    return "Something went wrong on the server";
  }
  return err?.message || "Something went wrong on the server";
}

function errorHandler(err, req, res, next) {
  const status = Number(err.statusCode || err.status) || 500;
  const safeStatus = status >= 400 && status < 600 ? status : 500;

  if (safeStatus >= 500) {
    console.error(err);
  } else {
    console.error(err?.message || err);
  }

  res.status(safeStatus).json({
    success: false,
    message: publicErrorMessage(err, safeStatus),
  });
}

module.exports = errorHandler;
