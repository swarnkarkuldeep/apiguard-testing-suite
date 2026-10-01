# IGuard - API & Data Validation Suite

API test automation with Postman and Newman, plus SQL checks that verify API
responses against MySQL records. (Full README is completed in Phase 9.)

## Overview
A small Express + MySQL store API (users, products, orders) is the system under
test. A Postman collection exercises it; SQL queries confirm the database agrees
with what the API said. See `docs/prd.md` and `docs/design.md`.

## Architecture
Postman/Newman -> Express API -> MySQL, with `scripts/db-verify.js` running the
`sql/` checks against MySQL. (Diagram added in Phase 9.)

## Prerequisites
Docker Desktop, Node.js 20+.

## Setup
```bash
cp .env.example .env          # then edit the placeholder secrets if you like
docker compose up -d --build  # MySQL + local API (:3000) + staging API (:3001)
curl localhost:3000/health    # {"status":"ok","env":"local"}
curl localhost:3001/health    # {"status":"ok","env":"staging"}
```
Reset the databases to their seed data: `docker compose down -v && docker compose up -d --build`.

Seeded test accounts (dev only) are listed in `.env.example`. MySQL is exposed on
host port 3307.

## Postman collection and environments
- Collection: `postman/iguard.collection.json`, folders `00 Health` to `99 Final Snapshot`.
- Environments: `postman/environments/local.json` (API on :3000) and
  `staging.json` (API on :3001). Import all three into Postman and pick an environment.
- `jwtSecret` is a placeholder (`SET_ME_LOCALLY`) in git. Set the real value from
  your `.env` (`JWT_SECRET_LOCAL` / `JWT_SECRET_STAGING`) in Postman, or pass it to
  Newman with `--env-var "jwtSecret=..."`. It is only needed for the expired-token test (Phase 6).
- The seeded test passwords are dev-only and listed in `.env.example`.

Quick run (after `npm install`):
```bash
npx newman run postman/iguard.collection.json -e postman/environments/local.json
npx newman run postman/iguard.collection.json -e postman/environments/staging.json
```

## Assertions and schemas
- **Every request** is checked for status code, response time (`maxResponseMs`,
  default 1000 ms) and `Content-Type: application/json` (the last two live in one
  collection-level test script), plus a JSON schema check with `tv4`.
- **Schemas** are collection variables named `schema_*` (product, order, user, login,
  error, ...). They use `additionalProperties: false`, so an unexpected field such as
  a leaked `password_hash` fails the test.
- **Prove a check can fail** by overriding a value on the command line:
  `--env-var maxResponseMs=1` or `--env-var 'schema_product={"type":"object","required":["nope"]}'`.

## Negative scenarios (`04 Negative`)
31 requests, each asserting the exact 4xx status, the exact error `code` and the error
schema: missing, garbage and expired tokens; wrong credentials; malformed JSON; missing
or invalid fields; duplicate email and SKU; nonexistent IDs; SQL-injection-style input;
wrong HTTP methods; non-admin access; insufficient stock; another user's order; deleting
a product that is in an order. Some also check side effects (row count unchanged, users
table intact, stock unchanged after a rolled-back order).

The expired-token test signs its own JWT, so it needs the real secret:
```bash
npx newman run postman/iguard.collection.json -e postman/environments/local.json \
  --env-var "jwtSecret=<JWT_SECRET_LOCAL from .env>"
```
(`npm run test:local` will do this for you in Phase 8.) Without it only that one test fails.

## SQL validation
13 queries in `sql/` verify API-created, updated and deleted data against MySQL (row
exists, fields match, deleted rows are gone, no duplicates, counts and totals match).
Newman exports the IDs and API values it captured; `scripts/db-verify.js` runs each
query with them and prints PASS/FAIL. See `sql/README.md` for what each query proves.
```bash
node scripts/db-verify.js --env local --export reports/local-env.json
```

## How to run
```bash
npm install                 # once: Newman, htmlextra reporter, mysql2
npm run db:up               # start MySQL + both APIs (once)
npm run test:local          # Newman against local, HTML report, then SQL checks
npm run test:staging        # same against staging
npm run test:all            # local then staging
npm run test:data           # data-driven: one iteration per row of postman/data/products.csv
npm run db:reset            # wipe the databases back to seed data
```
Each `test:*` command reads the JWT secret from `.env`, runs the collection, writes the
report, and exits non-zero if any assertion or SQL check fails (so CI goes red).
`test:data` runs only the Auth and Products CRUD folders (the CSV drives product name,
price and stock) and skips the SQL step.

## Reports
HTML reports (newman-reporter-htmlextra) are written to `reports/<env>-<timestamp>.html`;
open one in a browser. `reports/<env>-env.json` holds the variables Newman captured and
feeds the SQL checks. Both are git-ignored. Screenshot placeholder:
`docs/screenshots/report-summary.png` (added in Phase 9).

## Test case summary
Added in Phase 9.

## Project structure
```
docs/       PRD, design, plan
app/        the system under test (Express API)
db/         schema and seed data for both environments
postman/    collection and environments (Phase 2+)
sql/        verification queries (Phase 7)
scripts/    db-verify runner (Phase 7)
reports/    generated HTML reports
```
