import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { pool } from "../../config/db.js";

export type AdminRole = "admin" | "super_admin";

export interface AuthenticatedAdminRequest extends Request {
  user?: {
    id: string;
    role: AdminRole;
  };
}

interface AdminTokenPayload {
  sub: string;
  role: AdminRole;
}

export async function authenticateAdmin(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Authentication token is missing.",
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      return res.status(500).json({
        success: false,
        message: "Server authentication is not configured.",
      });
    }

    const decoded = jwt.verify(token, secret) as AdminTokenPayload;

    if (
      !decoded.sub ||
      (decoded.role !== "admin" && decoded.role !== "super_admin")
    ) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this resource.",
      });
    }

    const result = await pool.query(
      `SELECT id, role, is_active
       FROM users
       WHERE id = $1`,
      [decoded.sub],
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "User account was not found.",
      });
    }

    const user = result.rows[0];

    if (
      !user.is_active ||
      (user.role !== "admin" && user.role !== "super_admin") ||
      user.role !== decoded.role
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your account does not have permission to access this resource.",
      });
    }

    req.user = {
      id: String(user.id),
      role: user.role as AdminRole,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
    }

    console.error("Admin authentication error:", error);

    return res.status(500).json({
      success: false,
      message: "An error occurred during authentication.",
    });
  }
}
