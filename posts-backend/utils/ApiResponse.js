// Thin helpers that enforce the project's standard response envelope so
// every controller returns the exact same shape.

class ApiResponse {
  static success(res, { statusCode = 200, message = "Success", data = {}, meta = undefined }) {
    const body = { success: true, message, data };
    if (meta !== undefined) body.meta = meta;
    return res.status(statusCode).json(body);
  }

  static error(res, { statusCode = 500, message = "Something went wrong", errors = [] }) {
    return res.status(statusCode).json({ success: false, message, errors });
  }
}

module.exports = ApiResponse;
