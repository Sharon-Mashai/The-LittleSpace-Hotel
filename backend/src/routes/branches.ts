import { Router } from "express";
import { pool } from "../config/db.js";

const router = Router();

// GET /api/branches

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        slug,
        description,
        address_line,
        suburb,
        city,
        province,
        country,
        postal_code,
        latitude,
        longitude,
        star_rating
      FROM hotel_branches
      WHERE is_active = TRUE
      ORDER BY city ASC, name ASC
    `);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch hotel branches:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve hotel branches",
    });
  }
});

export default router;
