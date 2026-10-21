
import express from "express";
import cors from "cors";
import { pool } from "./config/db.js";

const app = express();

app.use(cors());
app.use(express.json());

// API health check: verifies that Express is running.
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "LittleSpace API is running",
  });
});

// Database health check: verifies an actual PostgreSQL query.
app.get("/api/db-health", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT current_database() AS database, NOW() AS server_time"
    );

    res.status(200).json({
      success: true,
      message: "PostgreSQL connection successful",
      database: result.rows[0].database,
      serverTime: result.rows[0].server_time,
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(503).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

export default app;
