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

const runSeeders = async () => {
  const client = await pool.connect();

  try {
    const seedsDir = path.join(__dirname, "../seeds");

    const files = fs
      .readdirSync(seedsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    if (files.length === 0) {
      console.log("No seed files found.");
      return;
    }

    await client.query("BEGIN");

    for (const file of files) {
      const filePath = path.join(seedsDir, file);
      const sql = fs.readFileSync(filePath, "utf8");

      console.log(`Running seed: ${file}`);
      await client.query(sql);
    }

    await client.query("COMMIT");
    console.log("All seeders completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
};

runSeeders();
