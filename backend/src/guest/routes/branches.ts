import { Router } from "express";
import { pool } from "../../config/db.js";

const router = Router();

// GET /api/branches
// Retrieve active accommodations with review summaries and the latest review.
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
        review_summary.review_count,
        review_summary.average_rating,
        latest_review.rating AS latest_review_rating,
        latest_review.comment AS latest_review_comment,
        latest_review.reviewer_name AS latest_review_author

      FROM hotel_branches AS hb

      LEFT JOIN LATERAL (
        SELECT
          COUNT(*)::integer AS review_count,
          COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS average_rating
        FROM reviews
        WHERE branch_id = hb.id
      ) AS review_summary ON TRUE

      LEFT JOIN LATERAL (
        SELECT
          r.rating,
          r.comment,
          u.full_name AS reviewer_name
        FROM reviews AS r
        INNER JOIN users AS u
          ON u.id = r.user_id
        WHERE r.branch_id = hb.id
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT 1
      ) AS latest_review ON TRUE

      WHERE hb.is_active = TRUE

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
