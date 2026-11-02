import { Router } from "express";
import {
  verifyUnsubscribeToken,
  confirmUnsubscribe,
} from "../controllers/email-unsubscribe.controller";
import { asyncHandler } from "../utils/asynchandler";

/**
 * Public unsubscribe endpoints: Phase 11.
 *
 * Mounted at `/email/unsubscribe`. NO auth middleware: the unsubscribe JWT
 * in `req.body.token` IS the auth boundary. Verifying the signature proves
 * the caller has a legitimate (mailed-out) link.
 *
 * NO tenant resolver middleware either: the token encodes the tenantId, so
 * we don't need host-based tenant resolution. This route is reachable on
 * any host (the web app at `/u/[token]` calls these endpoints server-side).
 */
const emailUnsubscribeRouter: Router = Router();

emailUnsubscribeRouter.post("/verify", asyncHandler(verifyUnsubscribeToken));
emailUnsubscribeRouter.post("/confirm", asyncHandler(confirmUnsubscribe));

export default emailUnsubscribeRouter;
