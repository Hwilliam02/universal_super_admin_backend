export function mongoErrorHandler(err, req, res, next) {
  console.log("Global Error:", err);

  // Mongo duplicate key
 if (err.code === 11000) {
  const field = Object.keys(err.keyValue)[0];         // domain
  const value = err.keyValue[field];                  // email

  const cleanValue = String(value).replace(/"/g, ""); // remove quotes if any

  return res.status(400).json({
    status: false,
    message: `${field} ${cleanValue} already exists.`
  });
}

  // Other errors
  return res.status(500).json({
    status: false,
    message: err.message || "Internal server error",
  });
}
