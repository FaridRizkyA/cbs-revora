const { Pool } = require('pg');
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD ? String(process.env.DB_PASSWORD) : '',
  port: process.env.DB_PORT,
});
(async () => {
  try {
    await pool.query("UPDATE tbl_external_financial_entries SET entry_source = REPLACE(entry_source, 'USAHA:', '')");
    await pool.query("UPDATE tbl_external_financial_entries SET entry_source = REPLACE(entry_source, 'BELANJA:', '')");
    console.log('Update successful');
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
})();
