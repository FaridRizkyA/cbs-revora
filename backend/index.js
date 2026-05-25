require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./config/db");
const cashierRoutes = require("./routes/cashierRoutes");
const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "Backend connected",
      db_time: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.use("/api", cashierRoutes);
app.use("/api", authRoutes);
app.use("/api", dashboardRoutes);

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
