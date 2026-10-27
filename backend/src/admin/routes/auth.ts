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

// Log in to an existing administrator account
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

    if (user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Administrator access is required.",
      });
    }

    if (!user.is_active || !user.password_hash) {
      return res.status(401).json({
        success: false,
        message: "This administrator account cannot log in.",
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
      { sub: String(user.id), role: "admin" },
      getJwtSecret(),
      { expiresIn: "1h" },
    );

    return res.status(200).json({
      success: true,
      message: "Administrator login successful.",
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
    console.error("Administrator login failed:", error);

    return res.status(500).json({
      success: false,
      message: "Administrator login failed.",
    });
  }
});

export default router;
