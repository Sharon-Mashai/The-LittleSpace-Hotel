import { Router } from "express";
import { pool } from "../../config/db.js";

const router = Router();

// GET /api/accommodations/:branchId/photos
// Retrieve the photo gallery for an active accommodation.
router.get("/:branchId/photos", async (req, res) => {
  const branchId = String(req.params.branchId);

  if (!/^[1-9]\d*$/.test(branchId)) {
    res.status(400).json({
      success: false,
      message: "A valid accommodation ID is required.",
    });
    return;
  }

  try {
    const branchResult = await pool.query(
      `
        SELECT id, name, slug
        FROM hotel_branches
        WHERE id = $1
          AND is_active = TRUE
      `,
      [branchId],
    );

    if (branchResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Active accommodation not found.",
      });
      return;
    }

    const photosResult = await pool.query(
      `
        SELECT
          id,
          branch_id,
          photo_url,
          caption,
          is_primary,
          display_order,
          created_at
        FROM accommodation_photos
        WHERE branch_id = $1
        ORDER BY is_primary DESC, display_order ASC, id ASC
      `,
      [branchId],
    );

    res.status(200).json({
      success: true,
      accommodation: branchResult.rows[0],
      count: photosResult.rows.length,
      data: photosResult.rows,
    });
  } catch (error) {
    console.error("Failed to retrieve accommodation photos:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve accommodation photos.",
    });
  }
});

export default router;
