-- Proves: after all the SQL-injection tests, none of the four tables was dropped.
-- Params: none
-- Expect: 4 rows (users, products, orders, order_items).
SELECT table_name
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('users', 'products', 'orders', 'order_items');
