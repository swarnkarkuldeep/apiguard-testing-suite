-- Proves: DELETE /products/:id really removed the row (not just hidden it).
-- Params: tempProductId
-- Expect: 0 rows.
SELECT id
FROM products
WHERE id = ?;
