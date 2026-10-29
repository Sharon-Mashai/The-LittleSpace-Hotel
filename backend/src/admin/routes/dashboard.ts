import { Router } from "express";
import { pool } from "../../config/db.js";
import { authenticateAdmin } from "../middleware/auth.js";

const router = Router();

// GET /api/admin/dashboard
// Return reservation, revenue, branch, room-type and recent-booking statistics.
router.get("/", authenticateAdmin, async (_req, res) => {
  try {
    const [
      bookingsResult,
      revenueResult,
      branchesResult,
      roomTypesResult,
      recentBookingsResult,
    ] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) AS total_bookings,
          COUNT(*) FILTER (WHERE status = 'pending') AS pending_bookings,
          COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_bookings,
          COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_bookings,
          COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_bookings,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed_bookings
        FROM bookings
      `),

      pool.query(`
        SELECT
          COALESCE(SUM(amount), 0) AS total_revenue,
          COUNT(*) AS successful_payment_count
        FROM payments
        WHERE status = 'succeeded'
          AND currency = 'ZAR'
      `),

      pool.query(`
        SELECT
          COUNT(*) AS total_branches,
          COUNT(*) FILTER (WHERE is_active = TRUE) AS active_branches
        FROM hotel_branches
      `),

      pool.query(`
        SELECT
          COUNT(*) AS total_room_types,
          COUNT(*) FILTER (WHERE is_active = TRUE) AS active_room_types
        FROM room_types
      `),

      pool.query(`
        SELECT
          b.id,
          b.booking_reference,
          b.guest_full_name,
          b.guest_email,
          b.check_in,
          b.check_out,
          b.status,
          b.total_amount,
          b.currency,
          b.created_at
        FROM bookings AS b
        ORDER BY b.created_at DESC, b.id DESC
        LIMIT 5
      `),
    ]);

    res.status(200).json({
      success: true,
      data: {
        bookings: bookingsResult.rows[0],
        revenue: revenueResult.rows[0],
        branches: branchesResult.rows[0],
        roomTypes: roomTypesResult.rows[0],
        recentBookings: recentBookingsResult.rows,
      },
    });
  } catch (error) {
    console.error("Failed to retrieve admin dashboard statistics:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve dashboard statistics.",
    });
  }
});

export default router;
