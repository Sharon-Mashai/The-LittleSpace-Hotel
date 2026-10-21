import { Router, type Request } from "express";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { pool } from "../config/db.js";

const router = Router();
const PAYSTACK_URL = "https://api.paystack.co";

type RawBodyRequest = Request & {
  rawBody?: Buffer;
};

function getTestSecretKey(): string | null {
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  return secretKey?.startsWith("sk_test_") ? secretKey : null;
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

  // Paystack signs the exact raw request body using HMAC SHA-512.
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

    // Only process successful charge notifications.
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

      // Lock the matching payment and booking while checking their state.
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

        // Acknowledge the event so Paystack does not keep retrying
        // a transaction that does not belong to this application.
        res.status(200).json({
          success: true,
          message: "Webhook received; payment reference not found.",
        });
        return;
      }

      const payment = result.rows[0];
      const expectedAmount = Math.round(Number(payment.amount) * 100);

      // Never confirm a booking unless all payment details match.
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

      // Repeated successful notifications must not process the
      // same payment again.
      if (
        payment.payment_status === "succeeded" &&
        payment.booking_status === "confirmed" &&
        String(payment.provider_payment_id) === String(transaction.id)
      ) {
        await client.query("COMMIT");

        res.status(200).json({
          success: true,
          message: "Payment was already processed.",
        });
        return;
      }

      // Do not allow a webhook to override a cancelled, rejected,
      // or otherwise non-pending booking/payment.
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
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Paystack webhook processing failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to process Paystack webhook.",
    });
  }
});

// POST /api/payments/initialize
router.post("/initialize", async (req, res) => {
  const bookingId = Number(req.body.bookingId);
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
      `SELECT id, guest_email, total_amount, currency, status
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

    res.status(500).json({
      success: false,
      message: "Unable to initialize payment.",
    });
  }
});

// POST /api/payments/verify
router.post("/verify", async (req, res) => {
  const reference = req.body.reference;
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

    const paymentResult = await pool.query(
      `SELECT
         p.id AS payment_id,
         p.booking_id,
         p.amount,
         p.currency,
         p.status AS payment_status,
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
           b.status AS booking_status
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
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Payment verification failed:", error);

    res.status(500).json({
      success: false,
      message: "Unable to verify payment.",
    });
  }
});

export default router;
