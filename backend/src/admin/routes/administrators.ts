import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../../config/db.js";
import { authenticateAdmin, requireSuperAdmin } from "../middleware/auth.js";

const router = Router();

// GET /api/admin/administrators
// Only the Super Admin can view administrator accounts.
router.get("/", authenticateAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const search =
      typeof req.query.search === "string" ? req.query.search.trim() : "";

    const result = await pool.query(
      `
          SELECT
            id,
            full_name,
            email,
            phone,
            role,
            is_active,
            created_at,
            updated_at
          FROM users
          WHERE role IN ('admin', 'super_admin')
            AND (
              $1 = ''
              OR full_name ILIKE '%' || $1 || '%'
              OR email ILIKE '%' || $1 || '%'
            )
          ORDER BY created_at DESC, id DESC
        `,
      [search],
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error("Failed to retrieve administrator accounts:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve administrator accounts.",
    });
  }
});

// POST /api/admin/administrators
// Only the Super Admin can create an administrator account.
router.post("/", authenticateAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const { fullName, email, password, phone } = req.body ?? {};

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
      `
          INSERT INTO users (
            full_name,
            email,
            password_hash,
            phone,
            role
          )
          VALUES ($1, $2, $3, $4, 'admin')
          RETURNING
            id,
            full_name,
            email,
            phone,
            role,
            is_active,
            created_at
        `,
      [fullName.trim(), normalizedEmail, passwordHash, normalizedPhone],
    );

    return res.status(201).json({
      success: true,
      message: "Administrator account created successfully.",
      data: result.rows[0],
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

    console.error("Failed to create administrator account:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to create administrator account.",
    });
  }
});

export default router;
