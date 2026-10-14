require("dotenv").config();

const { Pool, types } = require("pg");

// Return DATE columns as plain "YYYY-MM-DD" strings. Parsing them into JS Dates places
// them at local midnight, and JSON serialization then shifts them to the previous day in UTC.
const PG_DATE_OID = 1082;
types.setTypeParser(PG_DATE_OID, (value) => value);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

module.exports = pool;
