import { Router } from "express";
import { pool } from "../../config/db.js";

const router = Router();

// GET /api/accommodations/photos/:photoId/image
// Retrieve and display a stored branch image.
router.get("/photos/:photoId/image", async (req, res) => {
  const photoId = String(req.params.photoId);

  if (!/^[1-9]\d*$/.test(photoId)) {
    res.status(400).json({
      success: false,
      message: "A valid photo ID is required.",
    });
    return;
  }

  try {
    const result = await pool.query(
      `
        SELECT
          ap.image_data,
          ap.mime_type,
          ap.file_size
        FROM accommodation_photos ap
        INNER JOIN hotel_branches hb
          ON hb.id = ap.branch_id
        WHERE ap.id = $1
          AND hb.is_active = TRUE
        LIMIT 1
      `,
      [photoId],
    );

    if (result.rows.length === 0 || !result.rows[0].image_data) {
      res.status(404).json({
        success: false,
        message: "Branch image not found.",
      });
      return;
    }

    const image = result.rows[0];

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedMimeTypes.includes(image.mime_type)) {
      res.status(415).json({
        success: false,
        message: "Unsupported image format.",
      });
      return;
    }

    res.setHeader("Content-Type", image.mime_type);
    res.setHeader("Content-Length", image.file_size);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "public, max-age=3600");

    res.status(200).send(image.image_data);
  } catch (error) {
    console.error("Failed to retrieve branch image:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve branch image.",
    });
  }
});

// GET /api/accommodations/:branchId/photos
// Retrieve all photos belonging to an active accommodation.
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
        WHERE id = $1 AND is_active = TRUE
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
