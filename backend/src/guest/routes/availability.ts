import { Router } from "express";
import { pool } from "../../config/db.js";

const router = Router();

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

// GET /api/availability
router.get("/", async (req, res) => {
  const branchId = Number(req.query.branchId);
  const adults = Number(req.query.adults);
  const children =
    req.query.children === undefined ? 0 : Number(req.query.children);

  const checkIn = req.query.checkIn;
  const checkOut = req.query.checkOut;

  if (
    !Number.isSafeInteger(branchId) ||
    branchId <= 0 ||
    !isValidDate(checkIn) ||
    !isValidDate(checkOut) ||
    checkOut <= checkIn ||
    !Number.isSafeInteger(adults) ||
    adults <= 0 ||
    !Number.isSafeInteger(children) ||
    children < 0
  ) {
    res.status(400).json({
      success: false,
      message:
        "Provide a valid branchId, checkIn, checkOut, adults and optional children. Check-out must be after check-in.",
    });
    return;
  }

  try {
    const result = await pool.query(
      ` SELECT
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
          available_rooms.available_rooms
        FROM room_types AS rt
        INNER JOIN hotel_branches AS hb
          ON hb.id = rt.branch_id
        CROSS JOIN LATERAL (
          SELECT COUNT(*)::int AS available_rooms
          FROM rooms AS r
          WHERE r.room_type_id = rt.id
            AND r.status = 'available'
            AND NOT EXISTS (
              SELECT 1
              FROM booking_rooms AS br
              INNER JOIN bookings AS b
                ON b.id = br.booking_id
              WHERE br.room_id = r.id
                AND b.status IN ('pending', 'confirmed')
                AND b.check_in < $3::date
                AND b.check_out > $2::date
            )
        ) AS available_rooms
        WHERE rt.branch_id = $1
          AND hb.is_active = TRUE
          AND rt.is_active = TRUE
          AND rt.capacity_adults >= $4
          AND rt.capacity_children >= $5
          AND available_rooms.available_rooms > 0
        ORDER BY rt.base_price ASC, rt.name ASC
      `,
      [branchId, checkIn, checkOut, adults, children],
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      search: {branchId, checkIn, checkOut, adults, children,},
      data: result.rows,
    });
  } catch (error) {
    console.error("Failed to check room availability:", error);

    res.status(500).json({
      success: false,
      message: "Unable to check room availability",
    });
  }
});

export default router;
