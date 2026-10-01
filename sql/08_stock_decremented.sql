-- Proves: placing the order reduced the product's stock by the ordered quantity, and the
--         later rejected orders (over stock, rolled back) did not change it.
-- Params: productId
-- Expect: exactly 1 row where stock = updatedStock - orderQtyApi.
SELECT id, stock
FROM products
WHERE id = ?;
