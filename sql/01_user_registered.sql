-- Proves: the user created through POST /auth/register really exists in the database,
--         with the email we sent, role 'user', and a hashed (not plaintext) password.
-- Params: newUserId
-- Expect: exactly 1 row. db-verify checks email, role = 'user',
--         password_hash starts with the bcrypt prefix '$2' and differs from the plaintext password.
SELECT id, email, role, password_hash
FROM users
WHERE id = ?;
