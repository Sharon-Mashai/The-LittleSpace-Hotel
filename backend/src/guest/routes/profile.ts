import { Router } from "express";
import { pool } from "../../config/db.js";
import { authenticateGuest, type AuthenticatedGuestRequest,} from "../middleware/auth.js";

const router = Router();

// GET /api/profile
// Retrieve the logged-in guest's profile.
router.get(
  "/",
  authenticateGuest,
  async (req: AuthenticatedGuestRequest, res) => {
    try {
      const result = await pool.query(
        `
          SELECT
            id,
            full_name,
            email,
            phone,
            created_at
          FROM users
          WHERE id = $1
            AND role = 'guest'
            AND is_active = TRUE
        `,
        [req.user!.id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: "Guest profile not found.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result.rows[0],
      });
    } catch (error) {
      console.error("Failed to retrieve guest profile:", error);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve guest profile.",
      });
    }
  },
);

// PATCH /api/profile
// Update the logged-in guest's name and/or phone number.
router.patch(
  "/",
  authenticateGuest,
  async (req: AuthenticatedGuestRequest, res) => {
    const body = req.body ?? {};
    const hasFullName = Object.hasOwn(body, "fullName");
    const hasPhone = Object.hasOwn(body, "phone");

    if (!hasFullName && !hasPhone) {
      res.status(400).json({
        success: false,
        message: "Provide a fullName or phone field to update.",
      });
      return;
    }

    let fullName: string | null = null;
    let phone: string | null = null;

    if (hasFullName) {
      if (
        typeof body.fullName !== "string" ||
        body.fullName.trim().length < 2 ||
        body.fullName.trim().length > 150
      ) {
        res.status(400).json({
          success: false,
          message: "Full name must be between 2 and 150 characters.",
        });
        return;
      }

      fullName = body.fullName.trim();
    }

    if (hasPhone) {
      if (body.phone === null || body.phone === "") {
        phone = null;
      } else if (
        typeof body.phone === "string" &&
        body.phone.trim().length >= 7 &&
        body.phone.trim().length <= 30
      ) {
        phone = body.phone.trim();
      } else {
        res.status(400).json({
          success: false,
          message:
            "Phone must be between 7 and 30 characters, or null to clear it.",
        });
        return;
      }
    }

    try {
      const result = await pool.query(
        `
          UPDATE users
          SET
            full_name = CASE
              WHEN $2::boolean THEN $3::varchar
              ELSE full_name
            END,
            phone = CASE
              WHEN $4::boolean THEN $5::varchar
              ELSE phone
            END,
            updated_at = NOW()
          WHERE id = $1
            AND role = 'guest'
            AND is_active = TRUE
          RETURNING
            id,
            full_name,
            email,
            phone,
            created_at,
            updated_at
        `,
        [req.user!.id, hasFullName, fullName, hasPhone, phone],
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: "Guest profile not found.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Profile updated successfully.",
        data: result.rows[0],
      });
    } catch (error) {
      console.error("Failed to update guest profile:", error);

      res.status(500).json({
        success: false,
        message: "Unable to update guest profile.",
      });
    }
  },
);

export default router;
