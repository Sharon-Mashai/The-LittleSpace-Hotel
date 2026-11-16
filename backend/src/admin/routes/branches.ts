import { Router } from "express";
import type { PoolClient } from "pg";
import { pool } from "../../config/db.js";
import {
  authenticateAdmin,
  requirePermission,
  type AuthenticatedAdminRequest,
} from "../middleware/auth.js";
import {
  uploadSingleImage,
  isSupportedImage,
} from "../../middleware/imageUpload.js";

const router = Router();

function parseOptionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  return Number.NaN;
}

function getErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return undefined;
}

// Save or replace the primary branch image inside an existing transaction.
async function savePrimaryBranchImage(
  client: PoolClient,
  branchId: number,
  file: Express.Multer.File,
  caption: string,
): Promise<string> {
  const existingPhoto = await client.query(
    `
      SELECT id
      FROM accommodation_photos
      WHERE branch_id = $1
        AND is_primary = TRUE
      ORDER BY display_order ASC, id ASC
      LIMIT 1
      FOR UPDATE
    `,
    [branchId],
  );

  let photoId: number;

  if (existingPhoto.rows.length > 0) {
    photoId = Number(existingPhoto.rows[0].id);

    await client.query(
      `
        UPDATE accommodation_photos
        SET
          image_data = $1,
          mime_type = $2,
          file_size = $3,
          caption = $4,
          photo_url = $5
        WHERE id = $6
      `,
      [
        file.buffer,
        file.mimetype,
        file.size,
        caption,
        `/api/accommodations/photos/${photoId}/image`,
        photoId,
      ],
    );
  } else {
    const photoResult = await client.query(
      `
        INSERT INTO accommodation_photos (
          branch_id,
          photo_url,
          caption,
          is_primary,
          display_order,
          image_data,
          mime_type,
          file_size
        )
        VALUES ($1, $2, $3, TRUE, 0, $4, $5, $6)
        RETURNING id
      `,
      [
        branchId,
        "/api/accommodations/photos/pending/image",
        caption,
        file.buffer,
        file.mimetype,
        file.size,
      ],
    );

    photoId = Number(photoResult.rows[0].id);

    await client.query(
      `
        UPDATE accommodation_photos
        SET photo_url = $1
        WHERE id = $2
      `,
      [`/api/accommodations/photos/${photoId}/image`, photoId],
    );
  }

  return `/api/accommodations/photos/${photoId}/image`;
}

// Retrieve a branch together with its primary image URL.
async function getBranchWithImage(client: PoolClient, branchId: number) {
  const result = await client.query(
    `
      SELECT
        hb.*,
        (
          SELECT ap.photo_url
          FROM accommodation_photos ap
          WHERE ap.branch_id = hb.id
            AND ap.is_primary = TRUE
          ORDER BY ap.display_order ASC, ap.id ASC
          LIMIT 1
        ) AS image_url
      FROM hotel_branches hb
      WHERE hb.id = $1
    `,
    [branchId],
  );

  return result.rows[0];
}

// GET /api/admin/branches
// View all branches, including inactive branches.
router.get(
  "/",
  authenticateAdmin,
  requirePermission("branches.view"),
  async (_req: AuthenticatedAdminRequest, res) => {
    try {
      const result = await pool.query(
        `
          SELECT
            hb.id,
            hb.name,
            hb.slug,
            hb.description,
            hb.address_line,
            hb.suburb,
            hb.city,
            hb.province,
            hb.country,
            hb.postal_code,
            hb.latitude,
            hb.longitude,
            hb.star_rating,
            hb.is_active,
            hb.created_at,
            hb.updated_at,
            (
              SELECT ap.photo_url
              FROM accommodation_photos ap
              WHERE ap.branch_id = hb.id
                AND ap.is_primary = TRUE
              ORDER BY ap.display_order ASC, ap.id ASC
              LIMIT 1
            ) AS image_url
          FROM hotel_branches hb
          ORDER BY hb.city ASC, hb.name ASC
        `,
      );

      res.status(200).json({
        success: true,
        count: result.rows.length,
        data: result.rows,
      });
    } catch (error) {
      console.error("Failed to retrieve admin branches:", error);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve hotel branches.",
      });
    }
  },
);

