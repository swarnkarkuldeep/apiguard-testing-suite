-- Proves: the product created through POST /products is stored, with the SKU we sent.
--         It runs at the END of the run, so it also proves the product survived the
--         rejected DELETE (409 PRODUCT_IN_USE) in the negative tests.
-- Params: productId
-- Expect: exactly 1 row whose sku equals the API's sku and whose created_at is set.
SELECT id, sku, created_at
FROM products
WHERE id = ?;
