const fs = require("fs");
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

const runMigrations = async () => {
  const client = await pool.connect();

  try {
    const migrationsDir = path.join(__dirname, "../migrations");

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf8");

      console.log(`Running migration: ${file}`);
      await client.query(sql);
    }

    console.log("All migrations completed successfully.");
  } catch (error) {
    console.error("Migration failed:", error.message);
  } finally {
    client.release();
    await pool.end();
  }
};

runMigrations();