const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { signToken } = require('../auth');
const { fail, wrap, methodNotAllowed } = require('../errors');

const router = express.Router();
const isEmail = (v) => typeof v === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);

router.route('/register')
  .post(wrap(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (typeof name !== 'string' || !name.trim()) return fail(res, 400, 'VALIDATION_ERROR', 'name is required');
    if (!isEmail(email)) return fail(res, 400, 'VALIDATION_ERROR', 'a valid email is required');
    if (typeof password !== 'string' || password.length < 8) {
      return fail(res, 400, 'VALIDATION_ERROR', 'password must be at least 8 characters');
    }
    const hash = await bcrypt.hash(password, 10);
    try {
      // Role is NOT taken from the request: self-registration is always a normal user.
      const [r] = await pool.execute(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, "user")',
        [name.trim(), email, hash]);
      res.status(201).json({ id: r.insertId, name: name.trim(), email, role: 'user' });
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return fail(res, 409, 'EMAIL_EXISTS', 'email already registered');
      throw e;
    }
  }))
  .all(methodNotAllowed);

router.route('/login')
  .post(wrap(async (req, res) => {
    const { email, password } = req.body || {};
    if (!isEmail(email) || typeof password !== 'string' || !password) {
      return fail(res, 400, 'VALIDATION_ERROR', 'email and password are required');
    }
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    const user = rows[0];
    // Same message for unknown email and wrong password, so attackers cannot tell which was wrong.
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return fail(res, 401, 'INVALID_CREDENTIALS', 'email or password is incorrect');
    }
    res.json({ token: signToken(user) });
  }))
  .all(methodNotAllowed);

module.exports = router;
