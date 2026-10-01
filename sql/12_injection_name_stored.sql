-- Proves: SQL-injection-looking text was stored as plain data, exactly as sent.
-- Params: the literal string  '; DROP TABLE users;--
-- Expect: 1 row with n >= 1.
SELECT COUNT(*) AS n
FROM users
WHERE name = ?;
