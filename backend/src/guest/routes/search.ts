import { Router } from "express";
import { pool } from "../../config/db.js";

const router = Router();

function getOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function parseOptionalNumber(value: unknown): number | null {
  if (value === undefined || value === "") {
    return null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    return Number.NaN;
  }

  const number = Number(value);

  return Number.isFinite(number) ? number : Number.NaN;
}

// GET /api/search
// Search active accommodation branches and their active room types.
router.get("/", async (req, res) => {
  const city = getOptionalString(req.query.city);
  const province = getOptionalString(req.query.province);

  const minPrice = parseOptionalNumber(req.query.minPrice);
  const maxPrice = parseOptionalNumber(req.query.maxPrice);
  const minStarRating = parseOptionalNumber(req.query.minStarRating);
  const adults = parseOptionalNumber(req.query.adults);
  const children = parseOptionalNumber(req.query.children);

  const checkIn = req.query.checkIn;
  const checkOut = req.query.checkOut;

  const datesProvided = checkIn !== undefined || checkOut !== undefined;

  if (
    Number.isNaN(minPrice) ||
    Number.isNaN(maxPrice) ||
    Number.isNaN(minStarRating) ||
    Number.isNaN(adults) ||
    Number.isNaN(children)
  ) {
    res.status(400).json({
      success: false,
      message: "Numeric search filters must contain valid numbers.",
    });
    return;
  }

  if (
    (minPrice !== null && minPrice < 0) ||
    (maxPrice !== null && maxPrice < 0) ||
    (minPrice !== null && maxPrice !== null && minPrice > maxPrice) ||
    (minStarRating !== null && (minStarRating < 0 || minStarRating > 5)) ||
    (adults !== null && (!Number.isSafeInteger(adults) || adults <= 0)) ||
    (children !== null && (!Number.isSafeInteger(children) || children < 0))
  ) {
    res.status(400).json({
      success: false,
      message: "One or more search filters are outside the allowed range.",
    });
    return;
  }

  if (
    datesProvided &&
    (!isValidDate(checkIn) || !isValidDate(checkOut) || checkOut <= checkIn)
  ) {
    res.status(400).json({
      success: false,
      message:
        "Provide valid checkIn and checkOut dates. Check-out must be after check-in.",
    });
    return;
  }

  try {
    const result = await pool.query(
      `
        SELECT
          hb.id AS branch_id,
          hb.name AS branch_name,
          hb.slug,
          hb.description AS branch_description,
          hb.address_line,
          hb.suburb,
          hb.city,
          hb.province,
          hb.country,
          hb.postal_code,
          hb.latitude,
          hb.longitude,
          hb.star_rating,

          rt.id AS room_type_id,
          rt.name AS room_type_name,
          rt.description AS room_type_description,
          rt.capacity_adults,
          rt.capacity_children,
          rt.base_price,
          rt.currency,
          rt.facilities,
          rt.policies,

          available_rooms.available_rooms

        FROM hotel_branches AS hb

        INNER JOIN room_types AS rt
          ON rt.branch_id = hb.id

        CROSS JOIN LATERAL (
          SELECT COUNT(*)::integer AS available_rooms
          FROM rooms AS r
          WHERE r.room_type_id = rt.id
            AND r.status = 'available'
            AND (
              $8::date IS NULL
              OR NOT EXISTS (
                SELECT 1
                FROM booking_rooms AS br
                INNER JOIN bookings AS b
                  ON b.id = br.booking_id
                WHERE br.room_id = r.id
                  AND b.status IN ('pending', 'confirmed')
                  AND b.check_in < $9::date
                  AND b.check_out > $8::date
              )
            )
        ) AS available_rooms

        WHERE hb.is_active = TRUE
          AND rt.is_active = TRUE

          AND (
            $1::text IS NULL
            OR hb.city ILIKE '%' || $1 || '%'
          )

          AND (
            $2::text IS NULL
            OR hb.province ILIKE '%' || $2 || '%'
          )

          AND (
            $3::numeric IS NULL
            OR rt.base_price >= $3
          )

          AND (
            $4::numeric IS NULL
            OR rt.base_price <= $4
          )

          AND (
            $5::numeric IS NULL
            OR hb.star_rating >= $5
          )

          AND (
            $6::integer IS NULL
            OR rt.capacity_adults >= $6
          )

          AND (
            $7::integer IS NULL
            OR rt.capacity_children >= $7
          )

          AND (
            $8::date IS NULL
            OR available_rooms.available_rooms > 0
          )

        ORDER BY
          hb.city ASC,
          hb.name ASC,
          rt.base_price ASC,
          rt.name ASC
      `,
      [
        city,
        province,
        minPrice,
        maxPrice,
        minStarRating,
        adults,
        children,
        datesProvided ? checkIn : null,
        datesProvided ? checkOut : null,
      ],
    );

    res.status(200).json({
      success: true,
      count: result.rows.length,
      filters: {
        city,
        province,
        minPrice,
        maxPrice,
        minStarRating,
        adults,
        children,
        checkIn: datesProvided ? checkIn : null,
        checkOut: datesProvided ? checkOut : null,
      },
      data: result.rows,
    });
  } catch (error) {
    console.error("Accommodation search failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to search accommodations.",
    });
  }
});

export default router;
 