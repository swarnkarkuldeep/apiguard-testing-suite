const mysql = require('mysql2/promise');

// decimalNumbers: DECIMAL columns come back as JS numbers (19.99) not strings ("19.99"),
// which keeps the JSON schema in the tests simple.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  decimalNumbers: true,
  connectionLimit: 5,
});

module.exports = pool;
