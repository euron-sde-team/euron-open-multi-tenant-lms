import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import config from "../config";
import { UnauthorizedError } from "../errors/unauthorized.error";
import logger from "../utils/logger";
import sessionService from "../services/session.service";
import { LEARNER_TOKEN_TYPE } from "../types/auth.type";

interface LearnerClaims {
  id: string;
  type?: string;
  tenantId?: string;
  email?: string;
  sessionToken?: string;
}

/**
 * Verifies a learner token for THIS request's tenant. Signed with the learner
 * secret, carrying type "learner", and issued by the tenant the host resolved
 * to: a token from another storefront, or a staff/operator token, never passes.
 */
function verifyLearnerToken(token: string, req: Request): LearnerClaims & { tenantId: string } {
  const decoded = jwt.verify(token, config.LEARNER_JWT_SECRET) as LearnerClaims;
  if (decoded.type !== LEARNER_TOKEN_TYPE) {
    throw new UnauthorizedError("Invalid token");
  }
  if (!req.tenant?.id || !decoded.tenantId || decoded.tenantId !== req.tenant.id) {
    throw new UnauthorizedError("Token does not belong to this site");
  }
  return { ...decoded, tenantId: decoded.tenantId };
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new UnauthorizedError("No token provided");
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyLearnerToken(token, req);

    // Validate session if present (new tokens); legacy tokens without sessionToken pass through
    if (decoded.sessionToken) {
      await sessionService.validateSession(decoded.sessionToken);
      sessionService.touchSession(decoded.sessionToken);
    }

    req.user = {
      id: decoded.id,
      tenantId: decoded.tenantId,
      email: decoded.email ?? "",
      sessionToken: decoded.sessionToken,
    };
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    logger.error(error);
    throw new UnauthorizedError("Invalid token");
  }
};

/**
 * Optional authentication, populates req.user when a valid token is present,
 * but silently continues without error when absent or invalid.
 * Use on public endpoints that can optionally enrich responses for logged-in users.
 */
export const optionalAuth = async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return next();

  const token = authHeader.split(" ")[1];
  if (!token) return next();

  try {
    const decoded = verifyLearnerToken(token, req);

    if (decoded.sessionToken) {
      try {
        await sessionService.validateSession(decoded.sessionToken);
        sessionService.touchSession(decoded.sessionToken);
      } catch {
        // Invalid session, proceed as unauthenticated
        return next();
      }
    }

    req.user = {
      id: decoded.id,
      tenantId: decoded.tenantId,
      email: decoded.email ?? "",
      sessionToken: decoded.sessionToken,
    };
  } catch {
    // Invalid token, proceed as unauthenticated
  }
  next();
};
