require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("./config/db");
const { authenticateToken } = require("./middleware/authMiddleware");

// Route imports
const authRoutes = require("./routes/authRoutes");
const cashierRoutes = require("./routes/cashierRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const shuRoutes = require("./routes/shuRoutes");
const externalFinancialRoutes = require("./routes/externalFinancialRoutes");
const peopleRoutes = require("./routes/peopleRoutes");
const reportRoutes = require("./routes/reportRoutes");
const activityLogRoutes = require("./routes/activityLogRoutes");
const memberPortalRoutes = require("./routes/memberPortalRoutes");
const { startEmailWorker } = require("./modules/emailQueue/emailQueue");

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));

// Workaround for React Native Android fetch bug where large JSON bodies are padded with garbage bytes
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    try {
      const str = err.body;
      const lastIndex = Math.max(str.lastIndexOf('}'), str.lastIndexOf(']'));
      if (lastIndex !== -1) {
        const cleaned = str.substring(0, lastIndex + 1);
        req.body = JSON.parse(cleaned);
        return next(); // Recovered successfully
      }
    } catch (recoverErr) {
      // Fall through if recovery fails
    }
  }
  next(err);
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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

// 1. Public Routes (No authentication required)
app.use("/api", authRoutes);

// 2. Protected Routes Middleware (All routes below require a valid token)
app.use(authenticateToken);

// 3. Operational Routes
app.use("/api", cashierRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", shuRoutes);
app.use("/api", externalFinancialRoutes);
app.use("/api", peopleRoutes);
app.use("/api", reportRoutes);
app.use("/api", activityLogRoutes);
app.use("/api", memberPortalRoutes);

startEmailWorker();

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
