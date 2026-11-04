import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../../config/db.js";
import {
  authenticateAdmin,
  requireSuperAdmin,
  type AuthenticatedAdminRequest,
} from "../middleware/auth.js";
import {
  ADMIN_PERMISSIONS,
  type AdminPermission,
} from "../routes/permissions.js";

const router = Router();

const validPermissionKeys = new Set<string>(
  ADMIN_PERMISSIONS.map((permission: { key: string }) => permission.key),
);

function validatePermissions(permissions: unknown): AdminPermission[] | null {
  if (!Array.isArray(permissions)) {
    return null;
  }

  if (
    !permissions.every((permission: unknown) => {
      return (
        typeof permission === "string" && validPermissionKeys.has(permission)
      );
    })
  ) {
    return null;
  }

  return [...new Set(permissions)] as AdminPermission[];
}

function getAdminId(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function isValidAdminId(adminId: string): boolean {
  return /^\d+$/.test(adminId) && BigInt(adminId) > 0n;
}

// GET /api/admin/administrators/me/permissions
router.get(
  "/me/permissions",
  authenticateAdmin,
  async (req: AuthenticatedAdminRequest, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: "Authentication is required.",
        });
      }

      if (req.user.role === "super_admin") {
        return res.status(200).json({
          success: true,
          data: {
            userId: req.user.id,
            role: req.user.role,
            permissions: ADMIN_PERMISSIONS.map((permission) => permission.key),
          },
        });
      }

      const result = await pool.query(
        `
          SELECT permission
          FROM admin_permissions
          WHERE user_id = $1
          ORDER BY permission ASC
        `,
        [req.user.id],
      );

      return res.status(200).json({
        success: true,
        data: {
          userId: req.user.id,
          role: req.user.role,
          permissions: result.rows.map(
            (row: { permission: string }) => row.permission,
          ),
        },
      });
    } catch (error) {
      console.error("Failed to retrieve own administrator permissions:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to retrieve your permissions.",
      });
    }
  },
);

// GET /api/admin/administrators/permissions
router.get(
  "/permissions",
  authenticateAdmin,
  requireSuperAdmin,
  (_req, res) => {
    return res.status(200).json({
      success: true,
      count: ADMIN_PERMISSIONS.length,
      data: ADMIN_PERMISSIONS,
    });
  },
);

// GET /api/admin/administrators/:adminId/permissions
router.get(
  "/:adminId/permissions",
  authenticateAdmin,
  requireSuperAdmin,
  async (req, res) => {
    try {
      const adminId = getAdminId(req.params.adminId);

      if (adminId === null || !isValidAdminId(adminId)) {
        return res.status(400).json({
          success: false,
          message: "A valid administrator ID is required.",
        });
      }

      const adminResult = await pool.query(
        `
          SELECT id, full_name, email, role
          FROM users
          WHERE id = $1
            AND role = 'admin'
        `,
        [adminId],
      );

      if (adminResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Administrator account not found.",
        });
      }

      const permissionsResult = await pool.query(
        `
          SELECT permission
          FROM admin_permissions
          WHERE user_id = $1
          ORDER BY permission ASC
        `,
        [adminId],
      );

      return res.status(200).json({
        success: true,
        data: {
          administrator: adminResult.rows[0],
          permissions: permissionsResult.rows.map(
            (row: { permission: string }) => row.permission,
          ),
        },
      });
    } catch (error) {
      console.error("Failed to retrieve administrator permissions:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to retrieve administrator permissions.",
      });
    }
  },
);

// PUT /api/admin/administrators/:adminId/permissions
router.put(
  "/:adminId/permissions",
  authenticateAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const adminId = getAdminId(req.params.adminId);
    const permissions = validatePermissions(req.body?.permissions);

    if (adminId === null || !isValidAdminId(adminId)) {
      return res.status(400).json({
        success: false,
        message: "A valid administrator ID is required.",
      });
    }

    if (permissions === null) {
      return res.status(400).json({
        success: false,
        message: "Permissions must be an array of valid permission keys.",
      });
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const adminResult = await client.query(
        `
          SELECT id, full_name, email, role
          FROM users
          WHERE id = $1
            AND role = 'admin'
          FOR UPDATE
        `,
        [adminId],
      );

      if (adminResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Administrator account not found.",
        });
      }

      await client.query(`DELETE FROM admin_permissions WHERE user_id = $1`, [
        adminId,
      ]);

      for (const permission of permissions) {
        await client.query(
          `
            INSERT INTO admin_permissions (user_id, permission)
            VALUES ($1, $2)
          `,
          [adminId, permission],
        );
      }

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Administrator permissions updated successfully.",
        data: {
          administrator: adminResult.rows[0],
          permissions,
        },
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK");
      }

      console.error("Failed to update administrator permissions:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to update administrator permissions.",
      });
    } finally {
      client?.release();
    }
  },
);

