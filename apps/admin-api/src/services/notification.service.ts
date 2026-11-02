import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { ulid } from "ulid";
import config from "../config";
import { db } from "../db/connection";
import invoiceRepository from "../repositories/invoice.repository";
import tenantOrgRepository from "../repositories/tenant-org.repository";
import { sendThroughEngine } from "./email-engine/sender";
import { EmailError } from "./email-engine/errors";

/**
 * Phase 10b: engine routing hint. Caller passes this when the recipient is
 * an END_USER (so the engine routes via the tenant's verified custom domain
 * when configured). Omitting it keeps the call on the legacy SES path.
 * correct for TENANT_STAFF audiences (admin alerts, internal notifications).
 */
export interface NotificationEngineRouting {
  tenantId: string;
  category: "TRANSACTIONAL" | "NOTIFICATION" | "MARKETING";
  idempotencyKey?: string;
}
import {
  PLATFORM_COMPANY,
  calculateTaxBreakdown,
  generateInvoiceNumber,
} from "../utils/company-constants";
import { buildEmailHtml } from "../utils/email-template.util";
import {
  generateInvoicePdf,
  type InvoiceData,
} from "../utils/invoice-pdf.util";
import logger from "../utils/logger";
import { getTenantBaseUrl } from "../utils/tenant-domain.util";
import {
  getInvoicePublicUrl,
  uploadInvoiceToS3,
} from "../utils/s3.invoice.util";

/**
 * Invoice lines for a plan payment. Normally one line; a late renewal adds a
 * line for the missed cycles. The pre-tax subtotal is split so the lines always
 * add up to exactly the invoice's subtotal, no rounding drift between them.
 */
function invoiceItems(
  planName: string,
  billingCycle: string,
  subtotal: number,
  currency: string,
  backDue?: { cycles: number; total: number; from?: string; to?: string },
) {
  const line = (description: string, amount: number) => ({
    description,
    quantity: 1,
    unitPrice: amount,
    taxableAmount: amount,
    amount,
  });
  const current = `${planName} Plan (${billingCycle})`;
  if (!backDue || backDue.cycles <= 0 || backDue.total <= 0) {
    return [line(current, subtotal)];
  }

  const backSubtotal = Math.min(
    calculateTaxBreakdown(backDue.total, currency).subtotal,
    subtotal,
  );
  const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "";
  const span = backDue.from && backDue.to ? `, ${fmt(backDue.from)} to ${fmt(backDue.to)}` : "";
  const unit = billingCycle === "MONTHLY" ? "month" : billingCycle === "YEARLY" ? "year" : "cycle";

  const items = [
    line(
      `${planName} Plan (${billingCycle}): ${backDue.cycles} overdue ${unit}${backDue.cycles > 1 ? "s" : ""}${span}`,
      Math.round(backSubtotal * 100) / 100,
    ),
  ];
  // When autopay resumes later, this payment was the overdue cycles alone.
  const currentSubtotal = Math.round((subtotal - backSubtotal) * 100) / 100;
  if (currentSubtotal > 0.01) items.push(line(`${current}: current ${unit}`, currentSubtotal));
  return items;
}

