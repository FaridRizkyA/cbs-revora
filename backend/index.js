require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("./config/db");
const cashierRoutes = require("./routes/cashierRoutes");
const authRoutes = require("./routes/authRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const shuRoutes = require("./routes/shuRoutes");
const externalFinancialRoutes = require("./routes/externalFinancialRoutes");
const peopleRoutes = require("./routes/peopleRoutes");
const reportRoutes = require("./routes/reportRoutes");
const activityLogRoutes = require("./routes/activityLogRoutes");
const memberPortalRoutes = require("./routes/memberPortalRoutes");
const { startReceiptEmailWorker } = require("./modules/emailQueue/receiptEmailQueue");

const app = express();

app.use(cors());
app.use(express.json({ limit: "15mb" }));
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

app.use("/api", cashierRoutes);
app.use("/api", authRoutes);
app.use("/api", dashboardRoutes);
app.use("/api", shuRoutes);
app.use("/api", externalFinancialRoutes);
app.use("/api", peopleRoutes);
app.use("/api", reportRoutes);
app.use("/api", activityLogRoutes);
app.use("/api", memberPortalRoutes);

startReceiptEmailWorker();

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
