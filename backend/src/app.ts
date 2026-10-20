
import express from "express";
import cors from "cors";

const app = express();

// Allow requests from the frontend.
app.use(cors());

// Allow Express to read JSON request bodies.
app.use(express.json());

// A simple health-check endpoint.
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "LittleSpace API is running",
  });
});

export default app;
