-- Proves: the order was stored against the user who placed it (the token's user),
--         which is what makes "another user's order is hidden" meaningful.
-- Params: orderId
-- Expect: exactly 1 row where user_id = newUserId.
SELECT id, user_id
FROM orders
WHERE id = ?;
