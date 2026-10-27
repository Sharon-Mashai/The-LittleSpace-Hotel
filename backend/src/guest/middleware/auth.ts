import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { pool } from "../../config/db.js";

export interface AuthenticatedGuestRequest extends Request {
  user?: {
    id: string;
    role: "guest";
  };
}

interface GuestTokenPayload extends JwtPayload {
  sub: string;
  role: "guest";
}

async function verifyGuestToken(
  req: AuthenticatedGuestRequest,
  res: Response,
  next: NextFunction,
  optional: boolean,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      if (optional) {
        next();
        return;
      }

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
      decoded.role !== "guest"
    ) {
      res.status(403).json({
        success: false,
        message: "Guest account access is required.",
      });
      return;
    }

    const payload = decoded as GuestTokenPayload;

    const result = await pool.query(
      `SELECT id, role, is_active
       FROM users
       WHERE id = $1`,
      [payload.sub],
    );

    if (
      result.rows.length === 0 ||
      !result.rows[0].is_active ||
      result.rows[0].role !== "guest"
    ) {
      res.status(401).json({
        success: false,
        message: "Guest account not found, inactive, or no longer valid.",
      });
      return;
    }

    req.user = {
      id: String(result.rows[0].id),
      role: "guest",
    };

    next();
  } catch (error) {
    console.error("Guest authentication middleware failed:", error);

    res.status(500).json({
      success: false,
      message: "Guest authentication failed.",
    });
  }
}

export async function authenticateGuest(
  req: AuthenticatedGuestRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await verifyGuestToken(req, res, next, false);
}

export async function optionalAuthenticateGuest(
  req: AuthenticatedGuestRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await verifyGuestToken(req, res, next, true);
}
