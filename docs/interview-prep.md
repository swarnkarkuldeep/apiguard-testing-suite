# Interview prep: ten likely questions

Answers are based on what was actually built. Numbers: 47 requests, 237 assertions, 31
negative scenarios, 13 SQL checks, 2 environments.

---

### 1. Why did you build your own API instead of testing a public one?
Because the project claims "verify API data against database records", and that is only
honest if I control the database. Public practice APIs usually fake writes: a created record
is not really stored, so a mirror database would prove nothing. I built a small Express + MySQL
API (users, products, orders) so every created, updated or deleted record can be checked with
SQL. I kept it deliberately small, about 250 lines, because the testing is the project.

### 2. How do your chained requests work?
Test scripts save values with `pm.environment.set`, and later requests read them as
`{{variable}}`. Login saves `userToken` and `adminToken`; folder-level Bearer auth uses them.
Create product saves `productId`, and Get, Update, and the order body reuse it. The order
saves `orderId`, which the Get order request and the SQL checks reuse. Order matters, so the
folders run `Auth`, `Products`, `Orders`, `Negative`.

### 3. How did you test an expired token without waiting an hour or adding a backdoor?
A pre-request script builds a JWT by hand: header and payload with `exp` one hour in the past,
signed with HMAC-SHA256 using the environment's secret through Postman's bundled CryptoJS. The
API must answer 401 `TOKEN_EXPIRED`, which proves it accepted the signature and rejected only
the expiry. If the signature were wrong it would say `TOKEN_INVALID`, so the test distinguishes
the two. I did not want a test-only endpoint in the system under test. The secret is not in git:
`run-newman.js` passes it from `.env` or CI secrets with `--env-var`.

### 4. How do you verify API data against the database, and why not inside Postman?
Postman cannot open a MySQL connection, and a test-only "run SQL" endpoint would be a security
smell and would blur the line between tester and system under test. So Newman exports the IDs
and API values it captured, and `scripts/db-verify.js` runs 13 `.sql` files with them as
parameters and compares the rows to what the API returned: the product's name and price match,
the deleted row is gone, the order total equals the sum of its line items, stock dropped by the
ordered quantity, no duplicates, no orphan order items. The SQL files are readable and can also
be run by hand.

### 5. How do you make the tests re-runnable?
Every run generates unique data: emails like `qa_<timestamp>@example.com`, SKUs like
`QA-<timestamp>`, random price and stock, because email and SKU are UNIQUE in the database.
Deleting is tested on a temporary product, not the main one. I ran the suite twice against the
same database and both runs passed, and `npm run db:reset` returns to seed data. The tradeoff:
test data accumulates in the database (orders cannot be deleted through the API).

### 6. What do your SQL-injection tests actually prove?
Four cases. An ID like `1 OR 1=1` gets a 404 and the product count is unchanged. A login with
`' OR '1'='1` is rejected by validation (400). A login with `x'OR'1'='1@evil.com` has no spaces,
so it passes email validation and reaches the query; because the API uses parameterised queries
it is treated as plain text and returns 401. And registering with the name
`'; DROP TABLE users;--` returns 201 and the text is stored exactly as sent. Afterwards the admin
can still log in, and SQL checks 12 and 13 confirm the string is stored and all four tables
still exist. It proves parameterisation holds. It is not a full security audit.

### 7. How do your schema checks work, and why `additionalProperties: false`?
Each response is validated with `tv4` against a JSON schema stored as a collection variable
(nine of them: product, product list, order, order detail, order list, user, login, health,
error). Setting `additionalProperties: false` means an unexpected field fails the test, so if a
developer accidentally returned `password_hash` in the register response, the user schema would
catch it. Types are checked too, for example price is a number, id is an integer.

### 8. How do you know your tests can fail and are not passing vacuously?
I proved it for each layer. A wrong JWT secret fails exactly the expired-token test. Overriding
`maxResponseMs=1` fails all the response-time assertions. Overriding the product schema fails
every product-schema test. Editing a row in MySQL by hand (price, order total, stock) fails
exactly the matching SQL check and the runner exits 1. Pointing the local environment at the
staging URL fails the "environment matches" assertion.

### 9. How is it automated, and what happens in CI?
`npm run test:all` calls `run-newman.js` for each environment: it runs the collection with
Newman, writes an htmlextra report to `reports/`, and, only if Newman passed, runs the SQL
checks. The process exits non-zero if any assertion or SQL check fails, so CI goes red.
The GitHub Actions workflow runs on push: `npm ci`, `docker compose up --wait`, wait for both
APIs, `npm run test:all`, upload reports as an artifact. I rehearsed those exact steps from a
fresh clone with no `.env` before relying on it. There is also a data-driven run
(`npm run test:data`) that uses a 5-row CSV.

### 10. What did you find or fix while building it, and what would you do next?
Real examples: my first `Content-Type` assertion used Postman's `have.header(name, regex)`,
which compares as a string, so it failed on every request until I matched the header value with
a regex. The plan to delete the main product in cleanup would have failed with 409, because the
foreign key blocks deleting a product that is in an order, so I made that a deliberate negative
test and used a temporary product for the delete flow. On the API side, an order uses a
transaction with `SELECT ... FOR UPDATE`, and I tested the rollback (two lines of the same
product over stock must leave stock unchanged). Next I would add: concurrency tests for
overselling, pagination and filtering, contract tests against an OpenAPI file, a hosted staging
environment, and performance checks with a tool such as k6.

---

## Quick follow-ups you may get
- **Why 404 and not 403 for another user's order?** So the API does not confirm the order exists.
- **Why the same message for unknown email and wrong password?** So an attacker cannot tell
  which one was wrong.
- **Why a 405 rather than 404 for a wrong method?** The path exists, the method does not.
- **What would break first if the API changed?** The strict schemas, on purpose: they are
  meant to flag any contract change.
- **Is this load or performance testing?** No: only a simple response-time threshold.
