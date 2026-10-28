import { Router } from "express";
import { pool } from "../../config/db.js";
import { authenticateGuest, type AuthenticatedGuestRequest,} from "../middleware/auth.js";

const router = Router();

// GET /api/bookings/history
// Retrieve booking history for the authenticated guest.
router.get(
  "/history",
  authenticateGuest,
  async (req: AuthenticatedGuestRequest, res) => {
    try {
      const result = await pool.query(
        `
          SELECT
            b.id AS booking_id,
            b.booking_reference,
            b.check_in,
            b.check_out,
            b.adults,
            b.children,
            b.status,
            b.special_requests,
            b.total_amount,
            b.currency,
            b.created_at,
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'roomId', r.id,
                  'roomNumber', r.room_number,
                  'roomTypeId', rt.id,
                  'roomTypeName', rt.name,
                  'nightlyPrice', br.nightly_price,
                  'branchId', hb.id,
                  'branchName', hb.name,
                  'branchCity', hb.city
                )
                ORDER BY r.id
              ) FILTER (WHERE r.id IS NOT NULL),
              '[]'::jsonb
            ) AS rooms
          FROM bookings AS b
          LEFT JOIN booking_rooms AS br
            ON br.booking_id = b.id
          LEFT JOIN rooms AS r
            ON r.id = br.room_id
          LEFT JOIN room_types AS rt
            ON rt.id = r.room_type_id
          LEFT JOIN hotel_branches AS hb
            ON hb.id = rt.branch_id
          WHERE b.user_id = $1
          GROUP BY b.id
          ORDER BY b.created_at DESC, b.id DESC
        `,
        [req.user!.id],
      );

      res.status(200).json({
        success: true,
        count: result.rows.length,
        data: result.rows,
      });
    } catch (error) {
      console.error("Failed to retrieve booking history:", error);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve booking history.",
      });
    }
  },
);

export default router;
