import { Router } from "express";
import { pool } from "../../config/db.js";
import { authenticateAdmin, type AuthenticatedAdminRequest,} from "../middleware/auth.js";

const router = Router();

// GET /api/admin/bookings
// Allow authenticated administrators to view bookings.
router.get( "/", authenticateAdmin,
  async (req: AuthenticatedAdminRequest, res) => {
    try {
      const result = await pool.query(
        `
          SELECT
            b.id,
            b.booking_reference,
            b.user_id,
            b.guest_full_name,
            b.guest_email,
            b.guest_phone,
            b.check_in,
            b.check_out,
            b.adults,
            b.children,
            b.status,
            b.special_requests,
            b.total_amount,
            b.currency,
            b.created_at,
            hb.id AS branch_id,
            hb.name AS branch_name,
            COALESCE(
              json_agg(
                json_build_object(
                  'roomId', r.id,
                  'roomNumber', r.room_number,
                  'roomTypeId', rt.id,
                  'roomTypeName', rt.name,
                  'nightlyPrice', br.nightly_price
                )
              ) FILTER (WHERE r.id IS NOT NULL),
              '[]'::json
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
          GROUP BY b.id, hb.id, hb.name
          ORDER BY b.created_at DESC, b.id DESC
        `,
      );

      res.status(200).json({
        success: true,
        count: result.rows.length,
        data: result.rows,
      });
    } catch (error) {
      console.error("Failed to retrieve admin bookings:", error);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve bookings.",
      });
    }
  },
);

export default router;
