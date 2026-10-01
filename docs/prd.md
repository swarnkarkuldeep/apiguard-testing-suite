# IGuard - Product Requirements Document (PRD)

## 1. Overview
IGuard is a QA automation project. It tests a small REST API and checks that
what the API returns matches what is actually stored in a MySQL database.

It has two parts:
- **System under test (SUT):** a deliberately small Node.js/Express + MySQL
  store API (users, products, orders). It exists so the tests have something real to test.
- **The QA deliverable (the real product):** a Postman collection, Newman
  automation, SQL verification queries, and HTML reports.

## 2. Goals
1. Show practical API testing: CRUD, authentication, negative scenarios.
2. Show API-to-database verification with SQL (not just "the API says so").
3. Show automation: one command runs everything and produces a report.
4. Back every sentence of the resume description with evidence in the repo.

## 3. Non-goals
- A production-grade backend (no pagination, rate limiting, email, etc.).
- Performance or load testing (only a basic response-time assertion).
- UI testing.

## 4. Target audience
- **Primary:** recruiters and interviewers reading the repo (QA / SDET roles).
- **Secondary:** the author, who must be able to explain every part.

## 5. Functional requirements

### 5.1 System under test
| ID | Requirement |
|----|-------------|
| SUT-1 | Register and login users; passwords hashed; JWT with 1h expiry returned on login |
| SUT-2 | Roles: `user` and `admin`. Seed data contains one admin per environment |
| SUT-3 | Products: public read; create/update/delete require admin |
| SUT-4 | Orders: authenticated users create and read only their own orders |
| SUT-5 | Order total is computed by the API; product stock decreases on order |
| SUT-6 | Consistent error format `{ "error": { "code", "message" } }` |
| SUT-7 | Runs in two real environments: local (:3000) and staging (:3001) via Docker Compose |

### 5.2 Test suite
| ID | Requirement |
|----|-------------|
| TS-1 | Postman collection, foldered by feature, with collection variables and local/staging environments |
| TS-2 | Chained requests: token and IDs captured by test scripts and reused |
| TS-3 | Full CRUD coverage with pre-request scripts and dynamic test data |
| TS-4 | Assertions on every request: status, response time, headers, JSON schema |
| TS-5 | Negative scenarios: bad/missing/expired token, wrong credentials, malformed payload, missing fields, duplicates, nonexistent IDs, SQL-injection-style input, wrong HTTP methods, non-admin access, insufficient stock |
| TS-6 | SQL verification queries in `/sql`, run by `scripts/db-verify.js` using IDs exported by Newman |
| TS-7 | Newman runs per environment with htmlextra HTML reports in `/reports`; one data-driven run |
| TS-8 | GitHub Actions workflow runs the full pipeline on push |

## 6. Non-functional requirements
- **Reproducible:** `docker compose up` plus `npm run` commands, nothing manual.
- **Readable:** small files, comments that explain *why*.
- **No secrets in git:** only placeholders committed; real values via `.env` or CI secrets.
- **Re-runnable:** tests use unique generated data so repeated runs do not collide.

## 7. Success criteria
- `npm run test:local` and `npm run test:staging` both pass and produce an HTML report.
- `npm run db:verify` passes after each run (every SQL check reports PASS).
- A deliberately broken API response or database row makes the suite FAIL (we will prove the tests can fail).
- A README lets a stranger run the project in under 10 minutes.
- Every resume bullet maps to a specific file or command (Phase 10).

## 8. Resume claim traceability (summary)
| Resume claim | Evidence (delivered in phase) |
|---|---|
| Postman collection with environments, chained requests | `postman/` (2-4) |
| CRUD, authentication, negative scenarios | collection folders (3, 4, 6) |
| Status code and schema assertions | test scripts on every request (5) |
| SQL queries verifying API data against DB | `sql/` + `scripts/db-verify.js` (7) |
| Newman automation, HTML reports | npm scripts, `reports/`, CI (8, 9) |

## 9. Risks
| Risk | Mitigation |
|---|---|
| Backend grows and steals focus | Hard cap: 3 resources, ~250 lines total |
| Flaky tests from shared data | Unique generated data; seeds reset via compose |
| Docker/MySQL start-up timing | Compose healthcheck before the API starts |
| Secrets leak into git | `.gitignore`, `.env.example`, placeholder environment values |
