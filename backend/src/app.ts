import express, { type Request } from "express";
import cors from "cors";
import { pool } from "./config/db.js";
import branchesRouter from "./guest/routes/branches.js";
import roomTypesRouter from "./guest/routes/roomTypes.js";
import availabilityRouter from "./guest/routes/availability.js";
import bookingsRouter from "./guest/routes/bookings.js";
import paymentsRouter from "./guest/routes/payments.js";
import authRouter from "./guest/routes/auth.js";
import adminAuthRouter from "./admin/routes/auth.js";
import adminBookingsRouter from "./admin/routes/bookings.js";
import adminBranchesRouter from "./admin/routes/branches.js";
import favouritesRouter from "./guest/routes/favourites.js";
import reviewsRouter from "./guest/routes/reviews.js";
import notificationsRouter from "./guest/routes/notifications.js";

const app = express();

app.use(cors());

app.use(
  express.json({
    verify: (req: Request, _res, buffer) => {
      (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buffer);
    },
  }),
);

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

// Guest routes
app.use("/api/auth", authRouter);
app.use("/api/branches", branchesRouter);
app.use("/api/room-types", roomTypesRouter);
app.use("/api/availability", availabilityRouter);
app.use("/api/bookings", bookingsRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/favourites", favouritesRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/notifications", notificationsRouter);

// Admin routes
app.use("/api/admin/auth", adminAuthRouter);
app.use("/api/admin/branches", adminBranchesRouter);
app.use("/api/admin/bookings", adminBookingsRouter);


export default app;
