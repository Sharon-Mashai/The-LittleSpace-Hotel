import { Router } from "express";
import { pool } from "../../config/db.js";
import { authenticateAdmin, type AuthenticatedAdminRequest,} from "../middleware/auth.js";

const router = Router();

// GET /api/admin/branches
// View all branches, including inactive branches.
router.get( "/", authenticateAdmin,
  async (_req: AuthenticatedAdminRequest, res) => {
    try {
      const result = await pool.query(
        `
          SELECT
            id,
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
            star_rating,
            is_active,
            created_at,
            updated_at
          FROM hotel_branches
          ORDER BY city ASC, name ASC
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
// Create a hotel branch.
router.post(
  "/",
  authenticateAdmin,
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
      latitude,
      longitude,
      starRating,
    } = req.body ?? {};

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
      (latitude !== undefined &&
        latitude !== null &&
        (typeof latitude !== "number" ||
          !Number.isFinite(latitude) ||
          latitude < -90 ||
          latitude > 90)) ||
      (longitude !== undefined &&
        longitude !== null &&
        (typeof longitude !== "number" ||
          !Number.isFinite(longitude) ||
          longitude < -180 ||
          longitude > 180)) ||
      (starRating !== undefined &&
        starRating !== null &&
        (typeof starRating !== "number" ||
          !Number.isFinite(starRating) ||
          starRating < 0 ||
          starRating > 5))
    ) {
      res.status(400).json({
        success: false,
        message: "Latitude, longitude or star rating has an invalid value.",
      });
      return;
    }

    try {
      const result = await pool.query(
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
          RETURNING *
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

      res.status(201).json({
        success: true,
        message: "Hotel branch created successfully.",
        data: result.rows[0],
      });
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
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
    }
  },
);

// PATCH /api/admin/branches/:id
// Update branch details or activate/deactivate a branch.
router.patch(
  "/:id",
  authenticateAdmin,
  async (req: AuthenticatedAdminRequest, res) => {
    const branchId = Number(req.params.id);

    if (!Number.isSafeInteger(branchId) || branchId <= 0) {
      res.status(400).json({
        success: false,
        message: "A valid branch ID is required.",
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

      const value = body[key];

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

      if (
        ["latitude", "longitude", "starRating"].includes(key) &&
        value !== null &&
        (typeof value !== "number" || !Number.isFinite(value))
      ) {
        res.status(400).json({
          success: false,
          message: `${key} must be a valid number or null.`,
        });
        return;
      }

      if (key === "latitude" && value !== null && (value < -90 || value > 90)) {
        res.status(400).json({
          success: false,
          message: "Latitude must be between -90 and 90.",
        });
        return;
      }

      if (
        key === "longitude" &&
        value !== null &&
        (value < -180 || value > 180)
      ) {
        res.status(400).json({
          success: false,
          message: "Longitude must be between -180 and 180.",
        });
        return;
      }

      if (key === "starRating" && value !== null && (value < 0 || value > 5)) {
        res.status(400).json({
          success: false,
          message: "Star rating must be between 0 and 5.",
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

      let normalizedValue = value;

      if (key === "slug" && typeof value === "string") {
        normalizedValue = value.trim().toLowerCase();
      } else if (typeof value === "string") {
        normalizedValue = value.trim() || null;
      }

      values.push(normalizedValue);
      updates.push(`${column} = $${values.length}`);
    }

    if (updates.length === 0) {
      res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update.",
      });
      return;
    }

    values.push(branchId);

    try {
      const result = await pool.query(
        `
          UPDATE hotel_branches
          SET ${updates.join(", ")}, updated_at = NOW()
          WHERE id = $${values.length}
          RETURNING *
        `,
        values,
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: "Hotel branch not found.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Hotel branch updated successfully.",
        data: result.rows[0],
      });
    } catch (error: unknown) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
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
    }
  },
);

export default router;
