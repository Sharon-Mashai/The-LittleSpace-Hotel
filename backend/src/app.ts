import express from "express";
import cors from "cors";
import { pool } from "./config/db.js";
import branchesRouter from "./routes/branches.js";
import roomTypesRouter from "./routes/roomTypes.js";
import availabilityRouter from "./routes/availability.js";
import bookingsRouter from "./routes/bookings.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "LittleSpace API is running",
  });
});

app.get("/api/db-health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS database_time");

    res.status(200).json({
      success: true,
      message: "Database connection successful",
      databaseTime: result.rows[0].database_time,
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }
});

app.use("/api/branches", branchesRouter);
app.use("/api/room-types", roomTypesRouter);
app.use("/api/availability", availabilityRouter);
app.use("/api/bookings", bookingsRouter);

export default app;
