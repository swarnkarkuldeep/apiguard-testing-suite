// db-verify.js - checks that what the API said matches what is in MySQL.
//
// How it works:
//   1. Newman runs the collection and exports its variables (IDs and API values) to a JSON file.
//   2. This script reads that file, runs every query in /sql with those values as parameters,
//      and compares the database rows with the values the API returned.
//
// Usage:  node scripts/db-verify.js --env local --export reports/local-env.json
// Exit code: 0 if every check passes, 1 if any check fails.
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const root = path.join(__dirname, '..');

// ---------- arguments ----------
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : fallback;
};
const envName = arg('env', 'local');
const exportFile = arg('export', path.join('reports', `${envName}-env.json`));

// Load .env so the script also works when run by hand (CI passes real environment variables).
require('./load-env')();

// ---------- Newman export -> plain { key: value } ----------
const exported = JSON.parse(fs.readFileSync(path.resolve(root, exportFile), 'utf8'));
const v = {};
for (const { key, value } of exported.values) v[key] = value;
const num = (key) => Number(v[key]);

const INJECTION_NAME = "'; DROP TABLE users;--"; // must match the name used in the negative tests

// ---------- the checks ----------
// Each check: sql file, params (what replaces the ? marks) and verify(rows) which returns
// null when the data is right, or a message that explains what is wrong.
const checks = [
  { file: '01_user_registered.sql', params: () => [num('newUserId')], verify: (rows) =>
      rows.length !== 1 ? `expected 1 row, got ${rows.length}`
      : rows[0].email !== v.newUserEmail ? `email in DB is ${rows[0].email}, API had ${v.newUserEmail}`
      : rows[0].role !== 'user' ? `role is ${rows[0].role}, expected user`
      : !rows[0].password_hash.startsWith('$2') || rows[0].password_hash === v.newUserPassword ? 'password is not stored as a bcrypt hash'
      : null },

  { file: '02_product_exists.sql', params: () => [num('productId')], verify: (rows) =>
      rows.length !== 1 ? `expected 1 row, got ${rows.length}`
      : rows[0].sku !== v.productSku ? `sku in DB is ${rows[0].sku}, API had ${v.productSku}`
      : !rows[0].created_at ? 'created_at is empty'
      : null },

  { file: '03_product_updated.sql', params: () => [num('productId')], verify: (rows) =>
      rows.length !== 1 ? `expected 1 row, got ${rows.length}`
      : rows[0].name !== v.updatedName ? `name in DB is "${rows[0].name}", API had "${v.updatedName}"`
      : rows[0].price !== num('updatedPrice') ? `price in DB is ${rows[0].price}, API had ${num('updatedPrice')}`
      : null },

  { file: '04_product_deleted.sql', params: () => [num('tempProductId')], verify: (rows) =>
      rows.length !== 0 ? `deleted product ${v.tempProductId} still exists in the database` : null },

  { file: '05_no_duplicate_emails.sql', params: () => [], verify: (rows) =>
      rows.length ? `duplicate emails: ${rows.map((r) => r.email).join(', ')}` : null },

  { file: '06_no_duplicate_skus.sql', params: () => [], verify: (rows) =>
      rows.length ? `duplicate skus: ${rows.map((r) => r.sku).join(', ')}` : null },

  { file: '07_order_total_matches.sql', params: () => [num('orderId')], verify: (rows) => {
      if (rows.length !== 1) return `expected 1 row, got ${rows.length}`;
      const r = rows[0];
      // Compare in cents to avoid floating-point noise.
      const cents = (x) => Math.round(Number(x) * 100);
      if (cents(r.stored_total) !== cents(r.items_total)) return `stored total ${r.stored_total} != sum of items ${r.items_total}`;
      if (cents(r.stored_total) !== cents(v.orderTotalApi)) return `stored total ${r.stored_total} != API total ${v.orderTotalApi}`;
      if (r.item_count !== 1) return `expected 1 item, got ${r.item_count}`;
      if (Number(r.qty) !== num('orderQtyApi')) return `qty in DB ${r.qty}, API had ${v.orderQtyApi}`;
      if (cents(r.unit_price) !== cents(v.orderUnitPriceApi)) return `unit_price in DB ${r.unit_price}, API had ${v.orderUnitPriceApi}`;
      return null;
    } },

  { file: '08_stock_decremented.sql', params: () => [num('productId')], verify: (rows) => {
      if (rows.length !== 1) return `expected 1 row, got ${rows.length}`;
      const expected = num('updatedStock') - num('orderQtyApi');
      return rows[0].stock !== expected ? `stock in DB is ${rows[0].stock}, expected ${expected}` : null;
    } },

  { file: '09_no_orphan_order_items.sql', params: () => [], verify: (rows) =>
      rows.length ? `${rows.length} order item(s) point at a missing order or product` : null },

  { file: '10_product_count.sql', params: () => [], verify: (rows) =>
      rows[0].n !== num('productCountApi') ? `DB has ${rows[0].n} products, API listed ${v.productCountApi}` : null },

  { file: '11_order_belongs_to_user.sql', params: () => [num('orderId')], verify: (rows) =>
      rows.length !== 1 ? `expected 1 row, got ${rows.length}`
      : rows[0].user_id !== num('newUserId') ? `order user_id is ${rows[0].user_id}, expected ${v.newUserId}`
      : null },

  { file: '12_injection_name_stored.sql', params: () => [INJECTION_NAME], verify: (rows) =>
      rows[0].n < 1 ? 'injection-looking name was not stored as plain data' : null },

  { file: '13_tables_intact.sql', params: () => [], verify: (rows) =>
      rows.length !== 4 ? `expected 4 tables, found ${rows.length}` : null },
];

// ---------- run ----------
(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3307),            // Docker publishes MySQL on host port 3307
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQL_ROOT_PASSWORD,
    database: `iguard_${envName}`,
    decimalNumbers: true,                                  // DECIMAL as numbers, like the API returns
  });

  let failed = 0;
  console.log(`DB verification against iguard_${envName}`);
  for (const check of checks) {
    const sql = fs.readFileSync(path.join(root, 'sql', check.file), 'utf8');
    let problem;
    try {
      const [rows] = await conn.execute(sql, check.params());
      problem = check.verify(rows);
    } catch (err) {
      problem = `query error: ${err.message}`;
    }
    if (problem) { failed++; console.log(`  FAIL ${check.file}: ${problem}`); }
    else console.log(`  PASS ${check.file}`);
  }
  await conn.end();
  console.log(failed ? `\n${failed} of ${checks.length} checks FAILED` : `\nAll ${checks.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch((err) => { console.error('db-verify crashed:', err.message); process.exit(1); });
