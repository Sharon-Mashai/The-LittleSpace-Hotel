import { Router } from "express";
import { pool } from "../../config/db.js";

const router = Router();

// GET /api/room-types/photos/:photoId/image
// Retrieve a room-type image stored in PostgreSQL.
router.get("/photos/:photoId/image", async (req, res) => {
  const photoId = Number(req.params.photoId);

  if (!Number.isSafeInteger(photoId) || photoId <= 0) {
    res.status(400).json({
      success: false,
      message: "A valid room-type photo ID is required.",
    });
    return;
  }

  try {
    const result = await pool.query(
      `
        SELECT
          rtp.image_data,
          rtp.mime_type,
          rtp.file_size
        FROM room_type_photos AS rtp
        INNER JOIN room_types AS rt
          ON rt.id = rtp.room_type_id
        INNER JOIN hotel_branches AS hb
          ON hb.id = rt.branch_id
        WHERE rtp.id = $1
          AND rt.is_active = TRUE
          AND hb.is_active = TRUE
      `,
      [photoId],
    );

    if (result.rows.length === 0 || !result.rows[0].image_data) {
      res.status(404).json({
        success: false,
        message: "Room-type image not found.",
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
    console.error("Failed to retrieve room-type image:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve room-type image.",
    });
  }
});

// GET /api/room-types/branch/:branchId
// Retrieve active room types belonging to an active branch.
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
          rt.policies,
          (
            SELECT rtp.photo_url
            FROM room_type_photos AS rtp
            WHERE rtp.room_type_id = rt.id
              AND rtp.is_primary = TRUE
            ORDER BY rtp.id ASC
            LIMIT 1
          ) AS image_url
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
