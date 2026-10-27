import { Router, type Request, type Response } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { pool } from "../../config/db.js";
import { optionalAuthenticateGuest, type AuthenticatedGuestRequest,} from "../middleware/auth.js";

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

  // Registered bookings must be accessed by their account owner.
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

  // A signed-in guest must not fall back to guest-email access.
  if (user) {
    res.status(403).json({
      success: false,
      message: "Use guest checkout details to access this booking's payment.",
    });
    return false;
  }

  // Guest bookings require the contact email used when booking.
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

      await client.query(
        `UPDATE bookings
         SET status = 'confirmed',
             updated_at = NOW()
         WHERE id = $1 AND status = 'pending'`,
        [payment.booking_id],
      );

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
  async (req: AuthenticatedGuestRequest, res) => {
    const bookingId = Number(req.body?.bookingId);
    const secretKey = getTestSecretKey();

    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) {
      res.status(400).json({
        success: false,
        message: "Provide a valid bookingId.",
      });
      return;
    }

    if (!secretKey) {
      res.status(500).json({
        success: false,
        message: "Paystack test secret key is not configured.",
      });
      return;
    }

    let paymentId: number | null = null;

    try {
      const bookingResult = await pool.query(
        `SELECT id, user_id, guest_email, total_amount, currency, status
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

      if (
        !booking.guest_email ||
        !Number.isFinite(amount) ||
        amount <= 0 ||
        booking.currency !== "ZAR"
      ) {
        res.status(400).json({
          success: false,
          message: "Booking payment details are invalid.",
        });
        return;
      }

      const amountInCents = Math.round(amount * 100);

      if (
        !Number.isSafeInteger(amountInCents) ||
        Math.abs(amountInCents / 100 - amount) > 0.000001
      ) {
        res.status(400).json({
          success: false,
          message: "Booking amount is invalid.",
        });
        return;
      }

      const reference = `LS-PAY-${booking.id}-${randomBytes(8).toString("hex")}`;

      const paymentResult = await pool.query(
        `INSERT INTO payments (
           booking_id, provider, amount, currency, status, provider_data
         )
         VALUES ($1, 'paystack', $2, 'ZAR', 'pending', $3::jsonb)
         RETURNING id`,
        [booking.id, amount, JSON.stringify({ reference })],
      );

      paymentId = Number(paymentResult.rows[0].id);

      const response = await fetch(`${PAYSTACK_URL}/transaction/initialize`, {
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
        }),
        signal: AbortSignal.timeout(15000),
      });

      const result = await response.json();

      if (
        !response.ok ||
        result.status !== true ||
        !result.data?.authorization_url ||
        result.data.reference !== reference
      ) {
        await pool.query(
          `UPDATE payments
           SET status = 'failed',
               updated_at = NOW()
           WHERE id = $1 AND status = 'pending'`,
          [paymentId],
        );

        res.status(502).json({
          success: false,
          message: "Unable to initialize payment with Paystack.",
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
            access_code: result.data.access_code,
            authorization_url: result.data.authorization_url,
          }),
          paymentId,
        ],
      );

      res.status(200).json({
        success: true,
        message: "Payment initialized successfully.",
        data: {
          paymentId,
          bookingId: booking.id,
          reference,
          amount,
          currency: booking.currency,
          authorizationUrl: result.data.authorization_url,
        },
      });
    } catch (error) {
      console.error("Payment initialization failed:", error);

      if (paymentId !== null) {
        await pool
          .query(
            `UPDATE payments
             SET status = 'failed',
                 updated_at = NOW()
             WHERE id = $1 AND status = 'pending'`,
            [paymentId],
          )
          .catch((updateError) => {
            console.error("Failed to update payment status:", updateError);
          });
      }

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Unable to initialize payment.",
        });
      }
    }
  },
);

// POST /api/payments/verify
router.post(
  "/verify",
  optionalAuthenticateGuest,
  async (req: AuthenticatedGuestRequest, res) => {
    const reference = req.body?.reference;
    const secretKey = getTestSecretKey();

    if (
      typeof reference !== "string" ||
      !/^[A-Za-z0-9._=-]{1,100}$/.test(reference)
    ) {
      res.status(400).json({
        success: false,
        message: "Provide a valid payment reference.",
      });
      return;
    }

    if (!secretKey) {
      res.status(500).json({
        success: false,
        message: "Paystack test secret key is not configured.",
      });
      return;
    }

    try {
      // Find the payment and authorize access before contacting Paystack.
      const paymentResult = await pool.query(
        `SELECT
           p.id AS payment_id,
           p.booking_id,
           p.amount,
           p.currency,
           p.status AS payment_status,
           b.status AS booking_status,
           b.user_id,
           b.guest_email
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

      const response = await fetch(
        `${PAYSTACK_URL}/transaction/verify/${encodeURIComponent(reference)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${secretKey}`,
          },
          signal: AbortSignal.timeout(15000),
        },
      );

      const result = await response.json();

      if (!response.ok || result.status !== true || !result.data) {
        res.status(502).json({
          success: false,
          message: "Unable to verify the transaction with Paystack.",
        });
        return;
      }

      const transaction = result.data;

      if (transaction.reference !== reference) {
        res.status(400).json({
          success: false,
          message: "Transaction reference does not match.",
        });
        return;
      }

      const expectedCents = Math.round(Number(payment.amount) * 100);

      if (
        !Number.isSafeInteger(expectedCents) ||
        transaction.amount !== expectedCents ||
        transaction.currency !== payment.currency ||
        payment.currency !== "ZAR"
      ) {
        res.status(400).json({
          success: false,
          message: "Payment amount or currency does not match.",
        });
        return;
      }

      if (transaction.status !== "success") {
        res.status(409).json({
          success: false,
          message: "Payment has not succeeded. Booking remains pending.",
          paymentStatus: transaction.status,
        });
        return;
      }

      if (!Number.isSafeInteger(transaction.id)) {
        res.status(400).json({
          success: false,
          message: "Paystack returned an invalid transaction ID.",
        });
        return;
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const lockedPayment = await client.query(
          `SELECT
             p.id,
             p.booking_id,
             p.amount,
             p.currency,
             p.status AS payment_status,
             b.status AS booking_status,
             b.user_id,
             b.guest_email
           FROM payments p
           JOIN bookings b ON b.id = p.booking_id
           WHERE p.id = $1
           FOR UPDATE OF p, b`,
          [payment.payment_id],
        );

        if (lockedPayment.rows.length === 0) {
          await client.query("ROLLBACK");

          res.status(404).json({
            success: false,
            message: "Payment record not found.",
          });
          return;
        }

        const current = lockedPayment.rows[0];

        // Recheck authorization against the locked booking record.
        if (!authorizeBookingAccess(req, current, res)) {
          await client.query("ROLLBACK");
          return;
        }

        if (
          Number(current.amount) !== Number(payment.amount) ||
          current.currency !== payment.currency
        ) {
          await client.query("ROLLBACK");

          res.status(409).json({
            success: false,
            message: "Payment record changed during verification.",
          });
          return;
        }

        if (
          current.payment_status === "succeeded" &&
          current.booking_status === "confirmed"
        ) {
          await client.query("COMMIT");

          res.status(200).json({
            success: true,
            message: "Payment was already verified.",
            bookingId: current.booking_id,
            bookingStatus: "confirmed",
            paymentStatus: "succeeded",
          });
          return;
        }

        if (
          current.payment_status !== "pending" ||
          current.booking_status !== "pending"
        ) {
          await client.query("ROLLBACK");

          res.status(409).json({
            success: false,
            message: "Payment or booking is no longer pending.",
          });
          return;
        }

        await client.query(
          `UPDATE payments
           SET status = 'succeeded',
               provider_payment_id = $1,
               paid_at = NOW(),
               provider_data = provider_data || $2::jsonb,
               updated_at = NOW()
           WHERE id = $3`,
          [
            String(transaction.id),
            JSON.stringify({
              verified: true,
              verifiedStatus: transaction.status,
              verifiedAmount: transaction.amount,
              verifiedCurrency: transaction.currency,
              paidAt: transaction.paid_at,
            }),
            current.id,
          ],
        );

        await client.query(
          `UPDATE bookings
           SET status = 'confirmed',
               updated_at = NOW()
           WHERE id = $1 AND status = 'pending'`,
          [current.booking_id],
        );

        await client.query("COMMIT");

        res.status(200).json({
          success: true,
          message: "Payment verified and booking confirmed.",
          bookingId: current.booking_id,
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
      console.error("Payment verification failed:", error);

      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: "Unable to verify payment.",
        });
      }
    }
  },
);

export default router;
