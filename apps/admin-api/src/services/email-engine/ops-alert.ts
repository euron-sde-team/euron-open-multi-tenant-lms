/**
 * OPS alert, posts a payload to EMAIL_OPS_ALERT_WEBHOOK_URL.
 *
 * Fire-and-forget; never throws. If the webhook isn't configured we just
 * log the alert and move on so a missing env var can't blackhole the entire
 * Phase 7 worker pipeline.
 */

import config from "../../config";
import logger from "../../utils/logger";

export type AlertSeverity = "SEV1" | "SEV2" | "SEV3";

export interface OpsAlertPayload {
  severity: AlertSeverity;
  source: string;
  message: string;
  context?: Record<string, unknown>;
}

export async function notifyOps(payload: OpsAlertPayload): Promise<void> {
  const line = `[OPS ${payload.severity}] ${payload.source}: ${payload.message}${payload.context ? " " + JSON.stringify(payload.context) : ""}`;
  // Always emit to logs so the alert is visible in CloudWatch even when the
  // webhook is unreachable.
  if (payload.severity === "SEV1" || payload.severity === "SEV2") {
    logger.error(line);
  } else {
    logger.warn(line);
  }

  const url = config.EMAIL_OPS_ALERT_WEBHOOK_URL;
  if (!url) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    logger.error(`[ops-alert] webhook POST failed: ${(err as Error).message}`);
  }
}
