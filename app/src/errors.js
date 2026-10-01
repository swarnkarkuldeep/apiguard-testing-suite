// One place that builds the error format used by every endpoint.
function fail(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

// Wrap async route handlers so a thrown error becomes a 500 instead of a hung request.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Used on routes: any HTTP method we did not define returns 405.
function methodNotAllowed(req, res) {
  return fail(res, 405, 'METHOD_NOT_ALLOWED', `${req.method} is not allowed on ${req.path}`);
}

module.exports = { fail, wrap, methodNotAllowed };
