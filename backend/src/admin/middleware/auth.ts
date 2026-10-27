import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { pool } from "../../config/db.js";

export interface AuthenticatedAdminRequest extends Request {
  user?: {
    id: string;
    role: "admin";
  };
}

interface AdminTokenPayload extends JwtPayload {
  sub: string;
  role: "admin";
}

export async function authenticateAdmin(
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: "Authentication token is required.",
      });
      return;
    }

    if (!authHeader.startsWith("Bearer ") || !authHeader.slice(7).trim()) {
      res.status(401).json({
        success: false,
        message: "Invalid authorization header.",
      });
      return;
    }

    const token = authHeader.slice(7).trim();
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      console.error("JWT_SECRET is not configured.");

      res.status(500).json({
        success: false,
        message: "Authentication service is not configured.",
      });
      return;
    }

    let decoded: string | JwtPayload;

    try {
      decoded = jwt.verify(token, secret);
    } catch {
      res.status(401).json({
        success: false,
        message: "Invalid or expired authentication token.",
      });
      return;
    }

    if (
      typeof decoded === "string" ||
      typeof decoded.sub !== "string" ||
      decoded.role !== "admin"
    ) {
      res.status(403).json({
        success: false,
        message: "Administrator privileges are required.",
      });
      return;
    }

    const payload = decoded as AdminTokenPayload;

    const result = await pool.query(
      `SELECT id, role, is_active
       FROM users
       WHERE id = $1`,
      [payload.sub],
    );

    if (
      result.rows.length === 0 ||
      !result.rows[0].is_active ||
      result.rows[0].role !== "admin"
    ) {
      res.status(401).json({
        success: false,
        message:
          "Administrator account not found, inactive, or no longer valid.",
      });
      return;
    }

    req.user = {
      id: String(result.rows[0].id),
      role: "admin",
    };

    next();
  } catch (error) {
    console.error("Admin authentication middleware failed:", error);

    res.status(500).json({
      success: false,
      message: "Administrator authentication failed.",
    });
  }
}