// POST /api/admin/branches
// Create a hotel branch, optionally with an image.
router.post(
  "/",
  authenticateAdmin,
  requirePermission("branches.create"),
  uploadSingleImage,
  async (req: AuthenticatedAdminRequest, res) => {
    const {
      name,
      slug,
      description,
      addressLine,
      suburb,
      city,
      province,
      country = "South Africa",
      postalCode,
    } = req.body ?? {};

    const latitude = parseOptionalNumber(req.body?.latitude);
    const longitude = parseOptionalNumber(req.body?.longitude);
    const starRating = parseOptionalNumber(req.body?.starRating);

    const uploadedImage = req.file;

    if (uploadedImage && !isSupportedImage(uploadedImage)) {
      res.status(400).json({
        success: false,
        message: "Only valid JPEG, PNG and WebP images are allowed.",
      });
      return;
    }

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof slug !== "string" ||
      !slug.trim() ||
      typeof addressLine !== "string" ||
      !addressLine.trim() ||
      typeof city !== "string" ||
      !city.trim() ||
      typeof country !== "string" ||
      !country.trim()
    ) {
      res.status(400).json({
        success: false,
        message: "Name, slug, address line, city and country are required.",
      });
      return;
    }

    const optionalTextFields = [
      ["description", description],
      ["suburb", suburb],
      ["province", province],
      ["postalCode", postalCode],
    ] as const;

    for (const [field, value] of optionalTextFields) {
      if (value !== undefined && value !== null && typeof value !== "string") {
        res.status(400).json({
          success: false,
          message: `${field} must be a string when provided.`,
        });
        return;
      }
    }

    if (
      Number.isNaN(latitude) ||
      (latitude !== undefined &&
        latitude !== null &&
        (latitude < -90 || latitude > 90)) ||
      Number.isNaN(longitude) ||
      (longitude !== undefined &&
        longitude !== null &&
        (longitude < -180 || longitude > 180)) ||
      Number.isNaN(starRating) ||
      (starRating !== undefined &&
        starRating !== null &&
        (starRating < 0 || starRating > 5))
    ) {
      res.status(400).json({
        success: false,
        message: "Latitude, longitude or star rating has an invalid value.",
      });
      return;
    }

    let client: PoolClient | undefined;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      const result = await client.query(
        `
          INSERT INTO hotel_branches (
            name,
            slug,
            description,
            address_line,
            suburb,
            city,
            province,
            country,
            postal_code,
            latitude,
            longitude,
            star_rating
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
          )
          RETURNING id
        `,
        [
          name.trim(),
          slug.trim().toLowerCase(),
          typeof description === "string" ? description.trim() || null : null,
          addressLine.trim(),
          typeof suburb === "string" ? suburb.trim() || null : null,
          city.trim(),
          typeof province === "string" ? province.trim() || null : null,
          country.trim(),
          typeof postalCode === "string" ? postalCode.trim() || null : null,
          latitude ?? null,
          longitude ?? null,
          starRating ?? null,
        ],
      );

      const branchId = Number(result.rows[0].id);

      if (uploadedImage) {
        await savePrimaryBranchImage(
          client,
          branchId,
          uploadedImage,
          name.trim(),
        );
      }

      const branch = await getBranchWithImage(client, branchId);

      await client.query("COMMIT");

      res.status(201).json({
        success: true,
        message: "Hotel branch created successfully.",
        data: branch,
      });
    } catch (error: unknown) {
      if (client) {
        await client.query("ROLLBACK");
      }

      if (getErrorCode(error) === "23505") {
        res.status(409).json({
          success: false,
          message: "A branch with this unique value already exists.",
        });
        return;
      }

      console.error("Failed to create hotel branch:", error);

      res.status(500).json({
        success: false,
        message: "Unable to create hotel branch.",
      });
    } finally {
      client?.release();
    }
  },
);

