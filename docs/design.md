# IGuard - Design Document (Phase 0)

Status: draft for review. See `prd.md` for the requirements this satisfies.

## 1. Decisions (and why)
| # | Decision | Why |
|---|----------|-----|
| 1 | Build our own Node/Express + MySQL API | Real DB we control, so "API vs database" verification is genuine. Public practice APIs fake writes. |
| 2 | Resources: Users, Products, Orders | Orders add foreign keys, computed totals and stock changes, which give richer SQL checks than single tables. |
| 3 | SQL checks: `.sql` files + Node runner (`db-verify.js`) | Postman cannot reach MySQL. Files stay readable and can be run by hand; the runner makes it automatic in CI. No test-only DB endpoint (security smell). |
| 4 | Two real environments: local (:3000) and staging (:3001) | Different URL, DB, seed data and JWT secret, so "environments" is honest evidence. |
| 5 | Expired token forged in a Postman pre-request script | No test backdoor in the API; proves the API rejects a correctly-signed but expired token. |
| 6 | Admin role | Adds a real 403 negative case. |

## 2. Architecture
```
Postman collection --HTTP--> Express API --SQL--> MySQL
        |                       (SUT)                ^
   Newman (+htmlextra)                               |
        | --export-environment (captured IDs)        |
        +--> scripts/db-verify.js --- sql/*.sql -----+
```
Docker Compose runs: `mysql` (one server, two databases: `iguard_local`,
`iguard_staging`), `api-local` (:3000), `api-staging` (:3001).
Compose healthcheck makes the APIs wait for MySQL.

## 3. Folder structure
```
docs/            prd.md, design.md
app/             the SUT: src/{server,db,auth}.js, src/routes/{auth,products,orders}.js, Dockerfile
db/              schema.sql, seed-local.sql, seed-staging.sql
postman/         iguard.collection.json, environments/{local,staging}.json, data/products.csv
sql/             one commented .sql file per verification check
scripts/         db-verify.js
reports/         generated HTML (gitignored, .gitkeep kept)
.github/workflows/newman.yml
docker-compose.yml, .env.example, .gitignore, package.json, README.md
```

## 4. Data model
```
users(id PK, name, email UNIQUE, password_hash, role ENUM('user','admin'), created_at)
products(id PK, name, sku UNIQUE, price DECIMAL(10,2), stock INT >= 0, created_at, updated_at)
orders(id PK, user_id FK->users, total DECIMAL(10,2), created_at)
order_items(id PK, order_id FK->orders ON DELETE CASCADE, product_id FK->products, qty INT > 0, unit_price DECIMAL(10,2))
```
Deleting a product that appears in an order is blocked by the FK, and the API
returns 409. Seed data per environment: 1 admin, 1 normal user, 5 to 8 products
(staging has different products and counts). Seeded passwords are dev-only and documented in `.env.example`.

## 5. API contract
| Method + path | Auth | Success | Notable errors |
|---|---|---|---|
| POST /auth/register | none | 201 `{id,name,email,role}` | 400 invalid, 409 email exists |
| POST /auth/login | none | 200 `{token}` | 400 missing field, 401 wrong credentials |
| GET /products | none | 200 array | |
| GET /products/:id | none | 200 | 404 |
| POST /products | admin | 201 | 400, 401, 403, 409 duplicate sku |
| PUT /products/:id | admin | 200 | 400, 401, 403, 404 |
| DELETE /products/:id | admin | 204 | 401, 403, 404, 409 in use |
| POST /orders | user | 201 `{id,total,items}` | 400, 401, 404 product, 409 insufficient stock |
| GET /orders/:id | user (owner) | 200 | 401, 404 (also for other users' orders) |
| GET /orders | user | 200 own orders | 401 |

Registration always creates role `user`; admins exist only via seed data.
Unsupported methods on known paths return 405. All errors use
`{ "error": { "code": "STRING", "message": "text" } }`. All SQL is parameterised,
so injection-style input returns 400/404, never 500, and the tables stay intact.

## 6. Test design
- **Collection folders:** `00 Health`, `01 Auth`, `02 Products CRUD`, `03 Orders`, `04 Negative`, `99 Cleanup`.
- **Variables:** `baseUrl`, `adminEmail`, `adminPassword`, `jwtSecret` (environment; placeholders committed). Captured at runtime: `userToken`, `adminToken`, `productId`, `orderId`, etc.
- **Test data:** pre-request scripts use `{{$timestamp}}` / `{{$randomInt}}` for unique emails and SKUs.
- **Every request asserts:** status code, response time (< 1000 ms), `Content-Type`, JSON schema (tv4).
- **Negative suite** (Phase 6): invalid, missing and expired token; wrong credentials; malformed JSON; missing required fields; duplicate email and SKU; nonexistent IDs; SQL-injection strings; wrong HTTP methods; non-admin on admin routes; insufficient stock. Each asserts the exact 4xx code and error `code`.
- **Proving tests can fail:** in Phase 5/7 we deliberately break a response or DB row once and show the suite goes red.

## 7. SQL verification (Phase 7)
Newman exports the IDs it captured. `db-verify.js` reads them, runs each file in
`sql/` with parameters, and compares the rows to the API values Newman saved. Planned checks:

| File | Proves |
|---|---|
| product_created.sql | row exists; name, sku, price, stock match the API response |
| product_updated.sql | updated fields in DB match the PUT payload |
| product_deleted.sql | row is gone after DELETE (0 rows) |
| no_duplicate_emails.sql / no_duplicate_skus.sql | uniqueness holds |
| user_registered.sql | user row exists, password is hashed (not plaintext), role is `user` |
| order_total_matches.sql | `orders.total` equals SUM(qty * unit_price) of its items |
| stock_decremented.sql | stock dropped by the ordered quantity |
| no_orphan_order_items.sql | every item has a valid order and product |
| product_count.sql | `COUNT(*)` equals the length of the `GET /products` list |

## 8. Automation (Phases 8-9)
npm scripts: `db:up`, `test:local`, `test:staging`, `test:data` (CSV iterations),
`db:verify`, `test:all`. Newman uses `-r cli,htmlextra` with reports written to
`reports/<env>-<timestamp>.html`. GitHub Actions: checkout, `docker compose up -d`,
wait for health, Newman on both environments, `db:verify`, upload reports as artifacts.

## 9. Phase plan
0 design (this) · 1 environment + DB · 2 collection foundations · 3 auth + chaining ·
4 CRUD · 5 assertions + schemas · 6 negatives · 7 SQL validation · 8 Newman + reports ·
9 GitHub polish · 10 resume + interview prep. Each phase ends with a summary,
verification steps, a git commit, and a wait for "go ahead".

## 10. Open items (defaults chosen, tell me if you disagree)
- Node 20 LTS in the Docker image (your machine runs Node 24; either works for the API).
- `mysql2` and `bcryptjs` (pure JS, no native build problems on Windows) and `jsonwebtoken`.
- Response-time threshold of 1000 ms for local and staging.
