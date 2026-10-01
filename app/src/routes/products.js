const express = require('express');
const pool = require('../db');
const { authenticate, requireAdmin } = require('../auth');
const { fail, wrap, methodNotAllowed } = require('../errors');

const router = express.Router();
const isId = (v) => /^[1-9]\d*$/.test(String(v));

// Validates the product body; returns an error message or null.
function validate(b) {
  if (!b || typeof b.name !== 'string' || !b.name.trim()) return 'name is required';
  if (typeof b.sku !== 'string' || !b.sku.trim()) return 'sku is required';
  if (typeof b.price !== 'number' || !(b.price >= 0)) return 'price must be a number >= 0';
  if (!Number.isInteger(b.stock) || b.stock < 0) return 'stock must be an integer >= 0';
  return null;
}

const load = async (id) => (await pool.execute('SELECT * FROM products WHERE id = ?', [id]))[0][0];

router.route('/')
  .get(wrap(async (req, res) => {
    const [rows] = await pool.execute('SELECT * FROM products ORDER BY id');
    res.json(rows);
  }))
  .post(authenticate, requireAdmin, wrap(async (req, res) => {
    const msg = validate(req.body);
    if (msg) return fail(res, 400, 'VALIDATION_ERROR', msg);
    const { name, sku, price, stock } = req.body;
    try {
      const [r] = await pool.execute(
        'INSERT INTO products (name, sku, price, stock) VALUES (?, ?, ?, ?)', [name.trim(), sku.trim(), price, stock]);
      res.status(201).json(await load(r.insertId));
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return fail(res, 409, 'SKU_EXISTS', 'sku already exists');
      throw e;
    }
  }))
  .all(methodNotAllowed);

router.route('/:id')
  .get(wrap(async (req, res) => {
    // Non-numeric ids (including SQL-injection strings) are rejected before touching the DB.
    if (!isId(req.params.id)) return fail(res, 404, 'NOT_FOUND', 'product not found');
    const p = await load(req.params.id);
    if (!p) return fail(res, 404, 'NOT_FOUND', 'product not found');
    res.json(p);
  }))
  .put(authenticate, requireAdmin, wrap(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 404, 'NOT_FOUND', 'product not found');
    const msg = validate(req.body);
    if (msg) return fail(res, 400, 'VALIDATION_ERROR', msg);
    const { name, sku, price, stock } = req.body;
    try {
      const [r] = await pool.execute(
        'UPDATE products SET name=?, sku=?, price=?, stock=? WHERE id=?', [name.trim(), sku.trim(), price, stock, req.params.id]);
      if (r.affectedRows === 0) return fail(res, 404, 'NOT_FOUND', 'product not found');
      res.json(await load(req.params.id));
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') return fail(res, 409, 'SKU_EXISTS', 'sku already exists');
      throw e;
    }
  }))
  .delete(authenticate, requireAdmin, wrap(async (req, res) => {
    if (!isId(req.params.id)) return fail(res, 404, 'NOT_FOUND', 'product not found');
    try {
      const [r] = await pool.execute('DELETE FROM products WHERE id = ?', [req.params.id]);
      if (r.affectedRows === 0) return fail(res, 404, 'NOT_FOUND', 'product not found');
      res.status(204).end();
    } catch (e) {
      // Foreign key from order_items blocks deleting a product that was ordered.
      if (e.code === 'ER_ROW_IS_REFERENCED_2') return fail(res, 409, 'PRODUCT_IN_USE', 'product is part of an order');
      throw e;
    }
  }))
  .all(methodNotAllowed);

module.exports = router;
