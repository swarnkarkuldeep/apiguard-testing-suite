-- Proves: the order total the API returned is what is stored, and it equals the sum of the
--         stored line items (qty * unit_price). So the API computed the total correctly.
-- Params: orderId
-- Expect: exactly 1 row where stored_total = items_total = orderTotalApi,
--         item_count = 1, qty and unit_price match the API response.
SELECT o.total                    AS stored_total,
       SUM(oi.qty * oi.unit_price) AS items_total,
       COUNT(oi.id)               AS item_count,
       MIN(oi.qty)                AS qty,
       MIN(oi.unit_price)         AS unit_price
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.id = ?
GROUP BY o.id, o.total;
