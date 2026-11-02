/**
 * Email engine, public barrel export.
 *
 * Call sites import from this barrel:
 *
 *   import emailEngine from "../services/email-engine";
 *
 *   const result = await emailEngine.sendThroughEngine({
 *     tenantId,
 *     category: "TRANSACTIONAL",
 *     to,
 *     subject,
 *     html,
 *     text,
 *     idempotencyKey: `otp:${otpId}`,
 *   });
 *   if (result.mode === "legacy") {
 *     // existing legacy SES call unchanged; legacy FROM stays as
 *     // `"{tenantName} <{config.legacyFromEmail}>"`
 *   }
 */

export { sendThroughEngine, type SendInput, type SendResult } from "./sender";
export {
  resolveSender,
  invalidate,
  type ResolveResult,
  type ResolvedCustomSender,
  type ResolvedLegacy,
  type Category,
} from "./resolver";
export { checkGate, type EmailCategory, type TenantSendingStatus } from "./category-gate";
export {
  isSuppressed,
  addSuppression,
  removeSuppression,
  listSuppressions,
  type AddSuppressionInput,
  type ListSuppressionsParams,
  type ListSuppressionsResult,
  type SuppressionRow,
} from "./suppression";
export { consumeRateLimit } from "./rate-limiter";
export {
  signUnsubscribeToken,
  verifyUnsubscribeToken,
  type UnsubscribeTokenPayload,
} from "./unsubscribe-token";
export { EmailError, isTransientSendError, type EmailErrorCode } from "./errors";

// Default export = the most common entry point, the sender.
import { sendThroughEngine } from "./sender";
import { invalidate } from "./resolver";
export default { sendThroughEngine, invalidateResolverCache: invalidate };
