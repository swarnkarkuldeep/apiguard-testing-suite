-- Proves: no email appears twice in users (the duplicate-registration tests did not
--         sneak a second row in).
-- Params: none
-- Expect: 0 rows.
SELECT email, COUNT(*) AS n
FROM users
GROUP BY email
HAVING n > 1;
