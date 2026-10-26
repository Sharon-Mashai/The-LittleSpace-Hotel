import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../config/db.js";

const router = Router();

const SALT_ROUNDS = 12;

function getJwtSecret(): string | null {
  return process.env.JWT_SECRET || null;
}

function createToken(
  user: { id: string | number; role: string },
  secret: string,
) {
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role,
    },
    secret,
    { expiresIn: "1h" },
  );
}

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const secret = getJwtSecret();

  if (!secret) {
    return res.status(500).json({
      success: false,
      message: "Authentication is not configured.",
    });
  }

  const fullName =
    typeof req.body.fullName === "string" ? req.body.fullName.trim() : "";

  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

  const password =
    typeof req.body.password === "string" ? req.body.password : "";

  const phone =
    typeof req.body.phone === "string" ? req.body.phone.trim() : null;

  if (!fullName || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Full name, email, and password are required.",
    });
  }

  if (fullName.length > 150 || email.length > 254) {
    return res.status(400).json({
      success: false,
      message: "Full name or email is too long.",
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Please provide a valid email address.",
    });
  }

  if (password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({
      success: false,
      message:
        "Password must be at least 8 characters and no more than 72 bytes.",
    });
  }

  try {
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1",
      [email],
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, phone)
       VALUES ($1, $2, $3, 'guest', $4)
       RETURNING id, full_name, email, role, phone, created_at`,
      [fullName, email, passwordHash, phone || null],
    );

    const user = result.rows[0];
    const token = createToken(user, secret);

    return res.status(201).json({
      success: true,
      message: "Guest account created successfully.",
      token,
      user,
    });
  } catch (error) {
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

    console.error("Failed to register user:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create your account.",
    });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const secret = getJwtSecret();

  if (!secret) {
    return res.status(500).json({
      success: false,
      message: "Authentication is not configured.",
    });
  }

  const email =
    typeof req.body.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

  const password =
    typeof req.body.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required.",
    });
  }

  try {
    const result = await pool.query(
      `SELECT id, full_name, email, password_hash, role, phone, is_active
       FROM users
       WHERE LOWER(email) = $1
       LIMIT 1`,
      [email],
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
        message: "Invalid email or password.",
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = createToken(user, secret);

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
      },
    });
  } catch (error) {
    console.error("Failed to log in user:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to log in.",
    });
  }
});

export default router;
