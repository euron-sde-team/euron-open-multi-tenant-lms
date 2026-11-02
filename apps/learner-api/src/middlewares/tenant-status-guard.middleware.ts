import { Request, Response, NextFunction } from "express";

/**
 * Tenant status guard middleware for end-user (web) server.
 * Runs after tenantResolverMiddleware which sets req.tenant.
 *
 * - ACTIVE: full access (current behavior)
 * - SUSPENDED: read-only content access (GET/HEAD allowed, mutations blocked)
 * - CANCELLED: all requests blocked with offline message
 */
export const tenantStatusGuard = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.tenant) {
    // No tenant resolved, let downstream middleware/handlers deal with it
    return next();
  }

  if (req.tenant.isActive) {
    return next();
  }

  // SUSPENDED tenant: allow read-only content access for existing enrollments
  if (req.tenant.status === "SUSPENDED") {
    if (req.method === "GET" || req.method === "HEAD") {
      return next();
    }
    res.status(403).json({
      success: false,
      error: {
        message: "This academy is temporarily unavailable. Please try again later.",
      },
      statusCode: 403,
    });
    return;
  }

  // CANCELLED or any other non-active status: block everything
  res.status(503).json({
    success: false,
    error: {
      message: "This academy is currently offline.",
    },
    statusCode: 503,
  });
  return;
};
