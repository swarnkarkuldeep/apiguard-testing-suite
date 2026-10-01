-- Proves: the PUT /products/:id update was persisted: name and price in the database
--         match the values the API returned.
-- Params: productId
-- Expect: exactly 1 row; name = updatedName and price = updatedPrice (from the Newman run).
SELECT id, name, price
FROM products
WHERE id = ?;
