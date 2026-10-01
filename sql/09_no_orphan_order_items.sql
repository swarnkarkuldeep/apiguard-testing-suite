-- Proves: every order item points at an existing order AND an existing product.
-- Params: none
-- Expect: 0 rows.
SELECT oi.id
FROM order_items oi
LEFT JOIN orders   o ON o.id = oi.order_id
LEFT JOIN products p ON p.id = oi.product_id
WHERE o.id IS NULL OR p.id IS NULL;
