import { Router } from "express";
import { pool } from "../../config/db.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router = Router();

// GET /api/admin/guests
// List registered guest accounts without exposing credentials.
router.get("/", authenticateAdmin, async (req, res) => {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const result = await pool.query(
      `
        SELECT
          id,
          full_name,
          email,
          phone,
          is_active,
          created_at,
          updated_at
        FROM users
        WHERE role = 'guest'
          AND (
            $1 = ''
            OR full_name ILIKE '%' || $1 || '%'
            OR email ILIKE '%' || $1 || '%'
          )
        ORDER BY created_at DESC, id DESC
        LIMIT 100
      `,
      [search],
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Failed to retrieve admin guest accounts:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve guest accounts.",
    });
  }
});

export default router;
