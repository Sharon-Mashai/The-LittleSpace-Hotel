import { Router, type Response } from "express";
import { pool } from "../../config/db.js";
import { authenticateGuest, type AuthenticatedGuestRequest,} from "../middleware/auth.js";

const router = Router();

// All favourites routes require an authenticated guest.
router.use(authenticateGuest);

// GET /api/favourites
// Return the logged-in guest's saved accommodations.
router.get(
  "/",
  async (req: AuthenticatedGuestRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      const result = await pool.query(
        `SELECT
           f.branch_id,
           f.created_at AS favourited_at,
           b.name,
           b.slug,
           b.description,
           b.address_line,
           b.suburb,
           b.city,
           b.province,
           b.star_rating,
           b.is_active
         FROM favourites f
         JOIN hotel_branches b ON b.id = f.branch_id
         WHERE f.user_id = $1
         ORDER BY f.created_at DESC`,
        [userId],
      );

      res.status(200).json({
        success: true,
        message: "Favourites retrieved successfully.",
        data: result.rows,
      });
    } catch (error) {
      console.error("Failed to retrieve favourites:", error);

      res.status(500).json({
        success: false,
        message: "Could not retrieve favourites.",
      });
    }
  },
);

// POST /api/favourites/:branchId
// Add an accommodation to the logged-in guest's favourites.
router.post(
  "/:branchId",
  async (req: AuthenticatedGuestRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const branchId = String(req.params.branchId);

      if (!/^[1-9]\d*$/.test(branchId)) {
        res.status(400).json({
          success: false,
          message: "A valid accommodation ID is required.",
        });
        return;
      }

      const branchResult = await pool.query(
        `SELECT id
         FROM hotel_branches
         WHERE id = $1 AND is_active = TRUE`,
        [branchId],
      );

      if (branchResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: "Active accommodation not found.",
        });
        return;
      }

      const existingFavourite = await pool.query(
        `SELECT 1
         FROM favourites
         WHERE user_id = $1 AND branch_id = $2`,
        [userId, branchId],
      );

      if (existingFavourite.rows.length > 0) {
        res.status(409).json({
          success: false,
          message: "This accommodation is already in your favourites.",
        });
        return;
      }

      await pool.query(
        `INSERT INTO favourites (user_id, branch_id)
         VALUES ($1, $2)`,
        [userId, branchId],
      );

      res.status(201).json({
        success: true,
        message: "Accommodation added to favourites.",
        data: {
          branchId,
        },
      });
    } catch (error) {
      // Handle duplicate entries if the database has a unique constraint.
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      ) {
        res.status(409).json({
          success: false,
          message: "This accommodation is already in your favourites.",
        });
        return;
      }

      console.error("Failed to add favourite:", error);

      res.status(500).json({
        success: false,
        message: "Could not add accommodation to favourites.",
      });
    }
  },
);

// DELETE /api/favourites/:branchId
// Remove an accommodation from the logged-in guest's favourites.
router.delete(
  "/:branchId",
  async (req: AuthenticatedGuestRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const branchId = String(req.params.branchId);

      if (!/^[1-9]\d*$/.test(branchId)) {
        res.status(400).json({
          success: false,
          message: "A valid accommodation ID is required.",
        });
        return;
      }

      const result = await pool.query(
        `DELETE FROM favourites
         WHERE user_id = $1 AND branch_id = $2
         RETURNING branch_id`,
        [userId, branchId],
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: "This accommodation is not in your favourites.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Accommodation removed from favourites.",
        data: {
          branchId: String(result.rows[0].branch_id),
        },
      });
    } catch (error) {
      console.error("Failed to remove favourite:", error);

      res.status(500).json({
        success: false,
        message: "Could not remove accommodation from favourites.",
      });
    }
  },
);

export default router;
