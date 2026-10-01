const express = require('express');
const pool = require('../db');
const { authenticate } = require('../auth');
const { fail, wrap, methodNotAllowed } = require('../errors');

const router = express.Router();
router.use(authenticate); // every order route needs a valid token
const isId = (v) => /^[1-9]\d*$/.test(String(v));

async function loadOrder(id, userId) {
  // user_id in the WHERE clause: other users' orders look like "not found".
  const [orders] = await pool.execute('SELECT * FROM orders WHERE id = ? AND user_id = ?', [id, userId]);
  if (!orders[0]) return null;
  const [items] = await pool.execute(
    'SELECT product_id AS productId, qty, unit_price AS unitPrice FROM order_items WHERE order_id = ? ORDER BY id', [id]);
  const o = orders[0];
  return { id: o.id, userId: o.user_id, total: o.total, createdAt: o.created_at, items };
}

router.route('/')
  .post(wrap(async (req, res) => {
    const items = req.body && req.body.items;
    if (!Array.isArray(items) || items.length === 0) return fail(res, 400, 'VALIDATION_ERROR', 'items must be a non-empty array');
    for (const it of items) {
      if (!it || !Number.isInteger(it.productId) || it.productId < 1 || !Number.isInteger(it.qty) || it.qty < 1) {
        return fail(res, 400, 'VALIDATION_ERROR', 'each item needs integer productId >= 1 and qty >= 1');
      }
    }

    // One transaction: either the whole order (rows + stock change) is saved, or nothing is.
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      let total = 0;
      const lines = [];
      for (const it of items) {
        // FOR UPDATE locks the row so two orders cannot oversell the same stock.
        const [rows] = await conn.execute('SELECT id, price, stock FROM products WHERE id = ? FOR UPDATE', [it.productId]);
        const p = rows[0];
        if (!p) { await conn.rollback(); return fail(res, 404, 'PRODUCT_NOT_FOUND', `product ${it.productId} not found`); }
        if (p.stock < it.qty) { await conn.rollback(); return fail(res, 409, 'INSUFFICIENT_STOCK', `not enough stock for product ${it.productId}`); }
        await conn.execute('UPDATE products SET stock = stock - ? WHERE id = ?', [it.qty, it.productId]);
        total += p.price * it.qty;
        lines.push({ productId: p.id, qty: it.qty, unitPrice: p.price });
      }
      total = Math.round(total * 100) / 100; // avoid float noise such as 59.489999
      const [o] = await conn.execute('INSERT INTO orders (user_id, total) VALUES (?, ?)', [req.user.id, total]);
      for (const l of lines) {
        await conn.execute('INSERT INTO order_items (order_id, product_id, qty, unit_price) VALUES (?, ?, ?, ?)',
          [o.insertId, l.productId, l.qty, l.unitPrice]);
      }
      await conn.commit();
      res.status(201).json({ id: o.insertId, total, items: lines });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }))
  .get(wrap(async (req, res) => {
    const [rows] = await pool.execute('SELECT id, total, created_at AS createdAt FROM orders WHERE user_id = ? ORDER BY id', [req.user.id]);
    res.json(rows);
  }))
  .all(methodNotAllowed);

router.route('/:id')
  .get(wrap(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 404, 'NOT_FOUND', 'order not found');
    const order = await loadOrder(req.params.id, req.user.id);
    if (!order) return fail(res, 404, 'NOT_FOUND', 'order not found');
    res.json(order);
  }))
  .all(methodNotAllowed);

module.exports = router;
