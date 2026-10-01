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

## How to run
Added in Phase 8 (`npm run test:local`, `npm run test:staging`).

## Reports
Added in Phase 8 (HTML reports in `reports/`).

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