class NotificationService {
  private ses: SESv2Client;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    this.ses = new SESv2Client({
      region: config.AWS_SES_REGION,
      credentials: {
        accessKeyId: config.AWS_SES_ACCESS_KEY,
        secretAccessKey: config.AWS_SES_SECRET_KEY,
      },
    });
    this.fromEmail = config.SES_FROM_EMAIL;
    this.fromName = config.SES_FROM_NAME;
  }

  async sendPaymentFailedEmail(
    tenantId: string,
    subscriptionId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const email = await this.getTenantOwnerEmail(tenantId);
    if (!email) return;

    const tenantName = await this.getTenantName(tenantId);
    const baseUrl = await getTenantBaseUrl(tenantId);
    const graceDays = (metadata?.grace_days as number) ?? 7;

    await this.sendEmail(
      email,
      "Payment Failed: Action Required",
      buildEmailHtml({
        title: "Payment Failed: Action Required",
        preheader: "Action required: Update your payment method",
        bodyHtml: `
          <p>Hi,</p>
          <p>We were unable to process the payment for your <strong>${tenantName}</strong> subscription.</p>
          <p>Your account will remain active for the next <strong>${graceDays} days</strong> while we retry the payment. After that, your subscription will be suspended.</p>
          <p><strong>What to do:</strong></p>
          <ul style="padding-left:20px;color:#374151;">
            <li>Ensure your payment method has sufficient funds</li>
            <li>Update your payment method in your dashboard</li>
          </ul>
          <p>If you have any questions, please contact our support team.</p>
        `,
        ctaButton: { text: "Update Payment Method", url: `${baseUrl}/dashboard/billing` },
      }),
    );
  }

  async sendGraceWarningEmail(
    tenantId: string,
    _subscriptionId: string,
    daysRemaining: number,
  ): Promise<void> {
    const email = await this.getTenantOwnerEmail(tenantId);
    if (!email) return;

    const tenantName = await this.getTenantName(tenantId);
    const baseUrl = await getTenantBaseUrl(tenantId);

    await this.sendEmail(
      email,
      `Payment Overdue, ${daysRemaining} Days Remaining`,
      buildEmailHtml({
        title: `Payment Overdue, ${daysRemaining} Days Remaining`,
        preheader: `Only ${daysRemaining} days left before suspension`,
        bodyHtml: `
          <p>Hi,</p>
          <p>Your payment for <strong>${tenantName}</strong> is still pending.</p>
          <p>You have <strong>${daysRemaining} days</strong> remaining before your account is suspended.</p>
          <p>Please update your payment method to avoid any interruption to your service.</p>
        `,
        ctaButton: { text: "Update Payment Method", url: `${baseUrl}/dashboard/billing` },
      }),
    );
  }

  async sendSuspensionNotice(
    tenantId: string,
    _subscriptionId: string,
  ): Promise<void> {
    const email = await this.getTenantOwnerEmail(tenantId);
    if (!email) return;

    const tenantName = await this.getTenantName(tenantId);
    const baseUrl = await getTenantBaseUrl(tenantId);

    await this.sendEmail(
      email,
      "Account Suspended: Subscription Cancelled",
      buildEmailHtml({
        title: "Account Suspended",
        preheader: "Your account has been suspended",
        bodyHtml: `
          <p>Hi,</p>
          <p>Your <strong>${tenantName}</strong> subscription has been suspended due to non-payment.</p>
          <p>Your data is safe and will be preserved. To restore full access, please reactivate your subscription from the billing page.</p>
        `,
        ctaButton: {
          text: "Reactivate Subscription",
          url: `${baseUrl}/dashboard/billing`,
        },
      }),
    );
  }

  async sendReactivationReminder(
    tenantId: string,
    _subscriptionId: string,
    daysUntilDeletion?: number,
  ): Promise<void> {
    const email = await this.getTenantOwnerEmail(tenantId);
    if (!email) return;

    const tenantName = await this.getTenantName(tenantId);
    const baseUrl = await getTenantBaseUrl(tenantId);
    const deletionNotice = daysUntilDeletion
      ? `<p><strong>Important:</strong> Your data will be permanently deleted in ${daysUntilDeletion} days if your subscription is not reactivated.</p>`
      : "";

    await this.sendEmail(
      email,
      "Reactivate Your Subscription",
      buildEmailHtml({
        title: "We Miss You!",
        preheader: "Your account is waiting for you",
        bodyHtml: `
          <p>Hi,</p>
          <p>Your <strong>${tenantName}</strong> subscription is currently suspended.</p>
          <p>All your courses, content, and settings are preserved and ready for you to pick up where you left off.</p>
          ${deletionNotice}
          <p>Reactivate your subscription from your billing page to restore full access.</p>
        `,
        ctaButton: { text: "Reactivate Now", url: `${baseUrl}/dashboard/billing` },
      }),
    );
  }

  async sendPaymentRecoveredEmail(
    tenantId: string,
    _subscriptionId: string,
  ): Promise<void> {
    const email = await this.getTenantOwnerEmail(tenantId);
    if (!email) return;

    const tenantName = await this.getTenantName(tenantId);

    await this.sendEmail(
      email,
      "Payment Successful: Account Restored",
      buildEmailHtml({
        title: "Payment Successful",
        preheader: "Your account has been restored",
        bodyHtml: `
          <p>Hi,</p>
          <p>Great news! Your payment for <strong>${tenantName}</strong> has been successfully processed.</p>
          <p>Your account has been fully restored with all features active.</p>
          <p>Thank you for your continued support!</p>
        `,
      }),
    );
  }

  /**
   * Welcome email sent after tenant admin signup.
   */
  async sendTenantAdminWelcomeEmail(
    userId: string,
    email: string,
    name: string,
    _tenantId?: string,
  ): Promise<void> {
    try {
      await this.sendEmail(
        email,
        `Welcome to ${PLATFORM_COMPANY.name}!`,
        buildEmailHtml({
          title: `Welcome to ${PLATFORM_COMPANY.name}, ${name}!`,
          preheader: "Your account is ready. Let's get started!",
          bodyHtml: `
            <p style="margin:0 0 16px;">Hi ${name},</p>
            <p style="margin:0 0 16px;">Welcome aboard! Your ${PLATFORM_COMPANY.name} account has been created successfully. We're excited to have you.</p>
            <p style="margin:0 0 8px;font-weight:600;color:#111827;">Here's how to get started:</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
              <tr>
                <td style="padding:12px 16px;background:#f9fafb;border-radius:8px;">
                  <span style="display:inline-block;width:28px;height:28px;background:#1e3a5f;color:#fff;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;margin-right:12px;vertical-align:middle;">1</span>
                  <span style="font-size:14px;color:#374151;vertical-align:middle;"><strong>Create your organization</strong>: Set up your academy with a name and branding</span>
                </td>
              </tr>
              <tr><td style="height:8px;"></td></tr>
              <tr>
                <td style="padding:12px 16px;background:#f9fafb;border-radius:8px;">
                  <span style="display:inline-block;width:28px;height:28px;background:#1e3a5f;color:#fff;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;margin-right:12px;vertical-align:middle;">2</span>
                  <span style="font-size:14px;color:#374151;vertical-align:middle;"><strong>Choose a plan</strong>: Pick the plan that fits your needs</span>
                </td>
              </tr>
              <tr><td style="height:8px;"></td></tr>
              <tr>
                <td style="padding:12px 16px;background:#f9fafb;border-radius:8px;">
                  <span style="display:inline-block;width:28px;height:28px;background:#1e3a5f;color:#fff;border-radius:50%;text-align:center;line-height:28px;font-size:13px;font-weight:700;margin-right:12px;vertical-align:middle;">3</span>
                  <span style="font-size:14px;color:#374151;vertical-align:middle;"><strong>Create your first course</strong>: Build engaging content for your learners</span>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:14px;color:#6b7280;">Need help getting started? Our support team is always here for you.</p>
          `,
          ctaButton: {
            text: "Go to Dashboard \u2192",
            url: `${config.ADMIN_PORTAL_URL}/dashboard`,
          },
          footerText:
            `You're receiving this email because you signed up for an account on ${PLATFORM_COMPANY.name}.`,
        }),
      );
      logger.info(
        `[notification] Welcome email sent to ${email} for user ${userId}`,
      );
    } catch (error) {
      logger.error(
        `[notification] Failed to send welcome email: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Plan purchase confirmation with invoice PDF, sent after subscription activation via webhook.
   */
  async sendPlanPurchaseConfirmationEmail(
    tenantId: string,
    subscriptionId: string,
    planName: string,
    billingCycle: string,
    price: number,
    currency: string,
    paymentId?: string,
    /**
     * A renewal paid after expiry also collects the cycles missed since then,
     * in the same payment. They get their own invoice line, so the GST invoice
     * itemises exactly what was charged.
     */
    backDue?: { cycles: number; total: number; from?: string; to?: string },
  ): Promise<void> {
    const tenant = await db
      .selectFrom("tenants")
      .select(["name", "slug", "owner_user_id"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    if (!tenant) {
      logger.warn(
        `[notification] PLAN_PURCHASED: tenant ${tenantId} not found, skipping email`,
      );
      return;
    }

    const owner = await db
      .selectFrom("tenant_users")
      .select(["email", "name"])
      .where("id", "=", tenant.owner_user_id)
      .executeTakeFirst();

    if (!owner?.email) {
      logger.warn(
        `[notification] PLAN_PURCHASED: owner email not found for tenant ${tenantId}, skipping email`,
      );
      return;
    }

    logger.info(
      `[notification] PLAN_PURCHASED: starting tenant=${tenantId} sub=${subscriptionId} plan="${planName}" cycle=${billingCycle} price=${price} currency=${currency} owner="${owner.email}"`,
    );

    // Fetch tenant org details for billing info
    const orgDetails = await tenantOrgRepository.findByTenantId(tenantId);
    const billingAddr = orgDetails?.billingAddress as {
      line1?: string;
      city?: string;
      state?: string;
      country?: string;
      postalCode?: string;
    } | null;

    // Generate invoice
    const tax = calculateTaxBreakdown(price, currency);
    const invoiceNumber = generateInvoiceNumber("ES");

    const invoiceData: InvoiceData = {
      invoiceNumber,
      invoiceDate: new Date(),
      sellerName: PLATFORM_COMPANY.name,
      sellerLegalName: PLATFORM_COMPANY.legalName,
      sellerAddress: PLATFORM_COMPANY.address,
      sellerGstin: PLATFORM_COMPANY.gstin || undefined,
      sellerCin: PLATFORM_COMPANY.cin || undefined,
      sellerPan: PLATFORM_COMPANY.pan || undefined,
      sellerHsnSac: PLATFORM_COMPANY.hsnSac || undefined,
      sellerEmail: PLATFORM_COMPANY.email,
      sellerLogoUrl: PLATFORM_COMPANY.logoUrl,
      buyerName: orgDetails?.legalEntityName || tenant.name,
      buyerLegalName: orgDetails?.legalEntityName || undefined,
      buyerEmail: orgDetails?.billingEmail || owner.email,
      buyerPhone: orgDetails?.billingPhone || undefined,
      buyerAddress: billingAddr || undefined,
      buyerGstin: orgDetails?.gstin || undefined,
      buyerPan: orgDetails?.panNumber || undefined,
      transactionId: paymentId || undefined,
      paymentMethod: paymentId ? "Razorpay" : undefined,
      items: invoiceItems(planName, billingCycle, tax.subtotal, currency, backDue),
      currency,
      subtotal: tax.subtotal,
      taxBreakdown: { cgst: tax.cgst, sgst: tax.sgst, totalTax: tax.totalTax },
      totalAmount: price,
      notes:
        "This is a computer-generated invoice. Prices are inclusive of applicable taxes.",
    };

    logger.info(
      `[notification] PLAN_PURCHASED: invoice ${invoiceNumber} prepared`,
    );

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await generateInvoicePdf(invoiceData);
      logger.info(
        `[notification] PLAN_PURCHASED: PDF generated (${pdfBuffer.length} bytes)`,
      );
    } catch (err) {
      logger.error(
        `[notification] PLAN_PURCHASED: PDF generation FAILED, ${(err as Error).message}`,
      );
      throw err;
    }

    const s3Key = `invoices/plans/${tenantId}/${invoiceNumber}.pdf`;
    let invoiceUrl: string;
    try {
      await uploadInvoiceToS3({
        key: s3Key,
        body: pdfBuffer,
        contentType: "application/pdf",
      });
      invoiceUrl = getInvoicePublicUrl(s3Key);
      logger.info(
        `[notification] PLAN_PURCHASED: invoice uploaded to S3 key=${s3Key}`,
      );
    } catch (err) {
      logger.error(
        `[notification] PLAN_PURCHASED: S3 upload FAILED key=${s3Key}, ${(err as Error).message}`,
      );
      throw err;
    }

    // Record invoice in database
    try {
      await invoiceRepository.create({
        id: ulid(),
        tenant_id: tenantId,
        invoice_number: invoiceNumber,
        invoice_type: "PLAN_SUBSCRIPTION",
        subscription_id: subscriptionId,
        currency,
        subtotal: tax.subtotal,
        tax_amount: tax.totalTax,
        total_amount: price,
        invoice_url: invoiceUrl,
        s3_key: s3Key,
        payment_method: paymentId ? "Razorpay" : undefined,
        transaction_id: paymentId || undefined,
      });
    } catch (err) {
      logger.warn(
        `[notification] Failed to record invoice in DB: ${(err as Error).message}`,
      );
    }

    const currencySymbol = currency === "INR" ? "\u20B9" : "$";

    try {
      await this.sendEmail(
        owner.email,
        `Plan Activated, ${planName}`,
        buildEmailHtml({
          title: `Your ${planName} Plan is Active!`,
          preheader: `Invoice ${invoiceNumber} for your ${planName} plan subscription`,
          bodyHtml: `
            <p style="margin:0 0 16px;">Hi ${owner.name || "there"},</p>
            <p style="margin:0 0 16px;">Thank you for subscribing to the <strong>${planName}</strong> plan for <strong>${tenant.name}</strong>. Your account is now fully active!</p>
            <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;background:#f9fafb;border-radius:8px;padding:20px;">
              <tr><td style="padding:6px 16px;font-size:14px;color:#6b7280;">Invoice Number</td><td style="padding:6px 16px;font-size:14px;font-weight:600;color:#111827;text-align:right;">${invoiceNumber}</td></tr>
              <tr><td style="padding:6px 16px;font-size:14px;color:#6b7280;">Plan</td><td style="padding:6px 16px;font-size:14px;font-weight:600;color:#111827;text-align:right;">${planName} (${billingCycle})</td></tr>
              <tr><td style="padding:6px 16px;font-size:14px;color:#6b7280;">Amount</td><td style="padding:6px 16px;font-size:14px;font-weight:600;color:#111827;text-align:right;">${currencySymbol}${price.toFixed(2)}</td></tr>
              <tr><td style="padding:6px 16px;font-size:14px;color:#6b7280;">Tax (GST 18%)</td><td style="padding:6px 16px;font-size:14px;color:#111827;text-align:right;">${currencySymbol}${tax.totalTax.toFixed(2)}</td></tr>
            </table>
          `,
          ctaButton: { text: "Download Invoice", url: invoiceUrl },
          footerText:
            `This invoice has been generated for your records. For any billing queries, please contact ${PLATFORM_COMPANY.billingEmail}.`,
        }),
      );
      logger.info(
        `[notification] PLAN_PURCHASED: email sent to=${owner.email}`,
      );
    } catch (err) {
      logger.error(
        `[notification] PLAN_PURCHASED: SES send FAILED to=${owner.email}, ${(err as Error).message}`,
      );
      throw err;
    }
  }

  /**
   * Free plan activation email, sent after instant free plan activation.
   */
  async sendFreePlanActivationEmail(
    tenantId: string,
    planName: string,
  ): Promise<void> {
    const email = await this.getTenantOwnerEmail(tenantId);
    if (!email) return;

    const tenantName = await this.getTenantName(tenantId);
    const baseUrl = await getTenantBaseUrl(tenantId);

    await this.sendEmail(
      email,
      `Welcome! Your Free Plan is Active`,
      buildEmailHtml({
        title: `Your ${planName} Plan is Active!`,
        preheader: `${tenantName} is now live on the ${planName} plan`,
        bodyHtml: `
            <p>Hi,</p>
            <p>Great news! The <strong>${planName}</strong> plan has been activated for <strong>${tenantName}</strong>. You're all set to start building!</p>
            <p style="margin:0 0 8px;font-weight:600;color:#111827;">What's included:</p>
            <ul style="padding-left:20px;color:#374151;">
              <li>Access to all features in your plan</li>
              <li>Create and publish courses</li>
              <li>Manage your learners and content</li>
            </ul>
            <p>You can upgrade to a paid plan at any time from your billing settings to unlock more features.</p>
          `,
        ctaButton: { text: "Go to Dashboard \u2192", url: `${baseUrl}/dashboard` },
      }),
    );

    logger.info(
      `[notification] Free plan activation email sent for tenant ${tenantId}`,
    );
  }

  /**
   * Reactivation confirmed email, sent when a suspended account is restored via new subscription.
   */
  async sendReactivationConfirmedEmail(
    tenantId: string,
    planName: string,
  ): Promise<void> {
    const email = await this.getTenantOwnerEmail(tenantId);
    if (!email) return;

    const tenantName = await this.getTenantName(tenantId);
    const baseUrl = await getTenantBaseUrl(tenantId);

    await this.sendEmail(
      email,
      "Welcome Back: Your Account is Restored",
      buildEmailHtml({
        title: "Welcome Back!",
        preheader: `${tenantName} is back online with the ${planName} plan`,
        bodyHtml: `
            <p>Hi,</p>
            <p>Great news! Your <strong>${tenantName}</strong> account has been successfully restored with the <strong>${planName}</strong> plan.</p>
            <p>All your courses, content, settings, and data have been preserved, everything is exactly how you left it.</p>
            <p>Welcome back, and thank you for choosing ${PLATFORM_COMPANY.name}!</p>
          `,
        ctaButton: { text: "Go to Dashboard \u2192", url: `${baseUrl}/dashboard` },
      }),
    );

    logger.info(
      `[notification] Reactivation confirmed email sent for tenant ${tenantId}`,
    );
  }

  async sendCancellationScheduledEmail(
    tenantId: string,
    _subscriptionId: string,
    cancelEffectiveAt?: string,
  ): Promise<void> {
    const email = await this.getTenantOwnerEmail(tenantId);
    if (!email) return;

    const tenantName = await this.getTenantName(tenantId);
    const baseUrl = await getTenantBaseUrl(tenantId);
    const effectiveDate = cancelEffectiveAt
      ? new Date(cancelEffectiveAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "the end of your current billing period";

    await this.sendEmail(
      email,
      "Subscription Cancellation Scheduled",
      buildEmailHtml({
        title: "Subscription Cancellation Scheduled",
        preheader: "Your subscription has been scheduled for cancellation",
        bodyHtml: `
          <p>Hi,</p>
          <p>Your <strong>${tenantName}</strong> subscription has been scheduled for cancellation.</p>
          <p>You'll retain full access to all features until <strong>${effectiveDate}</strong>. After that, your account will be suspended.</p>
          <p>Changed your mind? You can resubscribe anytime from your billing page before the cancellation takes effect.</p>
        `,
        ctaButton: { text: "Go to Billing", url: `${baseUrl}/dashboard/billing` },
      }),
    );

    logger.info(
      `[notification] Cancellation scheduled email sent for tenant ${tenantId}`,
    );
  }

  async sendPasswordResetEmail(
    to: string,
    name: string,
    resetLink: string,
    expiryMinutes: number,
  ): Promise<void> {
    await this.sendEmail(
      to,
      "Reset Your Password",
      buildEmailHtml({
        title: "Reset Your Password",
        preheader: "You requested a password reset",
        bodyHtml: `
          <p style="margin:0 0 16px;">Hi ${name},</p>
          <p style="margin:0 0 16px;">We received a request to reset your password. Click the button below to set a new password.</p>
          <p style="margin:0 0 16px;">This link will expire in <strong>${expiryMinutes} minutes</strong>.</p>
          <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">If you didn't request this, you can safely ignore this email. Your password will remain unchanged.</p>
        `,
        ctaButton: { text: "Reset Password", url: resetLink },
        footerText:
          `You're receiving this email because a password reset was requested for your ${PLATFORM_COMPANY.name} account.`,
      }),
    );
    logger.info(`[notification] Password reset email sent to=${to}`);
  }

  async sendTeamInvitationEmail(
    to: string,
    memberName: string,
    tenantName: string,
    invitedByName: string,
    loginUrl: string,
    tempPassword: string | null,
    roleName: string,
  ): Promise<void> {
    const credentialsBlock = tempPassword
      ? `
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;background:#f9fafb;border-radius:8px;padding:20px;">
          <tr><td style="padding:6px 16px;font-size:14px;color:#6b7280;">Email</td><td style="padding:6px 16px;font-size:14px;font-weight:600;color:#111827;text-align:right;">${to}</td></tr>
          <tr><td style="padding:6px 16px;font-size:14px;color:#6b7280;">Temporary Password</td><td style="padding:6px 16px;font-size:14px;font-weight:600;color:#111827;text-align:right;">${tempPassword}</td></tr>
        </table>
        <p style="margin:0 0 16px;font-size:13px;color:#dc2626;font-weight:600;">Please change your password after first login.</p>
      `
      : `<p style="margin:0 0 16px;">You can log in with your existing credentials.</p>`;

    await this.sendEmail(
      to,
      `You've been invited to join ${tenantName}`,
      buildEmailHtml({
        title: `You've been invited to join ${tenantName}`,
        preheader: `${invitedByName} has invited you to join ${tenantName}`,
        bodyHtml: `
          <p style="margin:0 0 16px;">Hi ${memberName},</p>
          <p style="margin:0 0 16px;"><strong>${invitedByName}</strong> has invited you to join <strong>${tenantName}</strong> as a <strong>${roleName}</strong>.</p>
          ${credentialsBlock}
        `,
        ctaButton: { text: "Go to Dashboard", url: loginUrl },
      }),
    );
    logger.info(`[notification] Team invitation email sent to=${to} tenant=${tenantName}`);
  }

  async sendAdminPasswordResetEmail(
    to: string,
    memberName: string,
    tenantName: string,
    resetByName: string,
    loginUrl: string,
    tempPassword: string,
  ): Promise<void> {
    await this.sendEmail(
      to,
      `Your password for ${tenantName} has been reset`,
      buildEmailHtml({
        title: "Your Password Has Been Reset",
        preheader: `Your password for ${tenantName} has been reset by an administrator`,
        bodyHtml: `
          <p style="margin:0 0 16px;">Hi ${memberName},</p>
          <p style="margin:0 0 16px;">Your password for <strong>${tenantName}</strong> has been reset by <strong>${resetByName}</strong>.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 24px;background:#f9fafb;border-radius:8px;padding:20px;">
            <tr><td style="padding:6px 16px;font-size:14px;color:#6b7280;">New Temporary Password</td><td style="padding:6px 16px;font-size:14px;font-weight:600;color:#111827;text-align:right;">${tempPassword}</td></tr>
          </table>
          <p style="margin:0 0 16px;font-size:13px;color:#dc2626;font-weight:600;">Please change your password after login.</p>
        `,
        ctaButton: { text: "Login Now", url: loginUrl },
      }),
    );
    logger.info(`[notification] Admin password reset email sent to=${to} tenant=${tenantName}`);
  }

  private async getTenantOwnerEmail(tenantId: string): Promise<string | null> {
    try {
      const result = await db
        .selectFrom("tenants")
        .innerJoin("tenant_users", "tenants.owner_user_id", "tenant_users.id")
        .select(["tenant_users.email"])
        .where("tenants.id", "=", tenantId)
        .executeTakeFirst();
      return result?.email ?? null;
    } catch (err) {
      logger.error(
        `Failed to get tenant owner email: tenantId=${tenantId} err=${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async getTenantName(tenantId: string): Promise<string> {
    try {
      const result = await db
        .selectFrom("tenants")
        .select(["name"])
        .where("id", "=", tenantId)
        .executeTakeFirst();
      return result?.name ?? "your academy";
    } catch {
      return "your academy";
    }
  }

  /**
   * Public email sender, used by invoice email service and other modules.
   *
   * Phase 10b: when `engineRouting` is supplied, try the email engine first
   * so the send goes via the tenant's verified custom domain (if any). On
   * { mode: "legacy" } we fall through to the unchanged legacy SES call so
   * the FROM line stays `"{fromName} <{config.SES_FROM_EMAIL}>"`. Without
   * engineRouting the caller stays 100% on the legacy path (correct for
   * tenant-staff / SaaS-operator audiences that should never be on a
   * tenant domain).
   */
  async sendCustomEmail(
    to: string,
    subject: string,
    htmlBody: string,
    replyTo?: string,
    fromName?: string,
    engineRouting?: NotificationEngineRouting,
  ): Promise<void> {
    return this.sendEmail(to, subject, htmlBody, replyTo, fromName, engineRouting);
  }

  private async sendEmail(
    to: string,
    subject: string,
    htmlBody: string,
    replyTo?: string,
    fromNameOverride?: string,
    engineRouting?: NotificationEngineRouting,
  ): Promise<void> {
    // Phase 10b: engine path for END_USER audiences.
    if (engineRouting) {
      try {
        const result = await sendThroughEngine({
          tenantId: engineRouting.tenantId,
          category: engineRouting.category,
          to,
          subject,
          html: htmlBody,
          replyTo,
          senderName: fromNameOverride,
          idempotencyKey: engineRouting.idempotencyKey,
        });
        if (result.mode === "custom") {
          logger.info(
            `[notification] Engine send to=${to} (tenant=${engineRouting.tenantId}) subject="${subject}"`,
          );
          return;
        }
        // Legacy mode, fall through to platform SES below.
      } catch (err) {
        if (err instanceof EmailError) {
          if (err.code === "SUPPRESSED") {
            logger.info(
              `[notification] Skipped suppressed recipient ${to} for tenant ${engineRouting.tenantId}`,
            );
            return;
          }
          if (
            err.code === "RATE_LIMITED" ||
            err.code === "SES_FAILED" ||
            err.code === "RENDER_FAILED"
          ) {
            // Existing tenant-admin notification semantics: throw on these
            // (caller decides retry). Preserves behavior for invoice +
            // support flows that may be in a job queue.
            throw err;
          }
          logger.warn(
            `[notification] Engine ${err.code}, falling back to legacy: ${err.message}`,
          );
        } else {
          logger.warn(
            `[notification] Engine threw non-EmailError, falling back to legacy: ${(err as Error).message}`,
          );
        }
      }
    }

    // Legacy SES path, unchanged behavior.
    const senderName = fromNameOverride ?? this.fromName;
    const command = new SendEmailCommand({
      FromEmailAddress: `${senderName} <${this.fromEmail}>`,
      Destination: {
        ToAddresses: [to],
      },
      ReplyToAddresses: replyTo ? [replyTo] : undefined,
      Content: {
        Simple: {
          Subject: {
            Data: subject,
            Charset: "UTF-8",
          },
          Body: {
            Html: {
              Data: htmlBody,
              Charset: "UTF-8",
            },
          },
        },
      },
    });

    try {
      await this.ses.send(command);
      logger.info(`[notification] Email sent to=${to} subject="${subject}"`);
    } catch (err) {
      logger.error(
        `[notification] SES send failed to=${to} subject="${subject}" from=${this.fromEmail} region=${config.AWS_SES_REGION} error=${(err as Error).message}`,
        { stack: (err as Error).stack },
      );
      throw err;
    }
  }
}

export default new NotificationService();
