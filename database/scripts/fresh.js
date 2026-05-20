const path = require("path");
const { Pool } = require("pg");

require("dotenv").config({ path: path.join(__dirname, "../../backend/.env") });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function freshDatabase() {
  const client = await pool.connect();

  try {
    console.log("Dropping schema...");

    await client.query(`
      DROP SCHEMA public CASCADE;
      CREATE SCHEMA public;
      CREATE EXTENSION IF NOT EXISTS pgcrypto;
    `);

    console.log("Database fresh completed successfully.");
  } catch (error) {
    console.error("Fresh failed:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

freshDatabase();