// PUT /api/admin/administrators/:adminId
// Update an ordinary Admin's name, email and phone number.
router.put(
  "/:adminId",
  authenticateAdmin,
  requireSuperAdmin,
  async (req, res) => {
    const adminId = getAdminId(req.params.adminId);
    const { fullName, email, phone } = req.body ?? {};

    if (adminId === null || !isValidAdminId(adminId)) {
      return res.status(400).json({
        success: false,
        message: "A valid administrator ID is required.",
      });
    }

    if (
      typeof fullName !== "string" ||
      !fullName.trim() ||
      typeof email !== "string" ||
      !email.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Full name and email are required.",
      });
    }

    if (phone !== undefined && phone !== null && typeof phone !== "string") {
      return res.status(400).json({
        success: false,
        message: "Phone must be a string or null.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone =
      typeof phone === "string" && phone.trim() ? phone.trim() : null;

    try {
      const result = await pool.query(
        `
          UPDATE users
          SET
            full_name = $1,
            email = $2,
            phone = $3,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
            AND role = 'admin'
          RETURNING
            id,
            full_name,
            email,
            phone,
            role,
            is_active,
            created_at,
            updated_at
        `,
        [fullName.trim(), normalizedEmail, normalizedPhone, adminId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Administrator account not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Administrator details updated successfully.",
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

      console.error("Failed to update administrator:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to update administrator details.",
      });
    }
  },
);

// PATCH /api/admin/administrators/:adminId/status
// Enable or disable an ordinary Admin account.
router.patch(
  "/:adminId/status",
  authenticateAdmin,
  requireSuperAdmin,
  async (req: AuthenticatedAdminRequest, res) => {
    const adminId = getAdminId(req.params.adminId);
    const { isActive } = req.body ?? {};

    if (adminId === null || !isValidAdminId(adminId)) {
      return res.status(400).json({
        success: false,
        message: "A valid administrator ID is required.",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false.",
      });
    }

    if (req.user && adminId === req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You cannot change your own Super Admin account status.",
      });
    }

    try {
      const result = await pool.query(
        `
          UPDATE users
          SET
            is_active = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
            AND role = 'admin'
          RETURNING
            id,
            full_name,
            email,
            phone,
            role,
            is_active,
            updated_at
        `,
        [isActive, adminId],
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Administrator account not found.",
        });
      }

      return res.status(200).json({
        success: true,
        message: isActive
          ? "Administrator account enabled successfully."
          : "Administrator account disabled successfully.",
        data: result.rows[0],
      });
    } catch (error) {
      console.error("Failed to update administrator account status:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to update administrator account status.",
      });
    }
  },
);

// DELETE /api/admin/administrators/:adminId
// Delete an ordinary Admin only when no bookings or reviews reference the account.
router.delete(
  "/:adminId",
  authenticateAdmin,
  requireSuperAdmin,
  async (req: AuthenticatedAdminRequest, res) => {
    const adminId = getAdminId(req.params.adminId);

    if (adminId === null || !isValidAdminId(adminId)) {
      return res.status(400).json({
        success: false,
        message: "A valid administrator ID is required.",
      });
    }

    if (req.user && adminId === req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete your own Super Admin account.",
      });
    }

    let client;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const adminResult = await client.query(
        `
          SELECT id, full_name, email
          FROM users
          WHERE id = $1
            AND role = 'admin'
          FOR UPDATE
        `,
        [adminId],
      );

      if (adminResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Administrator account not found.",
        });
      }

      const bookingsResult = await client.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM bookings
            WHERE user_id = $1
          ) AS has_bookings
        `,
        [adminId],
      );

      const reviewsResult = await client.query(
        `
          SELECT EXISTS (
            SELECT 1
            FROM reviews
            WHERE user_id = $1
          ) AS has_reviews
        `,
        [adminId],
      );

      const hasBookings = bookingsResult.rows[0].has_bookings;
      const hasReviews = reviewsResult.rows[0].has_reviews;

      if (hasBookings || hasReviews) {
        await client.query("ROLLBACK");

        const reasons: string[] = [];

        if (hasBookings) {
          reasons.push("bookings");
        }

        if (hasReviews) {
          reasons.push("reviews");
        }

        return res.status(409).json({
          success: false,
          message: `This administrator cannot be deleted because the account is linked to existing ${reasons.join(" and ")}. Disable the account instead.`,
        });
      }

      await client.query(`DELETE FROM users WHERE id = $1 AND role = 'admin'`, [
        adminId,
      ]);

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Administrator account deleted successfully.",
        data: {
          id: adminId,
        },
      });
    } catch (error: unknown) {
      if (client) {
        await client.query("ROLLBACK");
      }

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23503"
      ) {
        return res.status(409).json({
          success: false,
          message:
            "This account is linked to existing records and cannot be deleted. Disable the account instead.",
        });
      }

      console.error("Failed to delete administrator account:", error);

      return res.status(500).json({
        success: false,
        message: "Unable to delete administrator account.",
      });
    } finally {
      client?.release();
    }
  },
);

// GET /api/admin/administrators
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
router.post("/", authenticateAdmin, requireSuperAdmin, async (req, res) => {
  const { fullName, email, password, phone, permissions = [] } = req.body ?? {};

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

  const validatedPermissions = validatePermissions(permissions);

  if (validatedPermissions === null) {
    return res.status(400).json({
      success: false,
      message: "Permissions must be an array of valid permission keys.",
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPhone = typeof phone === "string" ? phone.trim() : null;

  let client;

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    client = await pool.connect();
    await client.query("BEGIN");

    const result = await client.query(
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

    const administrator = result.rows[0];

    for (const permission of validatedPermissions) {
      await client.query(
        `
          INSERT INTO admin_permissions (user_id, permission)
          VALUES ($1, $2)
        `,
        [administrator.id, permission],
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Administrator account created successfully.",
      data: {
        ...administrator,
        permissions: validatedPermissions,
      },
    });
  } catch (error: unknown) {
    if (client) {
      await client.query("ROLLBACK");
    }

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
  } finally {
    client?.release();
  }
});

export default router;
