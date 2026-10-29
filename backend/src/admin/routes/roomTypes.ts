import { Router } from "express";
import { pool } from "../../config/db.js";
import { authenticateAdmin, type AuthenticatedAdminRequest,} from "../middleware/auth.js";

const router = Router();

// GET /api/admin/room-types
// View all room types, including inactive room types.
router.get(
  "/",
  authenticateAdmin,
  async (_req: AuthenticatedAdminRequest, res) => {
    try {
      const result = await pool.query(`
        SELECT
          rt.id,
          rt.branch_id,
          hb.name AS branch_name,
          hb.city AS branch_city,
          rt.name,
          rt.description,
          rt.capacity_adults,
          rt.capacity_children,
          rt.base_price,
          rt.currency,
          rt.facilities,
          rt.policies,
          rt.is_active,
          rt.created_at,
          rt.updated_at
        FROM room_types AS rt
        INNER JOIN hotel_branches AS hb
          ON hb.id = rt.branch_id
        ORDER BY hb.name ASC, rt.name ASC
      `);

      res.status(200).json({
        success: true,
        count: result.rows.length,
        data: result.rows,
      });
    } catch (error) {
      console.error("Failed to retrieve admin room types:", error);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve room types.",
      });
    }
  },
);

// POST /api/admin/room-types
// Create a room type for an existing accommodation.
router.post(
  "/",
  authenticateAdmin,
  async (req: AuthenticatedAdminRequest, res) => {
    const {
      branchId,
      name,
      description,
      capacityAdults,
      capacityChildren = 0,
      basePrice,
      currency = "ZAR",
      facilities = [],
      policies,
    } = req.body ?? {};

    if (
      !Number.isSafeInteger(branchId) ||
      branchId <= 0 ||
      typeof name !== "string" ||
      !name.trim() ||
      !Number.isSafeInteger(capacityAdults) ||
      capacityAdults <= 0 ||
      !Number.isSafeInteger(capacityChildren) ||
      capacityChildren < 0 ||
      typeof basePrice !== "number" ||
      !Number.isFinite(basePrice) ||
      basePrice < 0 ||
      typeof currency !== "string" ||
      !/^[A-Z]{3}$/.test(currency)
    ) {
      res.status(400).json({
        success: false,
        message:
          "Provide a valid branchId, name, adult and child capacities, basePrice, and three-letter currency code.",
      });
      return;
    }

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Description must be a string or null.",
      });
      return;
    }

    if (
      policies !== undefined &&
      policies !== null &&
      typeof policies !== "string"
    ) {
      res.status(400).json({
        success: false,
        message: "Policies must be a string or null.",
      });
      return;
    }

    if (!Array.isArray(facilities)) {
      res.status(400).json({
        success: false,
        message: "Facilities must be an array.",
      });
      return;
    }

    if (
      facilities.some(
        (facility: unknown) => typeof facility !== "string" || !facility.trim(),
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Each facility must be a non-empty string.",
      });
      return;
    }

    try {
      const branchResult = await pool.query(
        `SELECT id FROM hotel_branches WHERE id = $1`,
        [branchId],
      );

      if (branchResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: "Hotel branch not found.",
        });
        return;
      }

      const result = await pool.query(
        `
          INSERT INTO room_types (
            branch_id,
            name,
            description,
            capacity_adults,
            capacity_children,
            base_price,
            currency,
            facilities,
            policies
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
          RETURNING *
        `,
        [
          branchId,
          name.trim(),
          typeof description === "string" ? description.trim() || null : null,
          capacityAdults,
          capacityChildren,
          basePrice,
          currency,
          JSON.stringify(facilities.map((facility: string) => facility.trim())),
          typeof policies === "string" ? policies.trim() || null : null,
        ],
      );

      res.status(201).json({
        success: true,
        message: "Room type created successfully.",
        data: result.rows[0],
      });
    } catch (error) {
      console.error("Failed to create room type:", error);

      res.status(500).json({
        success: false,
        message: "Unable to create room type.",
      });
    }
  },
);

