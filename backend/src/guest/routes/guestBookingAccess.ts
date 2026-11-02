import { Router, type Request, type Response } from "express";
import {
  randomInt,
  randomBytes,
  createHmac,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { pool } from "../../config/db.js";
import { sendGuestBookingOtpEmail } from "../../config/emailService.js";

const router = Router();

const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_OTP_ATTEMPTS = 5;
const ACCESS_TOKEN_EXPIRY_MINUTES = 15;

function hashOtp(email: string, otp: string): string {
  const secret = process.env.GUEST_BOOKING_ACCESS_SECRET;

  if (!secret) {
    throw new Error("GUEST_BOOKING_ACCESS_SECRET is missing");
  }

  return createHmac("sha256", secret).update(`${email}:${otp}`).digest("hex");
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Request a six-digit verification code.
router.post(
  "/request-otp",
  async (req: Request, res: Response): Promise<void> => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (!email || !isValidEmail(email)) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
      return;
    }

    const client = await pool.connect();
    let otpHash: string | null = null;

    try {
      const bookingResult = await client.query(
        `SELECT EXISTS (
          SELECT 1
          FROM bookings
          WHERE user_id IS NULL
            AND LOWER(guest_email) = $1
        ) AS has_bookings`,
        [email],
      );

      const shouldSendEmail = bookingResult.rows[0].has_bookings;

      if (!shouldSendEmail) {
        res.status(200).json({
          success: true,
          message:
            "If guest bookings exist for this email, a verification code will be sent.",
        });
        return;
      }

      await client.query("BEGIN");

      const existingResult = await client.query(
        `SELECT
          id,
          request_count,
          request_window_started_at,
          last_sent_at
        FROM guest_booking_access_otps
        WHERE email = $1
        FOR UPDATE`,
        [email],
      );

      const existingOtp = existingResult.rows[0];

      if (existingOtp) {
        const secondsSinceLastRequest =
          (Date.now() - new Date(existingOtp.last_sent_at).getTime()) / 1000;

        if (secondsSinceLastRequest < RESEND_COOLDOWN_SECONDS) {
          await client.query("ROLLBACK");

          res.status(429).json({
            success: false,
            message: "Please wait before requesting another verification code.",
          });
          return;
        }

        const secondsSinceWindowStarted =
          (Date.now() -
            new Date(existingOtp.request_window_started_at).getTime()) /
          1000;

        const windowExpired = secondsSinceWindowStarted >= 3600;

        const requestCount = windowExpired
          ? 0
          : Number(existingOtp.request_count);

        if (requestCount >= MAX_REQUESTS_PER_HOUR) {
          await client.query("ROLLBACK");

          res.status(429).json({
            success: false,
            message:
              "You have reached the verification request limit. Please try again later.",
          });
          return;
        }
      }

      const otp = randomInt(100000, 1000000).toString();
      otpHash = hashOtp(email, otp);

      if (existingOtp) {
        const windowExpired =
          Date.now() -
            new Date(existingOtp.request_window_started_at).getTime() >=
          3600 * 1000;

        await client.query(
          `UPDATE guest_booking_access_otps
           SET otp_hash = $1,
               expires_at = NOW() + INTERVAL '5 minutes',
               attempts = 0,
               last_sent_at = NOW(),
               request_count = CASE
                 WHEN $2 THEN 1
                 ELSE request_count + 1
               END,
               request_window_started_at = CASE
                 WHEN $2 THEN NOW()
                 ELSE request_window_started_at
               END
           WHERE email = $3`,
          [otpHash, windowExpired, email],
        );
      } else {
        await client.query(
          `INSERT INTO guest_booking_access_otps (
            email,
            otp_hash,
            expires_at,
            attempts,
            last_sent_at,
            request_count,
            request_window_started_at
          )
          VALUES (
            $1,
            $2,
            NOW() + INTERVAL '5 minutes',
            0,
            NOW(),
            1,
            NOW()
          )`,
          [email, otpHash],
        );
      }

      await client.query("COMMIT");

      try {
        await sendGuestBookingOtpEmail(email, otp, OTP_EXPIRY_MINUTES);
      } catch (emailError) {
        await pool.query(
          `DELETE FROM guest_booking_access_otps
           WHERE email = $1 AND otp_hash = $2`,
          [email, otpHash],
        );

        console.error(
          "Guest booking OTP email could not be sent:",
          emailError instanceof Error
            ? emailError.message
            : "Unknown email error",
        );

        res.status(500).json({
          success: false,
          message:
            "Unable to send the verification email. Please try again later.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message:
          "If guest bookings exist for this email, a verification code will be sent.",
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);

      console.error(
        "Guest booking OTP request failed:",
        error instanceof Error ? error.message : "Unknown error",
      );

      res.status(500).json({
        success: false,
        message: "Unable to process your request. Please try again later.",
      });
    } finally {
      client.release();
    }
  },
);

// Verify the OTP and issue a short-lived access token.
router.post(
  "/verify-otp",
  async (req: Request, res: Response): Promise<void> => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const otp = typeof req.body?.otp === "string" ? req.body.otp.trim() : "";

    if (!isValidEmail(email) || !/^\d{6}$/.test(otp)) {
      res.status(400).json({
        success: false,
        message: "Please provide a valid email address and six-digit code.",
      });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT otp_hash, expires_at, attempts
         FROM guest_booking_access_otps
         WHERE email = $1
         FOR UPDATE`,
        [email],
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");

        res.status(400).json({
          success: false,
          message: "Invalid or expired verification code.",
        });
        return;
      }

      const otpRecord = result.rows[0];

      if (new Date(otpRecord.expires_at).getTime() <= Date.now()) {
        await client.query(
          "DELETE FROM guest_booking_access_otps WHERE email = $1",
          [email],
        );

        await client.query("COMMIT");

        res.status(400).json({
          success: false,
          message: "Invalid or expired verification code.",
        });
        return;
      }

      if (Number(otpRecord.attempts) >= MAX_OTP_ATTEMPTS) {
        await client.query(
          "DELETE FROM guest_booking_access_otps WHERE email = $1",
          [email],
        );

        await client.query("COMMIT");

        res.status(429).json({
          success: false,
          message: "Too many incorrect attempts. Please request a new code.",
        });
        return;
      }

      const submittedHash = hashOtp(email, otp);
      const storedHashBuffer = Buffer.from(otpRecord.otp_hash, "hex");
      const submittedHashBuffer = Buffer.from(submittedHash, "hex");

      const otpMatches =
        storedHashBuffer.length === submittedHashBuffer.length &&
        timingSafeEqual(storedHashBuffer, submittedHashBuffer);

      if (!otpMatches) {
        const newAttempts = Number(otpRecord.attempts) + 1;

        if (newAttempts >= MAX_OTP_ATTEMPTS) {
          await client.query(
            "DELETE FROM guest_booking_access_otps WHERE email = $1",
            [email],
          );
        } else {
          await client.query(
            `UPDATE guest_booking_access_otps
             SET attempts = $1
             WHERE email = $2`,
            [newAttempts, email],
          );
        }

        await client.query("COMMIT");

        res.status(newAttempts >= MAX_OTP_ATTEMPTS ? 429 : 400).json({
          success: false,
          message:
            newAttempts >= MAX_OTP_ATTEMPTS
              ? "Too many incorrect attempts. Please request a new code."
              : "Invalid or expired verification code.",
        });
        return;
      }

      const accessToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(accessToken).digest("hex");

      await client.query(
        `DELETE FROM guest_booking_access_sessions
         WHERE email = $1`,
        [email],
      );

      await client.query(
        `INSERT INTO guest_booking_access_sessions (
          email,
          token_hash,
          expires_at
        )
        VALUES (
          $1,
          $2,
          NOW() + INTERVAL '15 minutes'
        )`,
        [email, tokenHash],
      );

      await client.query(
        "DELETE FROM guest_booking_access_otps WHERE email = $1",
        [email],
      );

      await client.query("COMMIT");

      res.status(200).json({
        success: true,
        message: "Email verified successfully.",
        accessToken,
        expiresIn: ACCESS_TOKEN_EXPIRY_MINUTES * 60,
      });
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);

      console.error(
        "Guest booking OTP verification failed:",
        error instanceof Error ? error.message : "Unknown error",
      );

      res.status(500).json({
        success: false,
        message: "Unable to verify the code. Please try again later.",
      });
    } finally {
      client.release();
    }
  },
);

// Retrieve guest bookings using the verified email session.
router.get("/bookings", async (req: Request, res: Response): Promise<void> => {
  const authorization = req.headers.authorization ?? "";
  const tokenMatch = authorization.match(/^Bearer ([a-f0-9]{64})$/i);

  if (!tokenMatch) {
    res.status(401).json({
      success: false,
      message: "Please verify your email to access your bookings.",
    });
    return;
  }

  try {
    const accessToken = tokenMatch[1];

    const tokenHash = createHash("sha256").update(accessToken).digest("hex");

    const sessionResult = await pool.query(
      `SELECT email
         FROM guest_booking_access_sessions
         WHERE token_hash = $1
           AND expires_at > NOW()
         LIMIT 1`,
      [tokenHash],
    );

    if (sessionResult.rows.length === 0) {
      res.status(401).json({
        success: false,
        message:
          "Your booking access session is invalid or has expired. Please verify your email again.",
      });
      return;
    }

    const verifiedEmail = sessionResult.rows[0].email;

    const result = await pool.query(
      `
          SELECT
            b.id,
            b.booking_reference,
            b.check_in::text AS check_in,
            b.check_out::text AS check_out,
            (b.check_out - b.check_in)::integer AS nights,
            b.adults,
            b.children,
            b.status AS booking_status,
            b.total_amount,
            b.currency,
            b.created_at,
            b.guest_full_name,
            b.guest_email,
            b.guest_phone,
            hb.name AS branch_name,
            rt.name AS room_type_name,
            br.nightly_price,
            COALESCE(p.status, 'not_started') AS payment_status
          FROM bookings b
          INNER JOIN booking_rooms br ON br.booking_id = b.id
          INNER JOIN rooms r ON r.id = br.room_id
          INNER JOIN room_types rt ON rt.id = r.room_type_id
          INNER JOIN hotel_branches hb ON hb.id = rt.branch_id
          LEFT JOIN LATERAL (
            SELECT status
            FROM payments
            WHERE booking_id = b.id
            ORDER BY created_at DESC, id DESC
            LIMIT 1
          ) p ON TRUE
          WHERE b.user_id IS NULL
            AND LOWER(b.guest_email) = $1
          ORDER BY b.created_at DESC
        `,
      [verifiedEmail],
    );

    res.status(200).json({
      success: true,
      message: "Guest bookings retrieved successfully.",
      data: result.rows,
    });
  } catch (error) {
    console.error("Failed to retrieve guest bookings:", error);

    res.status(500).json({
      success: false,
      message: "Unable to retrieve your bookings.",
    });
  }
});

export default router;
