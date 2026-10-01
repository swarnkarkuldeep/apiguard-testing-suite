-- Proves: the number of products the API lists equals the number of rows in the table.
-- Params: none
-- Expect: 1 row where n = productCountApi (the length of GET /products at the end of the run).
SELECT COUNT(*) AS n
FROM products;
