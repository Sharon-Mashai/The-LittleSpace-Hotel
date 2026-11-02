import { Router, type Request, type Response } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { pool } from "../../config/db.js";
import {
  optionalAuthenticateGuest,
  type AuthenticatedGuestRequest,
} from "../middleware/auth.js";

const router = Router();
const PAYSTACK_URL = "https://api.paystack.co";

type RawBodyRequest = Request & {
  rawBody?: Buffer;
};

type BookingAccessDetails = {
  user_id: string | number | null;
  guest_email: string | null;
};

function getTestSecretKey(): string | null {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  return secretKey?.startsWith("sk_test_") ? secretKey : null;
}

function authorizeBookingAccess(
  req: Request,
  booking: BookingAccessDetails,
  res: Response,
): boolean {
  const authReq = req as AuthenticatedGuestRequest;
  const user = authReq.user;

  if (booking.user_id !== null) {
    if (!user) {
      res.status(401).json({
        success: false,
        message: "Sign in to access this booking's payment.",
      });
      return false;
    }

    if (String(user.id) !== String(booking.user_id)) {
      res.status(403).json({
        success: false,
        message: "You are not authorized to access this booking's payment.",
      });
      return false;
    }

    return true;
  }

  if (user) {
    res.status(403).json({
      success: false,
      message: "Use guest checkout details to access this booking's payment.",
    });
    return false;
  }

  const suppliedEmail =
    typeof req.body?.guestEmail === "string"
      ? req.body.guestEmail.trim().toLowerCase()
      : "";

  const bookingEmail = booking.guest_email?.trim().toLowerCase() ?? "";

  if (!suppliedEmail || !bookingEmail || suppliedEmail !== bookingEmail) {
    res.status(403).json({
      success: false,
      message:
        "Booking access could not be verified. Provide the contact email used for the booking.",
    });
    return false;
  }

  return true;
}

