import { Router } from "express";
import { pool } from "../config/db.js";

const router = Router();

// GET /api/room-types/branch/:branchId
router.get("/branch/:branchId", async (req, res) => {
  const branchId = Number(req.params.branchId);

  if (!Number.isSafeInteger(branchId) || branchId <= 0) {
    res.status(400).json({
      success: false,
      message: "A valid branch ID is required",
    });
    return;
  }

  try {
    const result = await pool.query(
      `
        SELECT
          rt.id,
          rt.branch_id,
          rt.name,
          rt.description,
          rt.capacity_adults,
          rt.capacity_children,
          rt.base_price,
          rt.currency,
          rt.facilities,
          rt.policies
        FROM room_types AS rt
        INNER JOIN hotel_branches AS hb
          ON hb.id = rt.branch_id
        WHERE rt.branch_id = $1
          AND rt.is_active = TRUE
          AND hb.is_active = TRUE
        ORDER BY rt.base_price ASC, rt.name ASC
      `,
      [branchId],
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Failed to fetch room types:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve room types",
    });
  }
});

export default router;