// PATCH /api/admin/room-types/:id
// Update room-type details or activate/deactivate a room type.
router.patch(
  "/:id",
  authenticateAdmin,
  async (req: AuthenticatedAdminRequest, res) => {
    const roomTypeId = Number(req.params.id);

    if (!Number.isSafeInteger(roomTypeId) || roomTypeId <= 0) {
      res.status(400).json({
        success: false,
        message: "A valid room type ID is required.",
      });
      return;
    }

    const body = req.body ?? {};

    const fields: Record<string, string> = {
      branchId: "branch_id",
      name: "name",
      description: "description",
      capacityAdults: "capacity_adults",
      capacityChildren: "capacity_children",
      basePrice: "base_price",
      currency: "currency",
      facilities: "facilities",
      policies: "policies",
      isActive: "is_active",
    };

    const updates: string[] = [];
    const values: unknown[] = [];

    for (const [key, column] of Object.entries(fields)) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) {
        continue;
      }

      const value = body[key];

      if (key === "branchId") {
        if (!Number.isSafeInteger(value) || value <= 0) {
          res.status(400).json({
            success: false,
            message: "branchId must be a positive integer.",
          });
          return;
        }

        const branchResult = await pool.query(
          `SELECT id FROM hotel_branches WHERE id = $1`,
          [value],
        );

        if (branchResult.rows.length === 0) {
          res.status(404).json({
            success: false,
            message: "Hotel branch not found.",
          });
          return;
        }
      }

      if (key === "name" && (typeof value !== "string" || !value.trim())) {
        res.status(400).json({
          success: false,
          message: "Name must be a non-empty string.",
        });
        return;
      }

      if (
        ["description", "policies"].includes(key) &&
        value !== null &&
        typeof value !== "string"
      ) {
        res.status(400).json({
          success: false,
          message: `${key} must be a string or null.`,
        });
        return;
      }

      if (
        ["capacityAdults", "capacityChildren"].includes(key) &&
        (!Number.isSafeInteger(value) ||
          (key === "capacityAdults" ? value <= 0 : value < 0))
      ) {
        res.status(400).json({
          success: false,
          message: `${key} has an invalid value.`,
        });
        return;
      }

      if (
        key === "basePrice" &&
        (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      ) {
        res.status(400).json({
          success: false,
          message: "basePrice must be a non-negative number.",
        });
        return;
      }

      if (
        key === "currency" &&
        (typeof value !== "string" || !/^[A-Z]{3}$/.test(value))
      ) {
        res.status(400).json({
          success: false,
          message: "Currency must be a three-letter uppercase code.",
        });
        return;
      }

      if (
        key === "facilities" &&
        (!Array.isArray(value) ||
          value.some(
            (facility: unknown) =>
              typeof facility !== "string" || !facility.trim(),
          ))
      ) {
        res.status(400).json({
          success: false,
          message: "Facilities must be an array of non-empty strings.",
        });
        return;
      }

      if (key === "isActive" && typeof value !== "boolean") {
        res.status(400).json({
          success: false,
          message: "isActive must be true or false.",
        });
        return;
      }

      let normalizedValue: unknown = value;

      if (key === "name" && typeof value === "string") {
        normalizedValue = value.trim();
      } else if (
        ["description", "policies"].includes(key) &&
        typeof value === "string"
      ) {
        normalizedValue = value.trim() || null;
      } else if (key === "facilities") {
        normalizedValue = JSON.stringify(
          value.map((facility: string) => facility.trim()),
        );
      }

      values.push(normalizedValue);

      updates.push(
        key === "facilities"
          ? `${column} = $${values.length}::jsonb`
          : `${column} = $${values.length}`,
      );
    }

    if (updates.length === 0) {
      res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update.",
      });
      return;
    }

    values.push(roomTypeId);

    try {
      const result = await pool.query(
        `
          UPDATE room_types
          SET ${updates.join(", ")}, updated_at = NOW()
          WHERE id = $${values.length}
          RETURNING *
        `,
        values,
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: "Room type not found.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Room type updated successfully.",
        data: result.rows[0],
      });
    } catch (error) {
      console.error("Failed to update room type:", error);

      res.status(500).json({
        success: false,
        message: "Unable to update room type.",
      });
    }
  },
);

export default router;