// PATCH /api/admin/branches/:id
// Update branch details, replace its image, or activate/deactivate it.
router.patch(
  "/:id",
  authenticateAdmin,
  requirePermission("branches.edit"),
  uploadSingleImage,
  async (req: AuthenticatedAdminRequest, res) => {
    const branchId = Number(req.params.id);

    if (!Number.isSafeInteger(branchId) || branchId <= 0) {
      res.status(400).json({
        success: false,
        message: "A valid branch ID is required.",
      });
      return;
    }

    const uploadedImage = req.file;

    if (uploadedImage && !isSupportedImage(uploadedImage)) {
      res.status(400).json({
        success: false,
        message: "Only valid JPEG, PNG and WebP images are allowed.",
      });
      return;
    }

    const fields: Record<string, string> = {
      name: "name",
      slug: "slug",
      description: "description",
      addressLine: "address_line",
      suburb: "suburb",
      city: "city",
      province: "province",
      country: "country",
      postalCode: "postal_code",
      latitude: "latitude",
      longitude: "longitude",
      starRating: "star_rating",
      isActive: "is_active",
    };

    const updates: string[] = [];
    const values: unknown[] = [];
    const body = req.body ?? {};

    for (const [key, column] of Object.entries(fields)) {
      if (!Object.prototype.hasOwnProperty.call(body, key)) {
        continue;
      }

      let value: unknown = body[key];

      if (
        ["name", "slug", "addressLine", "city", "country"].includes(key) &&
        (typeof value !== "string" || !value.trim())
      ) {
        res.status(400).json({
          success: false,
          message: `${key} must be a non-empty string.`,
        });
        return;
      }

      if (
        ["description", "suburb", "province", "postalCode"].includes(key) &&
        value !== null &&
        typeof value !== "string"
      ) {
        res.status(400).json({
          success: false,
          message: `${key} must be a string or null.`,
        });
        return;
      }

      if (["latitude", "longitude", "starRating"].includes(key)) {
        value = parseOptionalNumber(value);

        if (value === undefined || Number.isNaN(value)) {
          res.status(400).json({
            success: false,
            message: `${key} must be a valid number or null.`,
          });
          return;
        }
      }

      if (
        key === "latitude" &&
        value !== null &&
        (Number(value) < -90 || Number(value) > 90)
      ) {
        res.status(400).json({
          success: false,
          message: "Latitude must be between -90 and 90.",
        });
        return;
      }

      if (
        key === "longitude" &&
        value !== null &&
        (Number(value) < -180 || Number(value) > 180)
      ) {
        res.status(400).json({
          success: false,
          message: "Longitude must be between -180 and 180.",
        });
        return;
      }

      if (
        key === "starRating" &&
        value !== null &&
        (Number(value) < 0 || Number(value) > 5)
      ) {
        res.status(400).json({
          success: false,
          message: "Star rating must be between 0 and 5.",
        });
        return;
      }

      if (key === "isActive") {
        if (value === "true") {
          value = true;
        } else if (value === "false") {
          value = false;
        }

        if (typeof value !== "boolean") {
          res.status(400).json({
            success: false,
            message: "isActive must be true or false.",
          });
          return;
        }
      }

      let normalizedValue = value;

      if (key === "slug" && typeof value === "string") {
        normalizedValue = value.trim().toLowerCase();
      } else if (typeof value === "string") {
        normalizedValue = value.trim() || null;
      }

      values.push(normalizedValue);
      updates.push(`${column} = $${values.length}`);
    }

    if (updates.length === 0 && !uploadedImage) {
      res.status(400).json({
        success: false,
        message: "Provide at least one field or an image to update.",
      });
      return;
    }

    let client: PoolClient | undefined;

    try {
      client = await pool.connect();
      await client.query("BEGIN");

      if (updates.length > 0) {
        values.push(branchId);

        const result = await client.query(
          `
            UPDATE hotel_branches
            SET ${updates.join(", ")}, updated_at = NOW()
            WHERE id = $${values.length}
            RETURNING id
          `,
          values,
        );

        if (result.rows.length === 0) {
          await client.query("ROLLBACK");

          res.status(404).json({
            success: false,
            message: "Hotel branch not found.",
          });
          return;
        }
      } else {
        const branchExists = await client.query(
          "SELECT id FROM hotel_branches WHERE id = $1",
          [branchId],
        );

        if (branchExists.rows.length === 0) {
          await client.query("ROLLBACK");

          res.status(404).json({
            success: false,
            message: "Hotel branch not found.",
          });
          return;
        }
      }

      if (uploadedImage) {
        const branchName = await client.query(
          "SELECT name FROM hotel_branches WHERE id = $1",
          [branchId],
        );

        await savePrimaryBranchImage(
          client,
          branchId,
          uploadedImage,
          branchName.rows[0].name,
        );
      }

      const branch = await getBranchWithImage(client, branchId);

      await client.query("COMMIT");

      res.status(200).json({
        success: true,
        message: "Hotel branch updated successfully.",
        data: branch,
      });
    } catch (error: unknown) {
      if (client) {
        await client.query("ROLLBACK");
      }

      if (getErrorCode(error) === "23505") {
        res.status(409).json({
          success: false,
          message: "A branch with this unique value already exists.",
        });
        return;
      }

      console.error("Failed to update hotel branch:", error);

      res.status(500).json({
        success: false,
        message: "Unable to update hotel branch.",
      });
    } finally {
      client?.release();
    }
  },
);

export default router;
