/**
 * Email service: OTP + password reset.
 *
 * Phase 10 retrofit: every send tries the email engine first (which routes
 * via the tenant's verified custom domain when configured). On legacy mode
 * (no verified domain, no default identity, etc.) we fall back to the
 * unchanged platform SES path with the FROM line
 * `"{tenantName} <{config.legacyFromEmail}>"`, the tenant's organization
 * name stays in the display name in both modes.
 *
 * Category = TRANSACTIONAL (always allowed; never gated by reputation
 * status, even when the tenant is PAUSED).
 */

import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import config from "../config";
import { getTenantEmailStyle } from "../utils/email-style.util";
import { buildTenantBrandedEmailHtml } from "../utils/email-template.util";
import logger from "../utils/logger";
import { sendThroughEngine } from "./email-engine/sender";
import { EmailError } from "./email-engine/errors";

const sesClient = new SESClient({
  region: config.AWS_SES_REGION,
  credentials: {
    accessKeyId: config.AWS_SES_ACCESS_KEY,
    secretAccessKey: config.AWS_SES_SECRET_KEY,
  },
});

class EmailService {
  async sendOtpEmail(
    tenantId: string,
    to: string,
    code: string,
    tenantName: string,
    tenantLogoUrl?: string,
    otpId?: string
  ): Promise<void> {
    const subject = `Your verification code for ${tenantName}`;

    const bodyHtml = `
      <p style="margin:0 0 24px;font-size:14px;color:#71717a;">Enter this code to verify your identity</p>
      <div style="text-align:center;padding:24px;background:#f4f4f5;border-radius:8px;margin-bottom:24px;">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#18181b;">${code}</span>
      </div>
      <p style="margin:0;font-size:13px;color:#a1a1aa;">This code expires in ${config.OTP_EXPIRY_MINUTES} minutes. If you didn't request this code, you can safely ignore this email.</p>
    `;

    const html = buildTenantBrandedEmailHtml({
      style: await getTenantEmailStyle(tenantId),
      tenantName,
      tenantLogoUrl,
      title: "Your verification code",
      bodyHtml,
    });

    const textBody = `Your verification code is: ${code}. This code expires in ${config.OTP_EXPIRY_MINUTES} minutes.`;

    await this.send({
      tenantId,
      category: "TRANSACTIONAL",
      to,
      subject,
      htmlBody: html,
      textBody,
      senderName: tenantName,
      idempotencyKey: otpId ? `otp:${otpId}` : undefined,
    });
    logger.info(`OTP email sent to ${to}`);
  }

  async sendPasswordResetEmail(
    tenantId: string,
    to: string,
    resetLink: string,
    tenantName: string,
    tenantLogoUrl?: string,
    expiryMinutes: number = 15,
    resetToken?: string
  ): Promise<void> {
    const subject = `Reset your password, ${tenantName}`;

    const bodyHtml = `
      <p style="margin:0 0 16px;font-size:14px;color:#71717a;">We received a request to reset your password. Click the button below to set a new password.</p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${resetLink}" style="display:inline-block;padding:12px 28px;background:#18181b;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;border-radius:8px;">Reset Password</a>
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#a1a1aa;">This link expires in ${expiryMinutes} minutes. If you didn't request a password reset, you can safely ignore this email.</p>
      <p style="margin:0;font-size:12px;color:#d4d4d8;">If the button doesn't work, copy and paste this link: <a href="${resetLink}" style="color:#18181b;word-break:break-all;">${resetLink}</a></p>
    `;

    const html = buildTenantBrandedEmailHtml({
      style: await getTenantEmailStyle(tenantId),
      tenantName,
      tenantLogoUrl,
      title: "Reset your password",
      bodyHtml,
    });

    const textBody = `Reset your password: ${resetLink}\n\nThis link expires in ${expiryMinutes} minutes.`;

    await this.send({
      tenantId,
      category: "TRANSACTIONAL",
      to,
      subject,
      htmlBody: html,
      textBody,
      senderName: tenantName,
      idempotencyKey: resetToken ? `pwreset:${resetToken}` : undefined,
    });
    logger.info(`Password reset email sent to ${to}`);
  }

  // The old private wrapper (W5, a near-duplicate of the shared one) is gone:
  // OTP and password-reset mails now render through the shared tenant-branded
  // wrapper, styled by the tenant's luxe/simple preference like every other
  // learner mail.

  private async send(params: {
    tenantId: string;
    category: "TRANSACTIONAL" | "NOTIFICATION";
    to: string;
    subject: string;
    htmlBody: string;
    textBody: string;
    senderName?: string;
    idempotencyKey?: string;
  }): Promise<void> {
    // 1. Try the email engine. Returns { mode: "custom" } when the tenant
    //    has a verified sending domain + default TRANSACTIONAL identity, in
    //    which case the engine already sent the message. Returns
    //    { mode: "legacy" } otherwise, we fall through to the unchanged
    //    legacy SES call below.
    try {
      const result = await sendThroughEngine({
        tenantId: params.tenantId,
        category: params.category,
        to: params.to,
        subject: params.subject,
        html: params.htmlBody,
        text: params.textBody,
        senderName: params.senderName,
        idempotencyKey: params.idempotencyKey,
      });
      if (result.mode === "custom") return;
      // Fall through to legacy SES below.
    } catch (err) {
      if (err instanceof EmailError) {
        // SUPPRESSED: recipient is on the per-tenant block list. Do NOT also
        // send via legacy, that would defeat the suppression. Caller
        // already invoked us, so swallow silently for OTP/password reset
        // (the user will see "no email received" and request another).
        if (err.code === "SUPPRESSED") {
          logger.info(
            `[email.service] recipient ${params.to} is suppressed for tenant ${params.tenantId}; skipping`,
          );
          return;
        }
        // RATE_LIMITED + SES_FAILED + RENDER_FAILED: propagate. OTPs are
        // user-initiated; the user gets an error and can retry.
        if (err.code === "RATE_LIMITED" || err.code === "SES_FAILED" || err.code === "RENDER_FAILED") {
          throw err;
        }
        // Other engine codes (NO_VERIFIED_DOMAIN, TENANT_PAUSED): fall
        // through to legacy. PAUSED can't fire here since TRANSACTIONAL is
        // never gated; but if a future category extension makes it
        // possible, legacy is the right safety net.
        logger.warn(
          `[email.service] engine ${err.code}, falling back to legacy: ${err.message}`,
        );
      } else {
        // Non-EmailError from the engine (DB hiccup, etc.), fall through
        // to legacy. OTPs are too important to fail because the engine had
        // an internal error.
        logger.warn(
          `[email.service] engine threw non-EmailError, falling back to legacy: ${(err as Error).message}`,
        );
      }
    }

    // Legacy SES path, preserves the "{tenantName} <AWS_SES_FROM_EMAIL>"
    // FROM line that's been the default for OTP/password-reset since before
    // the engine existed.
    const source = params.senderName
      ? `${params.senderName} <${config.AWS_SES_FROM_EMAIL}>`
      : config.AWS_SES_FROM_EMAIL;

    const command = new SendEmailCommand({
      Destination: { ToAddresses: [params.to] },
      Message: {
        Body: {
          Html: { Charset: "UTF-8", Data: params.htmlBody },
          Text: { Charset: "UTF-8", Data: params.textBody },
        },
        Subject: { Charset: "UTF-8", Data: params.subject },
      },
      Source: source,
    });

    try {
      await sesClient.send(command);
    } catch (error) {
      logger.error(`Failed to send email to ${params.to} via legacy SES:`, error);
      throw error;
    }
  }
}

export default new EmailService();
