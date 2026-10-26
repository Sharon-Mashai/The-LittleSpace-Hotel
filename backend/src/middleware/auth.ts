
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { pool } from "../config/db.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: "guest" | "admin";
  };
}

interface TokenPayload extends JwtPayload {
  sub: string;
  role: "guest" | "admin";
}

async function verifyToken(
  req: AuthenticatedRequest,
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
      (decoded.role !== "guest" && decoded.role !== "admin")
    ) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
      return;
    }

    const payload = decoded as TokenPayload;

    const result = await pool.query(
      `SELECT id, role, is_active
       FROM users
       WHERE id = $1`,
      [payload.sub],
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      res.status(401).json({
        success: false,
        message: "User account not found or inactive.",
      });
      return;
    }

    const user = result.rows[0];

    if (user.role !== payload.role) {
      res.status(401).json({
        success: false,
        message: "Authentication token is no longer valid.",
      });
      return;
    }

    req.user = {
      id: String(user.id),
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("Authentication middleware failed:", error);

    res.status(500).json({
      success: false,
      message: "Authentication failed.",
    });
  }
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await verifyToken(req, res, next, false);
}

export async function optionalAuthenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await verifyToken(req, res, next, true);
}
