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

async function clearQueue() {
  const client = await pool.connect();
  try {
    const res = await client.query("DELETE FROM tbl_email_logs");
    console.log(`Successfully cleared ${res.rowCount} email jobs from the queue.`);
  } catch (error) {
    console.error("Failed to clear queue:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

clearQueue();
