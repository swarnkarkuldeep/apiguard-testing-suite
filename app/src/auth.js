const jwt = require('jsonwebtoken');
const { fail } = require('./errors');

const SECRET = process.env.JWT_SECRET;

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, SECRET, { expiresIn: '1h' });
}

// Reads "Authorization: Bearer <token>". Missing/invalid/expired all give 401 with a distinct code.
function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return fail(res, 401, 'TOKEN_MISSING', 'Authorization: Bearer <token> header is required');
  }
  try {
    const payload = jwt.verify(token, SECRET);
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    return fail(res, 401, expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
      expired ? 'Token has expired' : 'Token is invalid');
  }
}

function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') return fail(res, 403, 'FORBIDDEN', 'Admin role required');
  next();
}

module.exports = { signToken, authenticate, requireAdmin };
