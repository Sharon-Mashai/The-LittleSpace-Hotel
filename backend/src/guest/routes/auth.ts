import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { pool } from "../../config/db.js";
import { sendPasswordResetEmail } from "../../config/emailService.js";

const router = Router();
const googleClient = new OAuth2Client();

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

// Google sign-in for guest accounts
router.post("/google", async (req, res) => {
  try {
    const { credential } = req.body;

    if (typeof credential !== "string" || !credential.trim()) {
      return res.status(400).json({
        success: false,
        message: "A Google ID token is required.",
      });
    }

    const googleClientId = process.env.GOOGLE_CLIENT_ID;

    if (!googleClientId) {
      console.error("GOOGLE_CLIENT_ID is not configured.");

      return res.status(500).json({
        success: false,
        message: "Google sign-in is not configured.",
      });
    }

    // Verify the Google ID token and its intended audience.
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();

    if (
      !payload ||
      !payload.sub ||
      !payload.email ||
      payload.email_verified !== true
    ) {
      return res.status(401).json({
        success: false,
        message: "The Google account could not be verified.",
      });
    }

    const googleSubject = payload.sub;
    const normalizedEmail = payload.email.trim().toLowerCase();

    const fullName =
      typeof payload.name === "string" && payload.name.trim()
        ? payload.name.trim()
        : normalizedEmail.split("@")[0];

    // First, look for an account already linked to this Google identity.
    const linkedUserResult = await pool.query(
      `SELECT id, full_name, email, role, phone, is_active, created_at
       FROM users
       WHERE oauth_provider = 'google'
         AND oauth_subject = $1
       LIMIT 1`,
      [googleSubject],
    );

    if (linkedUserResult.rows.length > 0) {
      const user = linkedUserResult.rows[0];

      // Google sign-in is only permitted for guest accounts.
      if (user.role !== "guest") {
        return res.status(403).json({
          success: false,
          message: "Google sign-in is only available for guest accounts.",
        });
      }

      if (!user.is_active) {
        return res.status(403).json({
          success: false,
          message: "This account is inactive.",
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
        message: "Google sign-in successful.",
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
    }

    // Do not automatically link Google to an existing email account.
    // This protects existing guest and administrator accounts.
    const existingEmailResult = await pool.query(
      `SELECT id, role
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [normalizedEmail],
    );

    if (existingEmailResult.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists. Please sign in using your existing login method.",
      });
    }

    // Create a new guest account linked to the verified Google identity.
    // ON CONFLICT handles simultaneous registration attempts safely.
    const newUserResult = await pool.query(
      `INSERT INTO users
         (full_name, email, role, oauth_provider, oauth_subject)
       VALUES ($1, $2, 'guest', 'google', $3)
       ON CONFLICT DO NOTHING
       RETURNING id, full_name, email, role, phone, created_at`,
      [fullName, normalizedEmail, googleSubject],
    );

    if (newUserResult.rows.length === 0) {
      // Another request may have created the same Google identity
      // between our initial lookup and this insert.
      const concurrentUserResult = await pool.query(
        `SELECT id, full_name, email, role, phone, is_active, created_at
         FROM users
         WHERE oauth_provider = 'google'
           AND oauth_subject = $1
         LIMIT 1`,
        [googleSubject],
      );

      if (concurrentUserResult.rows.length === 0) {
        return res.status(409).json({
          success: false,
          message:
            "An account with this email already exists. Please sign in using your existing login method.",
        });
      }

      const user = concurrentUserResult.rows[0];

      if (user.role !== "guest" || !user.is_active) {
        return res.status(403).json({
          success: false,
          message: "This account cannot sign in using Google.",
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
        message: "Google sign-in successful.",
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
    }

    const user = newUserResult.rows[0];

    const token = jwt.sign(
      {
        sub: String(user.id),
        role: user.role,
      },
      getJwtSecret(),
      { expiresIn: "1h" },
    );

    return res.status(201).json({
      success: true,
      message: "Guest account created successfully using Google.",
      token,
      user,
    });
  } catch (error) {
    console.error("Google sign-in failed:", error);

    return res.status(401).json({
      success: false,
      message: "Google sign-in failed. Please try again.",
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
