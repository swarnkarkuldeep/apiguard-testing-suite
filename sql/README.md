# SQL verification queries

Each file here checks one thing: **does the database agree with what the API said?**
Every file starts with a comment block (`Proves`, `Params`, `Expect`). `?` marks are
filled in by `scripts/db-verify.js` with IDs and API values that Newman exported.

| File | What it proves | Compared with (from the Newman run) |
|---|---|---|
| `01_user_registered.sql` | Registered user exists; email and role match; password is a bcrypt hash, not plaintext | `newUserId`, `newUserEmail`, `newUserPassword` |
| `02_product_exists.sql` | Created product is stored with the right SKU (and survived the rejected 409 delete) | `productId`, `productSku` |
| `03_product_updated.sql` | The PUT update was persisted: name and price match | `updatedName`, `updatedPrice` |
| `04_product_deleted.sql` | DELETE really removed the row (0 rows) | `tempProductId` |
| `05_no_duplicate_emails.sql` | No email appears twice in `users` | none |
| `06_no_duplicate_skus.sql` | No SKU appears twice in `products` | none |
| `07_order_total_matches.sql` | Stored total = sum of stored line items = total the API returned; qty and unit price match | `orderId`, `orderTotalApi`, `orderQtyApi`, `orderUnitPriceApi` |
| `08_stock_decremented.sql` | Stock dropped by exactly the ordered qty; rejected orders changed nothing | `updatedStock`, `orderQtyApi` |
| `09_no_orphan_order_items.sql` | Every order item has a real order and a real product | none |
| `10_product_count.sql` | `COUNT(*)` of products equals the length of the `GET /products` list | `productCountApi` |
| `11_order_belongs_to_user.sql` | Order is stored against the user whose token placed it | `orderId`, `newUserId` |
| `12_injection_name_stored.sql` | A `'; DROP TABLE users;--` name was stored as plain text | literal string |
| `13_tables_intact.sql` | All four tables still exist after the injection tests | none |

Note: checks 05 and 06 are also guaranteed by `UNIQUE` constraints in `db/schema.sql`.
They are kept because they prove the data state after the whole run, and they would
catch someone removing a constraint.

## How they run
**Automatically (normal way):**
```bash
npx newman run postman/iguard.collection.json -e postman/environments/local.json \
  --env-var "jwtSecret=<JWT_SECRET_LOCAL>" --export-environment reports/local-env.json
node scripts/db-verify.js --env local --export reports/local-env.json
```
Output is `PASS` or `FAIL <file>: <reason>` per check; exit code 1 if any fail.
`npm run test:local` (Phase 8) chains both steps.

**Manually (to explore):** run any file by hand, replacing the `?`:
```bash
docker compose exec mysql sh -c 'mysql -uroot -p$MYSQL_ROOT_PASSWORD iguard_local' < sql/05_no_duplicate_emails.sql
```

## Proving the checks can fail
Change a row by hand, rerun `db-verify`, and the matching check goes red, for example:
`UPDATE products SET price = price + 1 WHERE id = <productId>;` fails `03_product_updated.sql`.
