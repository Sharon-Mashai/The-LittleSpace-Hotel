import { Router, type Response } from "express";
import { pool } from "../../config/db.js";
import { authenticateGuest, type AuthenticatedGuestRequest,} from "../middleware/auth.js";

const router = Router();

// GET /api/reviews/branch/:branchId
// Publicly retrieve reviews for an accommodation.
router.get("/branch/:branchId", async (req, res: Response): Promise<void> => {
  try {
    const branchId = String(req.params.branchId);

    if (!/^[1-9]\d*$/.test(branchId)) {
      res.status(400).json({
        success: false,
        message: "A valid accommodation ID is required.",
      });
      return;
    }

    const branchResult = await pool.query(
      `SELECT id, name
         FROM hotel_branches
         WHERE id = $1 AND is_active = TRUE`,
      [branchId],
    );

    if (branchResult.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "Active accommodation not found.",
      });
      return;
    }

    const result = await pool.query(
      `SELECT
           r.id,
           r.branch_id,
           r.booking_id,
           r.rating,
           r.comment,
           r.created_at,
           r.updated_at,
           u.full_name AS reviewer_name
         FROM reviews r
         INNER JOIN users u ON u.id = r.user_id
         WHERE r.branch_id = $1
         ORDER BY r.created_at DESC`,
      [branchId],
    );

    const ratingResult = await pool.query(
      `SELECT
           COUNT(*)::integer AS review_count,
           COALESCE(ROUND(AVG(rating)::numeric, 1), 0) AS average_rating
         FROM reviews
         WHERE branch_id = $1`,
      [branchId],
    );

    res.status(200).json({
      success: true,
      message: "Reviews retrieved successfully.",
      data: {
        accommodation: branchResult.rows[0],
        summary: ratingResult.rows[0],
        reviews: result.rows,
      },
    });
  } catch (error) {
    console.error("Failed to retrieve reviews:", error);

    res.status(500).json({
      success: false,
      message: "Could not retrieve reviews.",
    });
  }
});

// POST /api/reviews
// Only a guest with a completed booking can submit a review.
router.post(
  "/",
  authenticateGuest,
  async (req: AuthenticatedGuestRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { bookingId, rating, comment } = req.body ?? {};

      const validBookingId =
        (typeof bookingId === "string" && /^[1-9]\d*$/.test(bookingId)) ||
        (typeof bookingId === "number" &&
          Number.isSafeInteger(bookingId) &&
          bookingId > 0);

      if (
        !validBookingId ||
        !Number.isInteger(rating) ||
        rating < 1 ||
        rating > 5 ||
        (comment !== undefined &&
          comment !== null &&
          (typeof comment !== "string" || comment.trim().length > 2000))
      ) {
        res.status(400).json({
          success: false,
          message:
            "Provide a valid booking ID, a rating from 1 to 5, and an optional comment of up to 2000 characters.",
        });
        return;
      }

      const bookingResult = await pool.query(
        `SELECT b.id, b.status, br.branch_id
         FROM bookings b
         INNER JOIN booking_rooms booked_room
           ON booked_room.booking_id = b.id
         INNER JOIN rooms room
           ON room.id = booked_room.room_id
         INNER JOIN room_types rt
           ON rt.id = room.room_type_id
         INNER JOIN hotel_branches br
           ON br.id = rt.branch_id
         WHERE b.id = $1
           AND b.user_id = $2
         LIMIT 1`,
        [String(bookingId), userId],
      );

      if (bookingResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: "Booking not found for this guest.",
        });
        return;
      }

      const booking = bookingResult.rows[0];

      if (booking.status !== "completed") {
        res.status(403).json({
          success: false,
          message:
            "You can only review an accommodation after your booking is completed.",
        });
        return;
      }

      const branchId = String(booking.branch_id);

      const existingReview = await pool.query(
        `SELECT id
         FROM reviews
         WHERE booking_id = $1`,
        [String(bookingId)],
      );

      if (existingReview.rows.length > 0) {
        res.status(409).json({
          success: false,
          message: "A review has already been submitted for this booking.",
        });
        return;
      }

      const result = await pool.query(
        `INSERT INTO reviews (user_id, branch_id, booking_id, rating, comment)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, user_id, branch_id, booking_id, rating, comment,
                   created_at, updated_at`,
        [
          userId,
          branchId,
          String(bookingId),
          rating,
          typeof comment === "string" ? comment.trim() || null : null,
        ],
      );

      res.status(201).json({
        success: true,
        message: "Review submitted successfully.",
        data: result.rows[0],
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        res.status(409).json({
          success: false,
          message: "A review has already been submitted for this booking.",
        });
        return;
      }

      console.error("Failed to submit review:", error);

      res.status(500).json({
        success: false,
        message: "Could not submit review.",
      });
    }
  },
);

// PATCH /api/reviews/:reviewId
// A guest may edit only their own review.
router.patch(
  "/:reviewId",
  authenticateGuest,
  async (req: AuthenticatedGuestRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const reviewId = String(req.params.reviewId);
      const { rating, comment } = req.body ?? {};

      if (
        !/^[1-9]\d*$/.test(reviewId) ||
        (rating === undefined && comment === undefined) ||
        (rating !== undefined &&
          (!Number.isInteger(rating) || rating < 1 || rating > 5)) ||
        (comment !== undefined &&
          comment !== null &&
          (typeof comment !== "string" || comment.trim().length > 2000))
      ) {
        res.status(400).json({
          success: false,
          message:
            "Provide a valid review ID and a rating from 1 to 5 and/or a comment of up to 2000 characters.",
        });
        return;
      }

      const result = await pool.query(
        `UPDATE reviews
         SET rating = COALESCE($1, rating),
             comment = CASE
               WHEN $2::boolean THEN $3::text
               ELSE comment
             END,
             updated_at = NOW()
         WHERE id = $4
           AND user_id = $5
         RETURNING id, user_id, branch_id, booking_id, rating, comment,
                   created_at, updated_at`,
        [
          rating === undefined ? null : rating,
          comment !== undefined,
          typeof comment === "string" ? comment.trim() || null : null,
          reviewId,
          userId,
        ],
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: "Review not found or you do not own this review.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Review updated successfully.",
        data: result.rows[0],
      });
    } catch (error) {
      console.error("Failed to update review:", error);

      res.status(500).json({
        success: false,
        message: "Could not update review.",
      });
    }
  },
);

// DELETE /api/reviews/:reviewId
// A guest may delete only their own review.
router.delete(
  "/:reviewId",
  authenticateGuest,
  async (req: AuthenticatedGuestRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const reviewId = String(req.params.reviewId);

      if (!/^[1-9]\d*$/.test(reviewId)) {
        res.status(400).json({
          success: false,
          message: "A valid review ID is required.",
        });
        return;
      }

      const result = await pool.query(
        `DELETE FROM reviews
         WHERE id = $1
           AND user_id = $2
         RETURNING id`,
        [reviewId, userId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: "Review not found or you do not own this review.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Review deleted successfully.",
        data: {
          id: String(result.rows[0].id),
        },
      });
    } catch (error) {
      console.error("Failed to delete review:", error);

      res.status(500).json({
        success: false,
        message: "Could not delete review.",
      });
    }
  },
);

export default router;
