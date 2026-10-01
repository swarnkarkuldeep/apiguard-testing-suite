-- Proves: no SKU appears twice in products (the duplicate-SKU test did not create a second row).
-- Params: none
-- Expect: 0 rows.
SELECT sku, COUNT(*) AS n
FROM products
GROUP BY sku
HAVING n > 1;
