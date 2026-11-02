import { Request } from "express";
import { AuditActor } from "../types/audit-log.type";

/**
 * Build an AuditActor context object from an authenticated admin request.
 * Controllers call this and thread the result into the service layer so
 * mutations can be attributed in the audit log.
 */
export const buildAuditActor = (req: Request): AuditActor => {
  const forwarded = req.headers["x-forwarded-for"];
  const ipAddress =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim()) ||
    req.ip ||
    req.socket?.remoteAddress ||
    null;

  const userAgent = req.headers["user-agent"] ?? null;

  return {
    adminId: req.adminUser?.id ?? null,
    email: req.adminUser?.email ?? null,
    name: req.adminUser?.name ?? null,
    ipAddress,
    userAgent,
  };
};

/**
 * Build an AuditActor for an action where the acting admin is known explicitly
 * (e.g. LOGIN, there is no req.adminUser yet, but the resolved user is known).
 */
export const buildAuditActorFor = (
  req: Request,
  admin: { id: string; email: string; name: string }
): AuditActor => {
  const base = buildAuditActor(req);
  return {
    ...base,
    adminId: admin.id,
    email: admin.email,
    name: admin.name,
  };
};
