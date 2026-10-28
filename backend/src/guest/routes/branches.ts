import { Router } from "express";
import { pool } from "../../config/db.js";

const router = Router();

// GET /api/branches
// Retrieve active accommodations with their review summaries.
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        hb.id,
        hb.name,
        hb.slug,
        hb.description,
        hb.address_line,
        hb.suburb,
        hb.city,
        hb.province,
        hb.country,
        hb.postal_code,
        hb.latitude,
        hb.longitude,
        hb.star_rating,

        COUNT(r.id)::integer AS review_count,

        COALESCE(
          ROUND(AVG(r.rating)::numeric, 1),
          0
        ) AS average_rating

      FROM hotel_branches AS hb

      LEFT JOIN reviews AS r
        ON r.branch_id = hb.id

      WHERE hb.is_active = TRUE

      GROUP BY hb.id

      ORDER BY hb.city ASC, hb.name ASC
    `);

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch hotel branches with ratings:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve hotel branches",
    });
  }
});

export default router;
