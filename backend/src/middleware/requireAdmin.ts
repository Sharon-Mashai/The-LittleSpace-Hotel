
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "./auth.js";

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
    return;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({
      success: false,
      message: "Access denied. Administrator privileges are required.",
    });
    return;
  }

  next();
}
