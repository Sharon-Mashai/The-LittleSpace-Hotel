import { Router } from "express";
import { pool } from "../../config/db.js";
import { authenticateGuest, type AuthenticatedGuestRequest,} from "../middleware/auth.js";

const router = Router();

// GET /api/notifications
// Retrieve notifications belonging to the logged-in guest.
router.get(
  "/",
  authenticateGuest,
  async (req: AuthenticatedGuestRequest, res) => {
    try {
      const result = await pool.query(
        `
          SELECT
            id,
            title,
            message,
            type,
            data,
            read_at,
            created_at
          FROM notifications
          WHERE user_id = $1
          ORDER BY created_at DESC, id DESC
        `,
        [req.user!.id],
      );

      res.status(200).json({
        success: true,
        count: result.rows.length,
        unreadCount: result.rows.filter(
          (notification) => notification.read_at === null,
        ).length,
        data: result.rows,
      });
    } catch (error) {
      console.error("Failed to retrieve notifications:", error);

      res.status(500).json({
        success: false,
        message: "Unable to retrieve notifications",
      });
    }
  },
);

// PATCH /api/notifications/read-all
// Mark all unread notifications belonging to the guest as read.
router.patch(
  "/read-all",
  authenticateGuest,
  async (req: AuthenticatedGuestRequest, res) => {
    try {
      const result = await pool.query(
        `
          UPDATE notifications
          SET read_at = NOW()
          WHERE user_id = $1
            AND read_at IS NULL
          RETURNING id
        `,
        [req.user!.id],
      );

      res.status(200).json({
        success: true,
        message: "All notifications have been marked as read.",
        updatedCount: result.rowCount ?? 0,
      });
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);

      res.status(500).json({
        success: false,
        message: "Unable to mark notifications as read",
      });
    }
  },
);

// PATCH /api/notifications/:notificationId/read
// Mark one notification as read, but only if it belongs to the guest.
router.patch(
  "/:notificationId/read",
  authenticateGuest,
  async (req: AuthenticatedGuestRequest, res) => {
    const notificationId = String(req.params.notificationId);

    if (!/^[1-9]\d*$/.test(notificationId)) {
      res.status(400).json({
        success: false,
        message: "A valid notification ID is required.",
      });
      return;
    }

    try {
      const result = await pool.query(
        `
          UPDATE notifications
          SET read_at = COALESCE(read_at, NOW())
          WHERE id = $1
            AND user_id = $2
          RETURNING id, read_at
        `,
        [notificationId, req.user!.id],
      );

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: "Notification not found.",
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: "Notification marked as read.",
        data: result.rows[0],
      });
    } catch (error) {
      console.error("Failed to mark notification as read:", error);

      res.status(500).json({
        success: false,
        message: "Unable to mark notification as read",
      });
    }
  },
);

export default router;
