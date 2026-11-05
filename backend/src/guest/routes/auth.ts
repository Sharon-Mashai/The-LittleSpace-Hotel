import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import { pool } from "../../config/db.js";
import { sendPasswordResetEmail } from "../../config/emailService.js";

const router = Router();

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return secret;
}

// Register a new guest account
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, phone } = req.body;

    if (
      typeof fullName !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !fullName.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Full name, email and password are required.",
      });
    }

    if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long.",
      });
    }

    if (
      phone !== undefined &&
      phone !== null &&
      (typeof phone !== "string" || !phone.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Phone must be a non-empty string when provided.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = typeof phone === "string" ? phone.trim() : null;

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, phone, role)
       VALUES ($1, $2, $3, $4, 'guest')
       RETURNING id, full_name, email, role, phone, created_at`,
      [fullName.trim(), normalizedEmail, passwordHash, normalizedPhone],
    );

    const user = result.rows[0];

    const token = jwt.sign(
      { sub: String(user.id), role: user.role },
      getJwtSecret(),
      { expiresIn: "1h" },
    );

    return res.status(201).json({
      success: true,
      message: "Guest account created successfully.",
      token,
      user,
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    console.error("Registration failed:", error);

    return res.status(500).json({
      success: false,
      message: "Registration failed.",
    });
  }
});

// Shared login for guests, administrators and the Super Admin
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, role, phone,
              is_active, created_at
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email.trim()],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const user = result.rows[0];

    if (!user.is_active || !user.password_hash) {
      return res.status(401).json({
        success: false,
        message: "This account cannot log in with these credentials.",
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = jwt.sign(
      {
        sub: String(user.id),
        role: user.role,
      },
      getJwtSecret(),
      { expiresIn: "1h" },
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        created_at: user.created_at,
      },
    });
  } catch (error) {
    console.error("Shared login failed:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed.",
    });
  }
});

// Request a password reset link for a guest account
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (typeof email !== "string" || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required.",
      });
    }

    const frontendUrl = process.env.FRONTEND_URL;

    if (!frontendUrl) {
      throw new Error("FRONTEND_URL is not configured.");
    }

    const resetUrl = new URL("/reset-password", frontendUrl);

    const userResult = await pool.query(
      `SELECT id, email
       FROM users
       WHERE LOWER(email) = LOWER($1)
         AND role = 'guest'
         AND is_active = TRUE
       LIMIT 1`,
      [email.trim()],
    );

    // Use the same response whether or not the account exists.
    // This prevents people from discovering registered email addresses.
    if (userResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message:
          "If an active guest account exists for that email, a password reset link has been sent.",
      });
    }

    const user = userResult.rows[0];

    // Generate a secure random token.
    const resetToken = randomBytes(32).toString("hex");

    // Store only the token hash in the database.
    const tokenHash = createHash("sha256").update(resetToken).digest("hex");

    // Invalidate any previous unused reset tokens for this guest.
    await pool.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = $1
         AND used_at IS NULL`,
      [user.id],
    );

    // Save the new token with a 30-minute expiry.
    await pool.query(
      `INSERT INTO password_reset_tokens
         (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
      [user.id, tokenHash],
    );

    resetUrl.searchParams.set("token", resetToken);

    try {
      await sendPasswordResetEmail(user.email, resetUrl.toString(), 30);
    } catch (emailError) {
      // Invalidate the token if the email could not be sent.
      await pool.query(
        `UPDATE password_reset_tokens
         SET used_at = NOW()
         WHERE token_hash = $1
           AND used_at IS NULL`,
        [tokenHash],
      );

      console.error("Password reset email failed:", emailError);

      return res.status(500).json({
        success: false,
        message:
          "Unable to send the password reset email. Please try again later.",
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "If an active guest account exists for that email, a password reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password request failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to process your password reset request.",
    });
  }
});

// Reset a guest account password using a valid reset token
router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body;

  if (
    typeof token !== "string" ||
    !token.trim() ||
    typeof password !== "string" ||
    !password
  ) {
    return res.status(400).json({
      success: false,
      message: "Reset token and new password are required.",
    });
  }

  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters long.",
    });
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");

  let client;

  try {
    client = await pool.connect();

    await client.query("BEGIN");

    // Lock the token row so it cannot be used by two requests at once.
    const tokenResult = await client.query(
      `SELECT id, user_id
       FROM password_reset_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       LIMIT 1
       FOR UPDATE`,
      [tokenHash],
    );

    if (tokenResult.rows.length === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message:
          "This password reset link is invalid, expired or has already been used.",
      });
    }

    const resetRecord = tokenResult.rows[0];

    const passwordHash = await bcrypt.hash(password, 12);

    // Update the password only for an active guest account.
    const userUpdate = await client.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2
         AND role = 'guest'
         AND is_active = TRUE`,
      [passwordHash, resetRecord.user_id],
    );

    if (userUpdate.rowCount !== 1) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "This password reset link is invalid or cannot be used.",
      });
    }

    // Mark all outstanding reset tokens for this guest as used.
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = $1
         AND used_at IS NULL`,
      [resetRecord.user_id],
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message:
        "Your password has been reset successfully. You can now sign in.",
    });
  } catch (error) {
    if (client) {
      await client.query("ROLLBACK").catch(() => undefined);
    }

    console.error("Password reset failed:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to reset your password. Please try again.",
    });
  } finally {
    client?.release();
  }
});

export default router;
