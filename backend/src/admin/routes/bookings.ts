import { Router, type Response, type NextFunction } from "express";
import { pool } from "../../config/db.js";
import { sendBookingConfirmationEmail } from "../../config/emailService.js";
import {
  authenticateAdmin,
  requirePermission,
  type AuthenticatedAdminRequest,
} from "../middleware/auth.js";

const router = Router();

// Select the correct permission according to the requested booking action.
const requireBookingStatusPermission = (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction,
) => {
  const requestedStatus: unknown = req.body?.status;

  if (requestedStatus === "confirmed") {
    return requirePermission("bookings.confirm")(req, res, next);
  }

  if (requestedStatus === "cancelled") {
    return requirePermission("bookings.cancel")(req, res, next);
  }

  if (requestedStatus === "rejected") {
    return requirePermission("bookings.reject")(req, res, next);
  }

  return next();
};

// GET /api/admin/bookings
// Only administrators with bookings.view can retrieve bookings.
router.get(
  "/",
  authenticateAdmin,
  requirePermission("bookings.view"),
  async (_req: AuthenticatedAdminRequest, res) => {
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
            b.check_in::text AS check_in,
            b.check_out::text AS check_out,
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

// PATCH /api/admin/bookings/:bookingId/status
// Each action requires its corresponding permission.
// A booking can only be confirmed after successful payment.
router.patch(
  "/:bookingId/status",
  authenticateAdmin,
  requireBookingStatusPermission,
  async (req: AuthenticatedAdminRequest, res) => {
    const bookingId = String(req.params.bookingId);
    const requestedStatus: unknown = req.body?.status;

    if (!/^[1-9]\d*$/.test(bookingId)) {
      res.status(400).json({
        success: false,
        message: "A valid booking ID is required.",
      });
      return;
    }

    if (
      requestedStatus !== "confirmed" &&
      requestedStatus !== "cancelled" &&
      requestedStatus !== "rejected"
    ) {
      res.status(400).json({
        success: false,
        message: 'Status must be "confirmed", "cancelled", or "rejected".',
      });
      return;
    }

    const client = await pool.connect();
    let transactionStarted = false;

    // These details are collected during confirmation,
    // but the email is only sent after the transaction commits.
    let confirmationEmailDetails: {
      guestName: string;
      guestEmail: string;
      bookingReference: string;
      branchName: string;
      checkIn: string;
      checkOut: string;
      roomName: string;
      nights: number;
      totalAmount: string;
      currency: string;
    } | null = null;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      // Lock the booking to prevent conflicting status updates.
      const bookingResult = await client.query(
        `
          SELECT
            id,
            booking_reference,
            user_id,
            guest_full_name,
            status
          FROM bookings
          WHERE id = $1
          FOR UPDATE
        `,
        [bookingId],
      );

      if (bookingResult.rows.length === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        res.status(404).json({
          success: false,
          message: "Booking not found.",
        });
        return;
      }

      const booking = bookingResult.rows[0] as {
        id: string;
        booking_reference: string;
        user_id: string | null;
        guest_full_name: string;
        status: string;
      };

      const currentStatus = booking.status;

      if (requestedStatus === "confirmed") {
        // Only pending bookings can be confirmed.
        if (currentStatus !== "pending") {
          await client.query("ROLLBACK");
          transactionStarted = false;

          res.status(409).json({
            success: false,
            message: "Only pending bookings can be confirmed.",
            currentStatus,
          });
          return;
        }

        // A successful payment must exist before confirmation.
        const paymentResult = await client.query(
          `
            SELECT EXISTS (
              SELECT 1
              FROM payments
              WHERE booking_id = $1
                AND status = 'succeeded'
            ) AS has_successful_payment
          `,
          [bookingId],
        );

        if (!paymentResult.rows[0].has_successful_payment) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          res.status(409).json({
            success: false,
            message:
              "This booking cannot be confirmed because no successful payment was found.",
          });
          return;
        }

        // Retrieve the details required for the confirmation email.
        const emailDetailsResult = await client.query(
          `
            SELECT
              b.guest_full_name,
              b.guest_email,
              b.booking_reference,
              b.check_in::text AS check_in,
              b.check_out::text AS check_out,
              (b.check_out - b.check_in)::integer AS nights,
              b.total_amount::text AS total_amount,
              b.currency,
              COALESCE(
                STRING_AGG(DISTINCT hb.name, ', '),
                'LittleSpace Hotel'
              ) AS branch_name,
              COALESCE(
                STRING_AGG(DISTINCT rt.name, ', '),
                'Reserved room'
              ) AS room_name
            FROM bookings AS b
            LEFT JOIN booking_rooms AS br
              ON br.booking_id = b.id
            LEFT JOIN rooms AS r
              ON r.id = br.room_id
            LEFT JOIN room_types AS rt
              ON rt.id = r.room_type_id
            LEFT JOIN hotel_branches AS hb
              ON hb.id = rt.branch_id
            WHERE b.id = $1
            GROUP BY b.id
          `,
          [bookingId],
        );

        if (emailDetailsResult.rows.length > 0) {
          const details = emailDetailsResult.rows[0];

          confirmationEmailDetails = {
            guestName: details.guest_full_name,
            guestEmail: details.guest_email,
            bookingReference: details.booking_reference,
            branchName: details.branch_name,
            checkIn: details.check_in,
            checkOut: details.check_out,
            roomName: details.room_name,
            nights: Number(details.nights),
            totalAmount: details.total_amount,
            currency: details.currency,
          };
        }
      } else if (requestedStatus === "cancelled") {
        // Pending or confirmed bookings can be cancelled.
        if (currentStatus !== "pending" && currentStatus !== "confirmed") {
          await client.query("ROLLBACK");
          transactionStarted = false;

          res.status(409).json({
            success: false,
            message: "Only pending or confirmed bookings can be cancelled.",
            currentStatus,
          });
          return;
        }
      } else {
        // Rejection is only allowed for pending bookings.
        if (currentStatus !== "pending") {
          await client.query("ROLLBACK");
          transactionStarted = false;

          res.status(409).json({
            success: false,
            message: "Only pending bookings can be rejected.",
            currentStatus,
          });
          return;
        }

        // Never reject a booking that has a successful payment.
        const paymentResult = await client.query(
          `
            SELECT EXISTS (
              SELECT 1
              FROM payments
              WHERE booking_id = $1
                AND status = 'succeeded'
            ) AS has_successful_payment
          `,
          [bookingId],
        );

        if (paymentResult.rows[0].has_successful_payment) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          res.status(409).json({
            success: false,
            message:
              "This booking has a successful payment and cannot be rejected. Use cancellation and handle any refund separately.",
          });
          return;
        }
      }

      const updateResult = await client.query(
        `
          UPDATE bookings
          SET
            status = $1,
            updated_at = NOW()
          WHERE id = $2
          RETURNING
            id,
            booking_reference,
            user_id,
            guest_full_name,
            status,
            updated_at
        `,
        [requestedStatus, bookingId],
      );

      const updatedBooking = updateResult.rows[0];

      // Guest bookings without an account have no user_id.
      // Only registered guests can receive in-app notifications.
      if (updatedBooking.user_id !== null) {
        let title: string;
        let message: string;

        if (requestedStatus === "confirmed") {
          title = "Booking confirmed";
          message = `Your booking ${updatedBooking.booking_reference} has been confirmed by the hotel.`;
        } else if (requestedStatus === "cancelled") {
          title = "Booking cancelled";
          message = `Your booking ${updatedBooking.booking_reference} has been cancelled by the hotel. If you have already paid, your payment has not been automatically refunded.`;
        } else {
          title = "Booking rejected";
          message = `Your booking ${updatedBooking.booking_reference} has been rejected by the hotel. Contact the hotel if you need assistance.`;
        }

        await client.query(
          `
            INSERT INTO notifications (
              user_id,
              title,
              message,
              type,
              data
            )
            VALUES ($1, $2, $3, $4, $5::jsonb)
          `,
          [
            updatedBooking.user_id,
            title,
            message,
            "booking_update",
            JSON.stringify({
              bookingId: updatedBooking.id,
              bookingReference: updatedBooking.booking_reference,
              status: updatedBooking.status,
            }),
          ],
        );
      }

      // Commit the booking update before attempting to send an email.
      await client.query("COMMIT");
      transactionStarted = false;

      let successMessage: string;
      let emailSent: boolean | undefined;

      if (requestedStatus === "confirmed") {
        successMessage = "Booking confirmed successfully.";
        emailSent = false;

        if (confirmationEmailDetails && confirmationEmailDetails.guestEmail) {
          try {
            await sendBookingConfirmationEmail(confirmationEmailDetails);

            emailSent = true;

            console.log(
              `Booking confirmation email sent to ${confirmationEmailDetails.guestEmail}.`,
            );
          } catch (emailError) {
            // Email failure must not undo a successful booking confirmation.
            console.error(
              "Booking was confirmed, but the confirmation email could not be sent:",
              emailError,
            );

            successMessage =
              "Booking confirmed successfully, but the confirmation email could not be sent.";
          }
        } else {
          successMessage =
            "Booking confirmed successfully, but guest email details could not be retrieved.";
        }
      } else if (requestedStatus === "cancelled") {
        successMessage =
          "Booking cancelled successfully. No automatic refund was processed.";
      } else {
        successMessage = "Booking rejected successfully.";
      }

      res.status(200).json({
        success: true,
        message: successMessage,
        data: updatedBooking,
        ...(requestedStatus === "confirmed" ? { emailSent } : {}),
      });
    } catch (error) {
      if (transactionStarted) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error(
            "Failed to roll back admin booking update:",
            rollbackError,
          );
        }
      }

      console.error("Failed to update admin booking status:", error);

      res.status(500).json({
        success: false,
        message: "Unable to update booking status.",
      });
    } finally {
      client.release();
    }
  },
);

export default router;
