import { Router } from "express";
import { pool } from "../../config/db.js";
import type { PoolClient } from "pg";
import {
  uploadSingleImage,
  isSupportedImage,
} from "../../middleware/imageUpload.js";
import {
  authenticateAdmin,
  requirePermission,
  type AuthenticatedAdminRequest,
} from "../middleware/auth.js";

const router = Router();

type RoomTypeBody = Record<string, unknown>;

function parseInteger(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") {
    return Number(value);
  }
  return Number.NaN;
}

function parseFacilities(value: unknown): unknown {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function parseBoolean(value: unknown): boolean | null {
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  return null;
}

async function savePrimaryRoomTypeImage(
  client: PoolClient,
  roomTypeId: number,
  file: Express.Multer.File,
): Promise<void> {
  const existingPhoto = await client.query(
    `
      SELECT id
      FROM room_type_photos
      WHERE room_type_id = $1
        AND is_primary = TRUE
      ORDER BY id ASC
      LIMIT 1
      FOR UPDATE
    `,
    [roomTypeId],
  );

  if (existingPhoto.rows.length > 0) {
    await client.query(
      `
        UPDATE room_type_photos
        SET
          image_data = $1,
          mime_type = $2,
          file_size = $3,
          photo_url = $4
        WHERE id = $5
      `,
      [
        file.buffer,
        file.mimetype,
        file.size,
        `/api/room-types/photos/${existingPhoto.rows[0].id}/image`,
        existingPhoto.rows[0].id,
      ],
    );

    return;
  }

  const insertedPhoto = await client.query(
    `
      INSERT INTO room_type_photos (
        room_type_id,
        photo_url,
        image_data,
        mime_type,
        file_size,
        is_primary,
        display_order
      )
      VALUES ($1, $2, $3, $4, $5, TRUE, 0)
      RETURNING id
    `,
    [
      roomTypeId,
      "/api/room-types/photos/pending/image",
      file.buffer,
      file.mimetype,
      file.size,
    ],
  );

  const photoId = insertedPhoto.rows[0].id;

  await client.query(
    `
      UPDATE room_type_photos
      SET photo_url = $1
      WHERE id = $2
    `,
    [`/api/room-types/photos/${photoId}/image`, photoId],
  );
}

async function getRoomTypeImageUrl(
  client: PoolClient,
  roomTypeId: number,
): Promise<string | null> {
  const result = await client.query(
    `
      SELECT photo_url
      FROM room_type_photos
      WHERE room_type_id = $1
        AND is_primary = TRUE
      ORDER BY id ASC
      LIMIT 1
    `,
    [roomTypeId],
  );

  return result.rows[0]?.photo_url ?? null;
}

// GET /api/admin/room-types
// View all room types, including inactive room types.
router.get(
  "/",
  authenticateAdmin,
  requirePermission("room_types.view"),
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
          rt.updated_at,
          (
            SELECT rtp.photo_url
            FROM room_type_photos AS rtp
            WHERE rtp.room_type_id = rt.id
              AND rtp.is_primary = TRUE
            ORDER BY rtp.id ASC
            LIMIT 1
          ) AS image_url
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
// Create a room type and optionally save its primary image.
router.post(
  "/",
  authenticateAdmin,
  requirePermission("room_types.create"),
  uploadSingleImage,
  async (req: AuthenticatedAdminRequest, res) => {
    const body = (req.body ?? {}) as RoomTypeBody;

    const branchId = parseInteger(body.branchId);
    const capacityAdults = parseInteger(body.capacityAdults);
    const capacityChildren =
      body.capacityChildren === undefined
        ? 0
        : parseInteger(body.capacityChildren);
    const basePrice = parseInteger(body.basePrice);
    const facilities = body.facilities ?? [];

    const { name, description, currency = "ZAR", policies } = body;

    if (
      !Number.isSafeInteger(branchId) ||
      branchId <= 0 ||
      typeof name !== "string" ||
      !name.trim() ||
      !Number.isSafeInteger(capacityAdults) ||
      capacityAdults <= 0 ||
      !Number.isSafeInteger(capacityChildren) ||
      capacityChildren < 0 ||
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

    const parsedFacilities = parseFacilities(facilities);

    if (
      !Array.isArray(parsedFacilities) ||
      parsedFacilities.some(
        (facility: unknown) => typeof facility !== "string" || !facility.trim(),
      )
    ) {
      res.status(400).json({
        success: false,
        message: "Facilities must be an array of non-empty strings.",
      });
      return;
    }

    if (req.file && !isSupportedImage(req.file)) {
      res.status(400).json({
        success: false,
        message: "Please upload a valid JPEG, PNG or WebP image.",
      });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const branchResult = await client.query(
        `SELECT id FROM hotel_branches WHERE id = $1`,
        [branchId],
      );

      if (branchResult.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({
          success: false,
          message: "Hotel branch not found.",
        });
        return;
      }

      const result = await client.query(
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
          JSON.stringify(
            parsedFacilities.map((facility: string) => facility.trim()),
          ),
          typeof policies === "string" ? policies.trim() || null : null,
        ],
      );

      const roomType = result.rows[0];

      if (req.file) {
        await savePrimaryRoomTypeImage(client, roomType.id, req.file);
      }

      const imageUrl = await getRoomTypeImageUrl(client, roomType.id);

      await client.query("COMMIT");

      res.status(201).json({
        success: true,
        message: "Room type created successfully.",
        data: {
          ...roomType,
          image_url: imageUrl,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to create room type:", error);

      res.status(500).json({
        success: false,
        message: "Unable to create room type.",
      });
    } finally {
      client.release();
    }
  },
);

// PATCH /api/admin/room-types/:id
// Update room-type details, its primary image, or its active status.
router.patch(
  "/:id",
  authenticateAdmin,
  requirePermission("room_types.edit"),
  uploadSingleImage,
  async (req: AuthenticatedAdminRequest, res) => {
    const roomTypeId = Number(req.params.id);

    if (!Number.isSafeInteger(roomTypeId) || roomTypeId <= 0) {
      res.status(400).json({
        success: false,
        message: "A valid room type ID is required.",
      });
      return;
    }

    if (req.file && !isSupportedImage(req.file)) {
      res.status(400).json({
        success: false,
        message: "Please upload a valid JPEG, PNG or WebP image.",
      });
      return;
    }

    const body = (req.body ?? {}) as RoomTypeBody;

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

      let value = body[key];

      if (key === "branchId") {
        value = parseInteger(value);

        if (!Number.isSafeInteger(value) || Number(value) <= 0) {
          res.status(400).json({
            success: false,
            message: "branchId must be a positive integer.",
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

      if (["capacityAdults", "capacityChildren"].includes(key)) {
        value = parseInteger(value);

        if (
          !Number.isSafeInteger(value) ||
          (key === "capacityAdults" ? Number(value) <= 0 : Number(value) < 0)
        ) {
          res.status(400).json({
            success: false,
            message: `${key} has an invalid value.`,
          });
          return;
        }
      }

      if (key === "basePrice") {
        value = parseInteger(value);

        if (!Number.isFinite(value) || Number(value) < 0) {
          res.status(400).json({
            success: false,
            message: "basePrice must be a non-negative number.",
          });
          return;
        }
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

      if (key === "facilities") {
        value = parseFacilities(value);

        if (
          !Array.isArray(value) ||
          value.some(
            (facility: unknown) =>
              typeof facility !== "string" || !facility.trim(),
          )
        ) {
          res.status(400).json({
            success: false,
            message: "Facilities must be an array of non-empty strings.",
          });
          return;
        }

        value = JSON.stringify(
          value.map((facility: string) => facility.trim()),
        );
      }

      if (key === "isActive") {
        value = parseBoolean(value);

        if (value === null) {
          res.status(400).json({
            success: false,
            message: "isActive must be true or false.",
          });
          return;
        }
      }

      if (key === "name" && typeof value === "string") {
        value = value.trim();
      } else if (
        ["description", "policies"].includes(key) &&
        typeof value === "string"
      ) {
        value = value.trim() || null;
      }

      values.push(value);

      updates.push(
        key === "facilities"
          ? `${column} = $${values.length}::jsonb`
          : `${column} = $${values.length}`,
      );
    }

    if (updates.length === 0 && !req.file) {
      res.status(400).json({
        success: false,
        message: "Provide at least one field or image to update.",
      });
      return;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      if (Object.prototype.hasOwnProperty.call(body, "branchId")) {
        const branchResult = await client.query(
          `SELECT id FROM hotel_branches WHERE id = $1`,
          [Number(body.branchId)],
        );

        if (branchResult.rows.length === 0) {
          await client.query("ROLLBACK");
          res.status(404).json({
            success: false,
            message: "Hotel branch not found.",
          });
          return;
        }
      }

      let roomTypeResult;

      if (updates.length > 0) {
        values.push(roomTypeId);

        roomTypeResult = await client.query(
          `
            UPDATE room_types
            SET ${updates.join(", ")}, updated_at = NOW()
            WHERE id = $${values.length}
            RETURNING *
          `,
          values,
        );
      } else {
        roomTypeResult = await client.query(
          `SELECT * FROM room_types WHERE id = $1`,
          [roomTypeId],
        );
      }

      if (roomTypeResult.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({
          success: false,
          message: "Room type not found.",
        });
        return;
      }

      if (req.file) {
        await savePrimaryRoomTypeImage(client, roomTypeId, req.file);
      }

      const imageUrl = await getRoomTypeImageUrl(client, roomTypeId);

      await client.query("COMMIT");

      res.status(200).json({
        success: true,
        message: "Room type updated successfully.",
        data: {
          ...roomTypeResult.rows[0],
          image_url: imageUrl,
        },
      });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Failed to update room type:", error);

      res.status(500).json({
        success: false,
        message: "Unable to update room type.",
      });
    } finally {
      client.release();
    }
  },
);

export default router;
