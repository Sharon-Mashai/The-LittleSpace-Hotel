import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../../config/db.js";

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
      { sub: String(user.id), role: "guest" },
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

// Log in to an existing guest account
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

    if (user.role !== "guest") {
      return res.status(403).json({
        success: false,
        message: "Please use the appropriate login for your account.",
      });
    }

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
      { sub: String(user.id), role: "guest" },
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
    console.error("Guest login failed:", error);

    return res.status(500).json({
      success: false,
      message: "Login failed.",
    });
  }
});

export default router;
