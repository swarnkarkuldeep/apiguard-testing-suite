const express = require('express');
const { fail } = require('./errors');

const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok', env: process.env.APP_ENV }));
app.use('/auth', require('./routes/auth'));
app.use('/products', require('./routes/products'));
app.use('/orders', require('./routes/orders'));

// Unknown path -> 404 in our error format.
app.use((req, res) => fail(res, 404, 'NOT_FOUND', `${req.method} ${req.path} does not exist`));

// Error handler: malformed JSON is the client's fault (400); anything else is a real 500.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return fail(res, 400, 'INVALID_JSON', 'request body is not valid JSON');
  console.error(err);
  return fail(res, 500, 'INTERNAL_ERROR', 'something went wrong');
});

app.listen(3000, () => console.log(`IGuard API (${process.env.APP_ENV}) listening on 3000`));
