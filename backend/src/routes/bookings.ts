import { Router } from "express";
import { randomBytes } from "node:crypto";
import { pool } from "../config/db.js";
import { optionalAuthenticateToken, type AuthenticatedRequest,} from "../middleware/auth.js";

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

// POST /api/bookings
router.post(
  "/",
  optionalAuthenticateToken,
  async (req: AuthenticatedRequest, res) => {
    const {
      branchId,
      roomTypeId,
      checkIn,
      checkOut,
      adults,
      children = 0,
      guestFullName,
      guestEmail,
      guestPhone,
      specialRequests,
    } = req.body ?? {};

    const validBranchId = Number.isSafeInteger(branchId) && branchId > 0;
    const validRoomTypeId = Number.isSafeInteger(roomTypeId) && roomTypeId > 0;
    const validAdults = Number.isSafeInteger(adults) && adults > 0;
    const validChildren = Number.isSafeInteger(children) && children >= 0;

    const validName =
      typeof guestFullName === "string" &&
      guestFullName.trim().length >= 2 &&
      guestFullName.trim().length <= 150;

    const validEmail =
      typeof guestEmail === "string" &&
      guestEmail.length <= 255 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail.trim());

    const validPhone =
      typeof guestPhone === "string" &&
      guestPhone.trim().length >= 7 &&
      guestPhone.trim().length <= 30;

    const validRequests =
      specialRequests === undefined ||
      specialRequests === null ||
      (typeof specialRequests === "string" && specialRequests.length <= 2000);

    if (
      !validBranchId ||
      !validRoomTypeId ||
      !isValidDate(checkIn) ||
      !isValidDate(checkOut) ||
      checkOut <= checkIn ||
      !validAdults ||
      !validChildren ||
      !validName ||
      !validEmail ||
      !validPhone ||
      !validRequests
    ) {
      res.status(400).json({
        success: false,
        message:
          "Provide valid branch and room type IDs, dates, guest counts, guest name, email and phone. Check-out must be after check-in.",
      });
      return;
    }

    const nights =
      (Date.parse(`${checkOut}T00:00:00.000Z`) -
        Date.parse(`${checkIn}T00:00:00.000Z`)) /
      86_400_000;

    const client = await pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      // Find rooms that currently appear to be available.
      const candidates = await client.query(
        `
          SELECT r.id
          FROM rooms AS r
          INNER JOIN room_types AS rt
            ON rt.id = r.room_type_id
          INNER JOIN hotel_branches AS hb
            ON hb.id = rt.branch_id
          WHERE rt.id = $1
            AND rt.branch_id = $2
            AND rt.is_active = TRUE
            AND hb.is_active = TRUE
            AND r.status = 'available'
            AND rt.capacity_adults >= $3
            AND rt.capacity_children >= $4
            AND NOT EXISTS (
              SELECT 1
              FROM booking_rooms AS br
              INNER JOIN bookings AS b
                ON b.id = br.booking_id
              WHERE br.room_id = r.id
                AND b.status IN ('pending', 'confirmed')
                AND b.check_in < $6::date
                AND b.check_out > $5::date
            )
          ORDER BY r.id
        `,
        [roomTypeId, branchId, adults, children, checkIn, checkOut],
      );

      let selectedRoom: {
        id: string;
        base_price: string;
      } | null = null;

      // Lock each candidate and check availability again.
      for (const candidate of candidates.rows) {
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [
          candidate.id,
        ]);

        const recheck = await client.query(
          `
            SELECT r.id, rt.base_price
            FROM rooms AS r
            INNER JOIN room_types AS rt
              ON rt.id = r.room_type_id
            INNER JOIN hotel_branches AS hb
              ON hb.id = rt.branch_id
            WHERE r.id = $1
              AND rt.id = $2
              AND rt.branch_id = $3
              AND rt.is_active = TRUE
              AND hb.is_active = TRUE
              AND r.status = 'available'
              AND rt.capacity_adults >= $4
              AND rt.capacity_children >= $5
              AND NOT EXISTS (
                SELECT 1
                FROM booking_rooms AS br
                INNER JOIN bookings AS b
                  ON b.id = br.booking_id
                WHERE br.room_id = r.id
                  AND b.status IN ('pending', 'confirmed')
                  AND b.check_in < $7::date
                  AND b.check_out > $6::date
              )
          `,
          [
            candidate.id,
            roomTypeId,
            branchId,
            adults,
            children,
            checkIn,
            checkOut,
          ],
        );

        if (recheck.rows.length > 0) {
          selectedRoom = recheck.rows[0];
          break;
        }
      }

      if (!selectedRoom) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        res.status(409).json({
          success: false,
          message: "No suitable room is currently available for these dates.",
        });
        return;
      }

      const bookingReference = `LS-${Date.now()}-${randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

      const bookingResult = await client.query(
        `
          INSERT INTO bookings (
            booking_reference,
            user_id,
            guest_full_name,
            guest_email,
            guest_phone,
            check_in,
            check_out,
            adults,
            children,
            status,
            special_requests,
            total_amount,
            currency
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6::date,
            $7::date,
            $8,
            $9,
            'pending',
            $10,
            $11::numeric * $12::integer,
            'ZAR'
          )
          RETURNING
            id,
            booking_reference,
            check_in,
            check_out,
            adults,
            children,
            status,
            total_amount,
            currency,
            created_at
        `,
        [
          bookingReference,
          req.user?.id ?? null,
          guestFullName.trim(),
          guestEmail.trim().toLowerCase(),
          guestPhone.trim(),
          checkIn,
          checkOut,
          adults,
          children,
          typeof specialRequests === "string"
            ? specialRequests.trim() || null
            : null,
          selectedRoom.base_price,
          nights,
        ],
      );

      const booking = bookingResult.rows[0];

      await client.query(
        `
          INSERT INTO booking_rooms (
            booking_id,
            room_id,
            nightly_price
          )
          VALUES ($1, $2, $3)
        `,
        [booking.id, selectedRoom.id, selectedRoom.base_price],
      );

      await client.query("COMMIT");
      transactionStarted = false;

      res.status(201).json({
        success: true,
        message:
          "Booking created. Payment is still required to confirm the reservation.",
        data: {
          ...booking,
          roomId: selectedRoom.id,
          nights,
          nightlyPrice: selectedRoom.base_price,
          guestEmail: guestEmail.trim().toLowerCase(),
        },
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Booking rollback failed:", rollbackError);
        }
      }

      console.error("Failed to create booking:", error);

      res.status(500).json({
        success: false,
        message: "Unable to create the booking",
      });
    } finally {
      client.release();
    }
  },
);

export default router;
