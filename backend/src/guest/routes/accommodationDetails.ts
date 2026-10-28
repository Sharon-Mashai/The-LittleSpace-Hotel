import { Router } from "express";
import { pool } from "../../config/db.js";

const router = Router();

// GET /api/accommodations/:branchId
// Retrieve the full details of one active accommodation.
router.get("/:branchId", async (req, res) => {
  const branchId = String(req.params.branchId);

  if (!/^[1-9]\d*$/.test(branchId)) {
    res.status(400).json({
      success: false,
      message: "A valid accommodation ID is required.",
    });
    return;
  }

  try {
    const accommodationResult = await pool.query(
      `
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
        WHERE id = $1
          AND is_active = TRUE
      `,
      [branchId],
    );

    if (accommodationResult.rows.length === 0) {
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
          photo_url,
          caption,
          is_primary,
          display_order
        FROM accommodation_photos
        WHERE branch_id = $1
        ORDER BY is_primary DESC, display_order ASC, id ASC
      `,
      [branchId],
    );

    const roomTypesResult = await pool.query(
      `
        SELECT
          id,
          name,
          description,
          capacity_adults,
          capacity_children,
          base_price,
          currency,
          facilities,
          policies
        FROM room_types
        WHERE branch_id = $1
          AND is_active = TRUE
        ORDER BY base_price ASC, name ASC
      `,
      [branchId],
    );

    const reviewsResult = await pool.query(
      `
        SELECT
          COUNT(*)::integer AS review_count,
          COALESCE(
            ROUND(AVG(rating)::numeric, 1),
            0
          ) AS average_rating
        FROM reviews
        WHERE branch_id = $1
      `,
      [branchId],
    );

    res.status(200).json({
      success: true,
      data: {
        ...accommodationResult.rows[0],
        review_count: reviewsResult.rows[0].review_count,
        average_rating: reviewsResult.rows[0].average_rating,
        photos: photosResult.rows,
        roomTypes: roomTypesResult.rows,
      },
    });
  } catch (error) {
    console.error("Failed to retrieve accommodation details:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve accommodation details.",
    });
  }
});

export default router;
