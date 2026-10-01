# Resume evidence map

Each sentence of the resume description, the exact place in this repo that proves it, and a
command you can run in front of an interviewer.

> "Built a Postman collection with environments and chained requests covering CRUD,
> authentication, and negative scenarios."

| Claim | Evidence in the repo | Show it |
|---|---|---|
| Postman collection | `postman/iguard.collection.json`: 47 requests in 6 folders (`00 Health`, `01 Auth`, `02 Products CRUD`, `03 Orders`, `04 Negative`, `99 Final Snapshot`) | Open the file in Postman, or `npx newman run postman/iguard.collection.json -e postman/environments/local.json` |
| Environments | `postman/environments/local.json` (API :3000) and `staging.json` (API :3001). Two real stacks in `docker-compose.yml` with different databases (`iguard_local`, `iguard_staging`), seed data and JWT secrets | `curl localhost:3000/health` and `curl localhost:3001/health` return `"env":"local"` / `"env":"staging"`; the `00 Health` test asserts the API's env equals the selected Postman environment |
| Chained requests | `01 Auth` test scripts save `userToken`, `adminToken`, `newUserId` (`pm.environment.set`). `02 Products CRUD` saves `productId` and `tempProductId`; `03 Orders` uses `{{productId}}` in its body and saves `orderId`; folder-level Bearer auth uses `{{adminToken}}` / `{{userToken}}` | Run the collection; the request log shows `GET /products/<id>` using the ID returned by the earlier `POST` |
| CRUD | `02 Products CRUD`: Create, Get, List, Update (PUT), Create-temporary, Delete (204), Get-deleted (404). `03 Orders`: Create, Get, List, stock check | Same run |
| Authentication | `01 Auth` (register, login x2, JWT captured). The API signs JWTs and hashes passwords with bcrypt (`app/src/auth.js`, `app/src/routes/auth.js`). Admin vs user roles give the 403 cases | `app/src/auth.js` |
| Negative scenarios | `04 Negative`: 31 requests, each asserting exact status, exact error `code` and the error schema (token missing/invalid/expired, wrong credentials, malformed JSON, missing fields, duplicates, nonexistent IDs, SQL-injection-style input, wrong HTTP methods, non-admin access, insufficient stock, another user's order, product in use) | Table in `README.md` ("Negative scenarios"); run the collection |
| Dynamic test data | Pre-request scripts on Create product, Update product and Register (timestamps, `{{$randomProductName}}`, random price/stock) | Run the collection twice: different IDs and names each time, both pass |

> "Validated status codes and response schemas with assertions;"

| Claim | Evidence | Show it |
|---|---|---|
| Status code assertions | Every request has `pm.response.to.have.status(...)`; the negative requests also assert the error `code` | Any request's Tests tab |
| Response time and header assertions | Collection-level test script (`event` at the top of `iguard.collection.json`): response time < `maxResponseMs` (1000) and `Content-Type` matches `application/json` on every request | `npx newman run ... --env-var maxResponseMs=1` fails every time check |
| Response schema validation | Nine `tv4` schemas stored as collection variables `schema_*` (health, user, login, product, product list, order, order detail, order list, error); each request has a "response matches schema_..." test; `additionalProperties: false` catches extra or leaked fields | `--env-var 'schema_product={"type":"object","required":["nope"]}'` fails every product-schema test |
| Volume | 47 requests, **237 assertions** per environment, 0 failures | The Newman summary table |

> "wrote SQL queries to verify API data against database records."

| Claim | Evidence | Show it |
|---|---|---|
| SQL queries | `sql/01_...` to `sql/13_...`, 13 files, each commented with `Proves / Params / Expect`; `sql/README.md` explains each | `ls sql` |
| Verify API data against DB records | `scripts/db-verify.js` runs each query with IDs and API values that Newman exported, and compares rows to what the API returned (fields, deleted rows gone, no duplicates, no orphans, counts, order total = sum of items, stock decreased) | `npm run test:local` prints 13 `PASS` lines |
| The checks can really fail | Change a row by hand, rerun, the right check goes red (done in development: price, order total, stock each failed their own check) | `UPDATE products SET price = price + 1 WHERE id = <productId>;` then `npm run db:verify` fails `03_product_updated.sql` |

> "Automated runs through Newman and generated HTML execution reports."

| Claim | Evidence | Show it |
|---|---|---|
| Newman automation | `scripts/run-newman.js` and the npm scripts in `package.json` (`test:local`, `test:staging`, `test:all`, `test:data`); non-zero exit code on any failure | `npm run test:all` |
| HTML execution reports | `newman-reporter-htmlextra` writes `reports/<env>-<timestamp>.html` on every run | Open the newest file in `reports/` |
| Data-driven run | `postman/data/products.csv` (5 rows), `npm run test:data` runs 5 iterations | `npm run test:data` |
| CI | `.github/workflows/newman.yml` runs the stack, Newman for both environments and the SQL checks on every push and uploads the reports | The workflow file; its steps were rehearsed from a fresh clone (see limits below) |

## Limits to state honestly
Say these yourself before an interviewer finds them:
- The **system under test is a small API I built** so the database could be controlled. The
  point of the project is the testing, not the backend.
- **"Staging" is a second local Docker stack** with its own database, seed data and secret.
  It proves environment-driven testing; it is not a remote hosted server.
- **SQL checks run from a Node script after Newman**, not inside Postman (Postman cannot
  connect to MySQL). The queries are plain `.sql` files you can also run by hand.
- Newman was the runner used throughout. The collection was **not exercised in the Postman
  desktop app** during development, so say "built and run through Newman".
- The GitHub Actions workflow was **verified by simulating its steps from a fresh clone**;
  it has not yet run on GitHub until you push and see it go green.
- No performance, load or UI testing. Response time is a simple threshold assertion.