// POST /api/payments/webhook
router.post("/webhook", async (req, res) => {
  const secretKey = getTestSecretKey();
  const signature = req.header("x-paystack-signature");
  const rawBody = (req as RawBodyRequest).rawBody;

  if (!secretKey) {
    res.status(500).json({
      success: false,
      message: "Paystack test secret key is not configured.",
    });
    return;
  }

  if (!signature || !rawBody) {
    res.status(401).json({
      success: false,
      message: "Missing webhook signature or request body.",
    });
    return;
  }

  const expectedSignature = createHmac("sha512", secretKey)
    .update(rawBody)
    .digest("hex");

  const receivedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    res.status(401).json({
      success: false,
      message: "Invalid Paystack webhook signature.",
    });
    return;
  }

  try {
    const event = req.body;

    if (
      event?.event !== "charge.success" ||
      !event?.data ||
      typeof event.data.reference !== "string"
    ) {
      res.status(200).json({
        success: true,
        message: "Webhook received; no action required.",
      });
      return;
    }

    const transaction = event.data;
    const reference: string = transaction.reference;

    if (
      !Number.isSafeInteger(transaction.amount) ||
      transaction.amount <= 0 ||
      transaction.currency !== "ZAR" ||
      transaction.status !== "success" ||
      !Number.isSafeInteger(transaction.id)
    ) {
      res.status(200).json({
        success: true,
        message: "Webhook received; transaction did not qualify.",
      });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT
           p.id AS payment_id,
           p.booking_id,
           p.amount,
           p.currency,
           p.status AS payment_status,
           p.provider_payment_id,
           b.status AS booking_status
         FROM payments p
         JOIN bookings b ON b.id = p.booking_id
         WHERE p.provider = 'paystack'
           AND p.provider_data->>'reference' = $1
         FOR UPDATE OF p, b`,
        [reference],
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");

        res.status(200).json({
          success: true,
          message: "Webhook received; payment reference not found.",
        });
        return;
      }

      const payment = result.rows[0];
      const expectedAmount = Math.round(Number(payment.amount) * 100);

      if (
        !Number.isSafeInteger(expectedAmount) ||
        transaction.amount !== expectedAmount ||
        transaction.currency !== payment.currency ||
        payment.currency !== "ZAR"
      ) {
        await client.query("ROLLBACK");

        console.error("Paystack webhook payment details did not match.");

        res.status(200).json({
          success: true,
          message: "Webhook received; payment details did not match.",
        });
        return;
      }

      // A repeated successful webhook must not process the payment again.
      if (
        payment.payment_status === "succeeded" &&
        payment.booking_status === "confirmed" &&
        String(payment.provider_payment_id) === String(transaction.id)
      ) {
        await client.query("COMMIT");

        res.status(200).json({
          success: true,
          message: "Payment was already processed.",
          bookingId: payment.booking_id,
          bookingStatus: "confirmed",
          paymentStatus: "succeeded",
        });
        return;
      }

      if (
        payment.payment_status !== "pending" ||
        payment.booking_status !== "pending"
      ) {
        await client.query("ROLLBACK");

        res.status(200).json({
          success: true,
          message: "Webhook received; payment or booking is not pending.",
        });
        return;
      }

      await client.query(
        `UPDATE payments
         SET status = 'succeeded',
             provider_payment_id = $1,
             paid_at = COALESCE($2::timestamptz, NOW()),
             provider_data = provider_data || $3::jsonb,
             updated_at = NOW()
         WHERE id = $4`,
        [
          String(transaction.id),
          transaction.paid_at ?? null,
          JSON.stringify({
            webhookVerified: true,
            webhookEvent: "charge.success",
            webhookAmount: transaction.amount,
            webhookCurrency: transaction.currency,
          }),
          payment.payment_id,
        ],
      );

      const confirmedBooking = await client.query(
        `UPDATE bookings
         SET status = 'confirmed',
             updated_at = NOW()
         WHERE id = $1 AND status = 'pending'
         RETURNING id`,
        [payment.booking_id],
      );

      if (confirmedBooking.rows.length !== 1) {
        await client.query("ROLLBACK");

        res.status(200).json({
          success: true,
          message: "Booking status changed; no further action was taken.",
        });
        return;
      }

      await client.query("COMMIT");

      res.status(200).json({
        success: true,
        message: "Payment webhook processed successfully.",
        bookingId: payment.booking_id,
        bookingStatus: "confirmed",
        paymentStatus: "succeeded",
      });
    } catch (error) {
      await client.query("ROLLBACK").catch((rollbackError) => {
        console.error("Webhook rollback failed:", rollbackError);
      });
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Paystack webhook processing failed:", error);

    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: "Unable to process Paystack webhook.",
      });
    }
  }
});
// POST /api/payments/initialize
router.post(
  "/initialize",
  optionalAuthenticateGuest,
  async (req, res) => {
    const secretKey = getTestSecretKey();

    if (!secretKey) {
      res.status(500).json({
        success: false,
        message: "Paystack test secret key is not configured.",
      });
      return;
    }

    const bookingId = Number(req.body?.bookingId);

    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
      res.status(400).json({
        success: false,
        message: "A valid booking ID is required.",
      });
      return;
    }

    try {
      const bookingResult = await pool.query(
        `SELECT
           id,
           user_id,
           guest_email,
           total_amount,
           currency,
           status
         FROM bookings
         WHERE id = $1`,
        [bookingId],
      );

      if (bookingResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: "Booking not found.",
        });
        return;
      }

      const booking = bookingResult.rows[0];

      if (!authorizeBookingAccess(req, booking, res)) {
        return;
      }

      if (booking.status !== "pending") {
        res.status(409).json({
          success: false,
          message: "Only pending bookings can be paid for.",
        });
        return;
      }

      const amount = Number(booking.total_amount);
      const amountInCents = Math.round(amount * 100);

      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !Number.isSafeInteger(amountInCents) ||
        booking.currency !== "ZAR"
      ) {
        res.status(400).json({
          success: false,
          message: "The booking amount or currency is invalid.",
        });
        return;
      }

      const reference = `LS-${bookingId}-${Date.now()}-${randomBytes(4).toString("hex")}`;

      const paymentResult = await pool.query(
        `INSERT INTO payments (
           booking_id,
           provider,
           amount,
           currency,
           status,
           provider_data,
           created_at,
           updated_at
         )
         VALUES ($1, 'paystack', $2, $3, 'pending', $4::jsonb, NOW(), NOW())
         RETURNING id`,
        [
          bookingId,
          amount,
          booking.currency,
          JSON.stringify({ reference }),
        ],
      );

      const paymentId = paymentResult.rows[0].id;

      // Paystack redirects the guest to this frontend route after payment.
      const callbackUrl = `${
        (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "")
      }/payment-confirmation`;

      const paystackResponse = await fetch(
        `${PAYSTACK_URL}/transaction/initialize`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: booking.guest_email,
            amount: String(amountInCents),
            currency: "ZAR",
            reference,
            callback_url: callbackUrl,
          }),
        },
      );

      const paystackData = await paystackResponse.json();

      if (!paystackResponse.ok || !paystackData.status) {
        await pool.query(
          `UPDATE payments
           SET status = 'failed',
               provider_data = provider_data || $1::jsonb,
               updated_at = NOW()
           WHERE id = $2`,
          [
            JSON.stringify({
              initializationError:
                paystackData.message ?? "Paystack initialization failed.",
            }),
            paymentId,
          ],
        );

        res.status(502).json({
          success: false,
          message:
            paystackData.message ?? "Could not initialize Paystack payment.",
        });
        return;
      }

      await pool.query(
        `UPDATE payments
         SET provider_data = provider_data || $1::jsonb,
             updated_at = NOW()
         WHERE id = $2`,
        [
          JSON.stringify({
            authorizationUrl: paystackData.data.authorization_url,
            accessCode: paystackData.data.access_code,
          }),
          paymentId,
        ],
      );

      res.status(200).json({
        success: true,
        message: "Payment initialized successfully.",
        data: {
          paymentId,
          bookingId,
          reference,
          amount,
          currency: booking.currency,
          authorizationUrl: paystackData.data.authorization_url,
        },
      });
    } catch (error) {
      console.error("Paystack initialization error:", error);

      res.status(500).json({
        success: false,
        message: "An error occurred while initializing the payment.",
      });
    }
  },
);
// POST /api/payments/verify
router.post(
  "/verify",
  optionalAuthenticateGuest,
  async (req, res) => {
    const secretKey = getTestSecretKey();

    if (!secretKey) {
      res.status(500).json({
        success: false,
        message: "Paystack test secret key is not configured.",
      });
      return;
    }

    const reference =
      typeof req.body?.reference === "string"
        ? req.body.reference.trim()
        : "";

    if (!reference) {
      res.status(400).json({
        success: false,
        message: "A payment reference is required.",
      });
      return;
    }

    try {
      const paymentResult = await pool.query(
        `SELECT
           p.id AS payment_id,
           p.booking_id,
           p.amount,
           p.currency,
           p.status AS payment_status,
           p.provider_payment_id,
           p.provider_data,
           b.user_id,
           b.guest_email,
           b.status AS booking_status
         FROM payments p
         JOIN bookings b ON b.id = p.booking_id
         WHERE p.provider = 'paystack'
           AND p.provider_data->>'reference' = $1`,
        [reference],
      );

      if (paymentResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: "Payment reference not found.",
        });
        return;
      }

      const payment = paymentResult.rows[0];

      if (!authorizeBookingAccess(req, payment, res)) {
        return;
      }

      if (
        payment.payment_status === "succeeded" &&
        payment.booking_status === "confirmed"
      ) {
        res.status(200).json({
          success: true,
          message: "Payment has already been verified.",
          bookingId: payment.booking_id,
          bookingStatus: "confirmed",
          paymentStatus: "succeeded",
        });
        return;
      }

      if (
        payment.payment_status !== "pending" ||
        payment.booking_status !== "pending"
      ) {
        res.status(409).json({
          success: false,
          message: "This payment or booking is no longer pending.",
        });
        return;
      }

      const paystackResponse = await fetch(
        `${PAYSTACK_URL}/transaction/verify/${encodeURIComponent(reference)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      const paystackData = await paystackResponse.json();

      if (
        !paystackResponse.ok ||
        !paystackData.status ||
        paystackData.data?.status !== "success"
      ) {
        res.status(400).json({
          success: false,
          message:
            paystackData.message ?? "Paystack could not verify this payment.",
        });
        return;
      }

      const transaction = paystackData.data;
      const expectedAmount = Math.round(Number(payment.amount) * 100);

      if (
        !Number.isSafeInteger(expectedAmount) ||
        transaction.amount !== expectedAmount ||
        transaction.currency !== payment.currency ||
        payment.currency !== "ZAR" ||
        transaction.reference !== reference
      ) {
        res.status(400).json({
          success: false,
          message: "The verified payment details do not match the booking.",
        });
        return;
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const lockedResult = await client.query(
          `SELECT
             p.id AS payment_id,
             p.booking_id,
             p.amount,
             p.currency,
             p.status AS payment_status,
             p.provider_payment_id,
             b.status AS booking_status
           FROM payments p
           JOIN bookings b ON b.id = p.booking_id
           WHERE p.id = $1
           FOR UPDATE OF p, b`,
          [payment.payment_id],
        );

        if (lockedResult.rows.length === 0) {
          await client.query("ROLLBACK");

          res.status(404).json({
            success: false,
            message: "Payment record could not be found.",
          });
          return;
        }

        const lockedPayment = lockedResult.rows[0];

        if (
          lockedPayment.payment_status === "succeeded" &&
          lockedPayment.booking_status === "confirmed"
        ) {
          await client.query("COMMIT");

          res.status(200).json({
            success: true,
            message: "Payment has already been verified.",
            bookingId: lockedPayment.booking_id,
            bookingStatus: "confirmed",
            paymentStatus: "succeeded",
          });
          return;
        }

        if (
          lockedPayment.payment_status !== "pending" ||
          lockedPayment.booking_status !== "pending"
        ) {
          await client.query("ROLLBACK");

          res.status(409).json({
            success: false,
            message: "This payment or booking is no longer pending.",
          });
          return;
        }

        await client.query(
          `UPDATE payments
           SET status = 'succeeded',
               provider_payment_id = $1,
               paid_at = COALESCE($2::timestamptz, NOW()),
               provider_data = provider_data || $3::jsonb,
               updated_at = NOW()
           WHERE id = $4`,
          [
            String(transaction.id),
            transaction.paid_at ?? null,
            JSON.stringify({
              verificationStatus: "success",
              verifiedAt: new Date().toISOString(),
              verifiedAmount: transaction.amount,
              verifiedCurrency: transaction.currency,
            }),
            lockedPayment.payment_id,
          ],
        );

        const bookingUpdate = await client.query(
          `UPDATE bookings
           SET status = 'confirmed',
               updated_at = NOW()
           WHERE id = $1
             AND status = 'pending'
           RETURNING id`,
          [lockedPayment.booking_id],
        );

        if (bookingUpdate.rows.length !== 1) {
          throw new Error("The booking could not be confirmed.");
        }

        await client.query("COMMIT");

        res.status(200).json({
          success: true,
          message: "Payment verified and booking confirmed.",
          bookingId: lockedPayment.booking_id,
          bookingStatus: "confirmed",
          paymentStatus: "succeeded",
        });
      } catch (error) {
        await client.query("ROLLBACK").catch((rollbackError) => {
          console.error("Payment verification rollback failed:", rollbackError);
        });

        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Paystack payment verification error:", error);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "An error occurred while verifying the payment.",
        });
      }
    }
  },
);

export default router;