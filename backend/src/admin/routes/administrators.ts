import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../../config/db.js";
import { authenticateAdmin, requireSuperAdmin } from "../middleware/auth.js";
import { ADMIN_PERMISSIONS, type AdminPermission } from "../routes/permissions.js";

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

// GET /api/admin/administrators/permissions
// Return all available permission definitions.
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
// Return permissions assigned to one ordinary Admin.
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
// Replace all permissions assigned to one ordinary Admin.
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

      await client.query(
        `
          DELETE FROM admin_permissions
          WHERE user_id = $1
        `,
        [adminId],
      );

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
// Create an Admin account and its initial permissions in one transaction.
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
