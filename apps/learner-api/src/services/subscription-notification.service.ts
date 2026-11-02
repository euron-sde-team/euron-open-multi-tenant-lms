import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import sharp from "sharp";
import { ulid } from "ulid";
import config from "../config";
import { db } from "../db/connection";
import { sendThroughEngine } from "./email-engine/sender";
import { EmailError } from "./email-engine/errors";

/**
 * Phase 10 routing hint. All 11 subscription emails pass this so the engine
 * routes through the tenant's verified sending domain when configured.
 */
interface SubscriptionEngineRouting {
  tenantId: string;
  idempotencyKey?: string;
}
import { member_notification_type } from "../db/enums";
import invoiceRepository from "../repositories/invoice.repository";
import {
  calculateTaxBreakdown,
  generateInvoiceNumber,
} from "../utils/company-constants";
import {
  buildTenantBrandedEmailHtml,
  TenantEmailStyle,
} from "../utils/email-template.util";
import {
  generateInvoicePdf,
  type InvoiceData,
} from "../utils/invoice-pdf.util";
import logger from "../utils/logger";
import { getS3ObjectBuffer } from "../utils/s3";
import { uploadInvoiceToS3 } from "../utils/s3.util";

const sesClient = new SESClient({
  region: config.AWS_SES_REGION,
  credentials: {
    accessKeyId: config.AWS_SES_ACCESS_KEY,
    secretAccessKey: config.AWS_SES_SECRET_KEY,
  },
});

interface SubscriptionInfo {
  plan_name_snapshot: string;
  billing_cycle_snapshot: string;
  amount_snapshot: unknown;
  currency_snapshot: string;
  current_period_end?: unknown;
  grace_period_ends_at?: unknown;
  short_url?: string | null;
}

interface TenantBranding {
  tenantName: string;
  /** The tenant's mail design preference, "luxe" default, "simple" opt-out. */
  emailStyle: TenantEmailStyle;
  tenantLogoUrl?: string;
  tenantLogoS3Key?: string;
  tenantLogoDarkS3Key?: string;
  contactEmail?: string;
  supportEmail?: string;
  legalEntityName?: string;
  sellerGstin?: string;
  sellerPan?: string;
  sellerAddress?: {
    line1?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  sellerEmail?: string;
  sellerHsnSac?: string;
  sellerCin?: string;
  /** The academy's store listings, when it has published apps. */
  appLinks?: { android?: string | null; ios?: string | null };
}

// Module-level cache, persists for worker lifetime
const _convertedLogoCache = new Map<string, Buffer>();
const MAX_LOGO_CACHE = 50;

class SubscriptionNotificationService {
  // ─── Private Helpers ────────────────────────────────────────────────────

  private async fetchTenantBranding(tenantId: string): Promise<TenantBranding> {
    const [tenant, orgDetails] = await Promise.all([
      db
        .selectFrom("tenants")
        .select(["id", "name"])
        .where("id", "=", tenantId)
        .executeTakeFirst(),
      db
        .selectFrom("tenant_org_details")
        .select([
          "logo_light_key",
          "logo_dark_key",
          "contact_email",
          "support_email",
          "legal_entity_name",
          "gstin",
          "pan_number",
          "billing_address",
          "billing_email",
          "hsn_sac_code",
          "registration_number",
          "metadata",
          "android_app_url",
          "ios_app_url",
        ])
        .where("tenant_id", "=", tenantId)
        .executeTakeFirst(),
    ]);

    const tenantName = tenant?.name || "Our Platform";
    const logoKey = orgDetails?.logo_light_key ?? undefined;
    const darkLogoKey = orgDetails?.logo_dark_key ?? undefined;
    const tenantLogoUrl = logoKey
      ? logoKey.startsWith("http")
        ? logoKey
        : `${config.TENANT_DETAILS_BASE_URL}/${logoKey}`
      : undefined;
    const tenantLogoS3Key =
      logoKey && !logoKey.startsWith("http") ? logoKey : undefined;
    const tenantLogoDarkS3Key =
      darkLogoKey && !darkLogoKey.startsWith("http") ? darkLogoKey : undefined;

    const billingAddr = orgDetails?.billing_address
      ? typeof orgDetails.billing_address === "string"
        ? JSON.parse(orgDetails.billing_address)
        : orgDetails.billing_address
      : undefined;

    // "simple" is the only value that opts out; anything else means luxe.
    const emailStyle: TenantEmailStyle =
      (orgDetails?.metadata as Record<string, unknown> | null)?.email_style === "simple"
        ? "simple"
        : "luxe";

    return {
      tenantName,
      emailStyle,
      tenantLogoUrl,
      tenantLogoS3Key,
      tenantLogoDarkS3Key,
      contactEmail: orgDetails?.contact_email ?? undefined,
      supportEmail: orgDetails?.support_email ?? undefined,
      legalEntityName: orgDetails?.legal_entity_name ?? undefined,
      sellerGstin: orgDetails?.gstin ?? undefined,
      sellerPan: orgDetails?.pan_number ?? undefined,
      sellerAddress: billingAddr ?? undefined,
      sellerEmail:
        orgDetails?.billing_email ?? orgDetails?.contact_email ?? undefined,
      sellerHsnSac: orgDetails?.hsn_sac_code ?? undefined,
      sellerCin: orgDetails?.registration_number ?? undefined,
      appLinks: {
        android: orgDetails?.android_app_url ?? null,
        ios: orgDetails?.ios_app_url ?? null,
      },
    };
  }

  private async fetchMember(
    tenantId: string,
    memberId: string,
  ): Promise<
    | { id: string; name: string; email: string | null; phone: string | null }
    | undefined
  > {
    return db
      .selectFrom("tenant_members")
      .select(["id", "name", "email", "phone"])
      .where("id", "=", memberId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
    textBody: string,
    senderName?: string,
    engineRouting?: SubscriptionEngineRouting,
  ) {
    // Phase 10 retrofit: route through the email engine when engineRouting
    // is supplied. All 11 subscription lifecycle emails are TRANSACTIONAL
    // and pass routing; the legacy SES path remains as the safety net.
    if (engineRouting) {
      try {
        const result = await sendThroughEngine({
          tenantId: engineRouting.tenantId,
          category: "TRANSACTIONAL",
          to,
          subject,
          html,
          text: textBody,
          senderName,
          idempotencyKey: engineRouting.idempotencyKey,
        });
        if (result.mode === "custom") {
          logger.info(
            `[sub-notification] Engine send to ${to} (tenant=${engineRouting.tenantId}): ${subject}`,
          );
          return;
        }
        // Legacy mode, fall through.
      } catch (err) {
        if (err instanceof EmailError) {
          if (err.code === "SUPPRESSED") {
            logger.info(
              `[sub-notification] Skipped suppressed recipient ${to} for tenant ${engineRouting.tenantId}`,
            );
            return;
          }
          if (err.code === "RATE_LIMITED" || err.code === "SES_FAILED" || err.code === "RENDER_FAILED") {
            // Propagate, billing notifications matter; let the caller (a
            // subscription webhook job or a scheduled lifecycle worker)
            // decide whether to retry.
            throw err;
          }
          logger.warn(
            `[sub-notification] Engine ${err.code}, falling back to legacy: ${err.message}`,
          );
        } else {
          logger.warn(
            `[sub-notification] Engine non-EmailError, falling back to legacy: ${(err as Error).message}`,
          );
        }
      }
    }

    const source = senderName
      ? `${senderName} <${config.AWS_SES_FROM_EMAIL}>`
      : config.AWS_SES_FROM_EMAIL;

    await sesClient.send(new SendEmailCommand({
      Destination: { ToAddresses: [to] },
      Message: {
        Body: {
          Html: { Charset: "UTF-8", Data: html },
          Text: { Charset: "UTF-8", Data: textBody },
        },
        Subject: { Charset: "UTF-8", Data: subject },
      },
      Source: source,
    }));
    logger.info(`[sub-notification] Email sent to ${to}: ${subject}`);
  }

  private async createInAppNotification(
    tenantId: string,
    memberId: string,
    title: string,
    message: string,
    actionUrl?: string
  ) {
    try {
      const now = new Date();
      await db.insertInto("member_notifications").values({
        id: ulid(),
        tenant_id: tenantId,
        member_id: memberId,
        type: member_notification_type.SYSTEM,
        title,
        message,
        action_url: actionUrl ?? null,
        is_read: false,
        created_at: now,
        updated_at: now,
      }).execute();
    } catch (err) {
      logger.error(`[sub-notification] Failed to create in-app notification:`, err);
    }
  }

  private formatAmount(amount: unknown, currency: string): string {
    const num = typeof amount === "string" ? parseFloat(amount) : Number(amount ?? 0);
    const symbol = currency === "INR" ? "₹" : currency === "USD" ? "$" : currency;
    return `${symbol}${num.toFixed(2)}`;
  }

  // ─── Invoice Generation ─────────────────────────────────────────────────

  private async generateSubscriptionInvoice(
    tenantId: string,
    subscriptionId: string,
    ctx: {
      branding: TenantBranding;
      member: { id: string; name: string; email: string | null; phone: string | null };
      planName: string;
      billingCycle: string;
      amount: number;
      currency: string;
      paymentDate: Date;
      gatewayPaymentId?: string;
      periodStart?: Date;
      periodEnd?: Date;
    },
  ): Promise<string> {
    const invoiceNumber = generateInvoiceNumber("SUB");

    // Default 18% inclusive for INR subscriptions
    const taxPercentage = 18;
    const isIndian = ctx.currency === "INR";

    const taxBreakdown = calculateTaxBreakdown(ctx.amount, ctx.currency, {
      taxPercentage,
      taxMode: "INCLUSIVE",
      isIndian,
    });

    // Pre-fetch tenant logo via S3 SDK (avoids public URL / ACL issues)
    const logoS3Key =
      ctx.branding.tenantLogoS3Key ?? ctx.branding.tenantLogoDarkS3Key;
    let sellerLogoBuffer: Buffer | undefined;

    if (logoS3Key) {
      const cached = _convertedLogoCache.get(logoS3Key);
      if (cached) {
        sellerLogoBuffer = cached;
      } else {
        try {
          const bucket =
            config.TENANT_DETAILS_S3_BUCKET;
          const rawBuffer = await getS3ObjectBuffer(bucket, logoS3Key);

          // PDFKit only supports PNG/JPEG, convert otherwise
          const isPng =
            rawBuffer.length >= 4 &&
            rawBuffer[0] === 0x89 &&
            rawBuffer[1] === 0x50;
          const isJpeg =
            rawBuffer.length >= 3 &&
            rawBuffer[0] === 0xff &&
            rawBuffer[1] === 0xd8;

          if (isPng || isJpeg) {
            sellerLogoBuffer = rawBuffer;
          } else {
            sellerLogoBuffer = await sharp(rawBuffer).png().toBuffer();
          }

          // Cache the converted buffer
          if (_convertedLogoCache.size >= MAX_LOGO_CACHE) {
            const firstKey = _convertedLogoCache.keys().next().value;
            if (firstKey) _convertedLogoCache.delete(firstKey);
          }
          _convertedLogoCache.set(logoS3Key, sellerLogoBuffer);
        } catch (err) {
          logger.warn(
            `[sub-notification] Failed to fetch/convert tenant logo: ${(err as Error).message}`,
          );
        }
      }
    }

    const cycleLabel = ctx.billingCycle.toLowerCase().replace(/_/g, " ");
    const itemDescription = `${ctx.planName} - ${cycleLabel} subscription`;

    const invoiceData: InvoiceData = {
      invoiceNumber,
      invoiceDate: ctx.paymentDate,
      sellerName: ctx.branding.tenantName,
      sellerLegalName: ctx.branding.legalEntityName,
      sellerAddress: ctx.branding.sellerAddress,
      sellerGstin: ctx.branding.sellerGstin,
      sellerPan: ctx.branding.sellerPan,
      sellerCin: ctx.branding.sellerCin,
      sellerHsnSac: ctx.branding.sellerHsnSac,
      sellerEmail: ctx.branding.sellerEmail ?? ctx.branding.contactEmail,
      sellerLogoUrl: ctx.branding.tenantLogoUrl,
      sellerLogoBuffer,
      buyerName: ctx.member.name || "Customer",
      buyerEmail: ctx.member.email ?? undefined,
      buyerPhone: ctx.member.phone ?? undefined,
      items: [
        {
          description: itemDescription,
          quantity: 1,
          unitPrice: taxBreakdown.subtotal,
          amount: taxBreakdown.subtotal,
        },
      ],
      currency: ctx.currency,
      subtotal: taxBreakdown.subtotal,
      taxBreakdown: {
        cgst: taxBreakdown.cgst,
        sgst: taxBreakdown.sgst,
        totalTax: taxBreakdown.totalTax,
      },
      taxPercentage,
      isIndian,
      totalAmount: taxBreakdown.total,
      transactionId: ctx.gatewayPaymentId,
      paymentMethod: "Online Payment",
    };

    const pdfBuffer = await generateInvoicePdf(invoiceData);
    const key = `invoices/${tenantId}/subscriptions/${subscriptionId}/${invoiceNumber}.pdf`;
    const url = await uploadInvoiceToS3({ key, body: pdfBuffer });

    // Record invoice in database
    try {
      await invoiceRepository.create({
        id: ulid(),
        tenant_id: tenantId,
        invoice_number: invoiceNumber,
        invoice_type: "PLAN_SUBSCRIPTION",
        subscription_id: subscriptionId,
        member_id: ctx.member.id,
        currency: ctx.currency,
        subtotal: taxBreakdown.subtotal,
        tax_amount: taxBreakdown.totalTax,
        total_amount: ctx.amount,
        invoice_url: url,
        s3_key: key,
        payment_method: "Online Payment",
        transaction_id: ctx.gatewayPaymentId,
      });
    } catch (err) {
      logger.warn(
        `[sub-notification] Failed to record invoice in DB: ${(err as Error).message}`,
      );
    }

    return url;
  }

  // ─── Public Methods ─────────────────────────────────────────────────────

  async processSubscriptionCharged(
    tenantId: string,
    memberId: string,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    try {
      const [branding, member] = await Promise.all([
        this.fetchTenantBranding(tenantId),
        this.fetchMember(tenantId, memberId),
      ]);

      if (!member) {
        logger.warn(`[sub-notification] Member ${memberId} not found for charged notification`);
        return;
      }

      const subscriptionId = metadata.subscriptionId as string;
      const planName = metadata.planName as string;
      const billingCycle = metadata.billingCycle as string;
      const amount = typeof metadata.amount === "string"
        ? parseFloat(metadata.amount)
        : Number(metadata.amount ?? 0);
      const currency = (metadata.currency as string) || "INR";
      const gatewayPaymentId = metadata.gatewayPaymentId as string | undefined;
      const periodStart = metadata.periodStart
        ? new Date(metadata.periodStart as string)
        : undefined;
      const periodEnd = metadata.periodEnd
        ? new Date(metadata.periodEnd as string)
        : undefined;
      const paymentDate = new Date();

      // Generate invoice
      let invoiceUrl: string | undefined;
      try {
        invoiceUrl = await this.generateSubscriptionInvoice(tenantId, subscriptionId, {
          branding,
          member,
          planName,
          billingCycle,
          amount,
          currency,
          paymentDate,
          gatewayPaymentId,
          periodStart,
          periodEnd,
        });
      } catch (err) {
        logger.error(
          `[sub-notification] Invoice generation failed for subscription ${subscriptionId}:`,
          err,
        );
      }

      // Send email
      const formattedAmount = this.formatAmount(amount, currency);
      const cycleLabel = billingCycle.toLowerCase().replace(/_/g, " ");
      const transactionDate = paymentDate.toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      const periodStartStr = periodStart
        ? periodStart.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
        : undefined;
      const periodEndStr = periodEnd
        ? periodEnd.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
        : undefined;

      if (member.email && !member.email.endsWith("@phone.user")) {
        const html = buildTenantBrandedEmailHtml({
          style: branding.emailStyle,
          appLinks: branding.appLinks,
          tenantName: branding.tenantName,
          tenantLogoUrl: branding.tenantLogoUrl,
          title: "Payment Received",
          preheader: `Payment of ${formattedAmount} received for your ${planName} subscription`,
          bodyHtml: `
            <p style="margin:0 0 16px;">Hi ${member.name || "there"},</p>
            <p style="margin:0 0 16px;">We've received your subscription payment. Here are the details:</p>
            <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
              <tr>
                <td style="padding:10px 12px;border:1px solid #e4e4e7;color:#6b7280;font-size:14px;">Plan</td>
                <td style="padding:10px 12px;border:1px solid #e4e4e7;font-weight:600;font-size:14px;color:#18181b;">${planName}</td>
              </tr>
              <tr>
                <td style="padding:10px 12px;border:1px solid #e4e4e7;color:#6b7280;font-size:14px;">Amount</td>
                <td style="padding:10px 12px;border:1px solid #e4e4e7;font-weight:600;font-size:14px;color:#18181b;">${formattedAmount}/${cycleLabel}</td>
              </tr>
              <tr>
                <td style="padding:10px 12px;border:1px solid #e4e4e7;color:#6b7280;font-size:14px;">Date</td>
                <td style="padding:10px 12px;border:1px solid #e4e4e7;font-size:14px;color:#18181b;">${transactionDate}</td>
              </tr>
              ${periodStartStr && periodEndStr ? `<tr>
                <td style="padding:10px 12px;border:1px solid #e4e4e7;color:#6b7280;font-size:14px;">Billing Period</td>
                <td style="padding:10px 12px;border:1px solid #e4e4e7;font-size:14px;color:#18181b;">${periodStartStr}, ${periodEndStr}</td>
              </tr>` : ""}
              ${gatewayPaymentId ? `<tr>
                <td style="padding:10px 12px;border:1px solid #e4e4e7;color:#6b7280;font-size:14px;">Transaction ID</td>
                <td style="padding:10px 12px;border:1px solid #e4e4e7;font-size:14px;color:#18181b;">${gatewayPaymentId}</td>
              </tr>` : ""}
            </table>
            ${invoiceUrl ? `<p style="margin:0 0 16px;"><a href="${invoiceUrl}" style="color:#2563eb;text-decoration:underline;">Download Invoice (PDF)</a></p>` : ""}
            <p style="margin:0 0 8px;font-size:14px;color:#374151;">Thank you for your continued support!</p>
          `,
        });

        await this.sendEmail(
          member.email,
          `Payment Received - ${branding.tenantName}`,
          html,
          `Payment of ${formattedAmount} received for ${planName}. ${invoiceUrl ? `Invoice: ${invoiceUrl}` : ""}`,
          branding.tenantName,
          {
            tenantId,
            idempotencyKey: gatewayPaymentId
              ? `sub_charged:${gatewayPaymentId}`
              : `sub_charged:${subscriptionId}:${paymentDate.getTime()}`,
          },
        );
      }

      // In-app notification
      await this.createInAppNotification(
        tenantId,
        memberId,
        "Payment Received",
        `Payment of ${formattedAmount} received for your ${planName} subscription.`,
      );

      logger.info(`[sub-notification] Subscription charged notification sent for member ${memberId}, sub ${subscriptionId}`);
    } catch (error) {
      logger.error(
        `[sub-notification] Failed to process subscription charged for ${memberId}:`,
        error,
      );
      throw error;
    }
  }

  async sendSubscriptionActivated(tenantId: string, memberId: string, sub: SubscriptionInfo) {
    const [branding, member] = await Promise.all([
      this.fetchTenantBranding(tenantId),
      this.fetchMember(tenantId, memberId),
    ]);
    if (!member?.email || member.email.endsWith("@phone.user")) {
      logger.info(`[sub-notification] Skipping activated email for member ${memberId}: email=${member?.email ?? "null"}`);
      return;
    }

    const amount = this.formatAmount(sub.amount_snapshot, sub.currency_snapshot);
    const html = buildTenantBrandedEmailHtml({
      style: branding.emailStyle,
      appLinks: branding.appLinks,
      tenantName: branding.tenantName,
      tenantLogoUrl: branding.tenantLogoUrl,
      title: "Welcome to Your Subscription!",
      bodyHtml: `
        <p>Your subscription to <strong>${sub.plan_name_snapshot}</strong> is now active.</p>
        <p><strong>Plan:</strong> ${sub.plan_name_snapshot}</p>
        <p><strong>Billing:</strong> ${amount}/${(sub.billing_cycle_snapshot || "month").toLowerCase()}</p>
        <p>You now have unlimited access to all courses, books, and learning materials.</p>
      `,
    });

    await this.sendEmail(member.email, `Your ${branding.tenantName} Subscription is Active`, html, `Your subscription to ${sub.plan_name_snapshot} is now active.`, branding.tenantName, { tenantId });
    await this.createInAppNotification(tenantId, memberId, "Subscription Activated", `Your ${sub.plan_name_snapshot} subscription is now active. Enjoy unlimited access!`);
  }

  async sendPaymentReceipt(tenantId: string, memberId: string, sub: SubscriptionInfo) {
    const [branding, member] = await Promise.all([
      this.fetchTenantBranding(tenantId),
      this.fetchMember(tenantId, memberId),
    ]);
    if (!member?.email || member.email.endsWith("@phone.user")) {
      logger.info(`[sub-notification] Skipping payment receipt email for member ${memberId}: email=${member?.email ?? "null"}`);
      return;
    }

    const amount = this.formatAmount(sub.amount_snapshot, sub.currency_snapshot);
    const html = buildTenantBrandedEmailHtml({
      style: branding.emailStyle,
      appLinks: branding.appLinks,
      tenantName: branding.tenantName,
      tenantLogoUrl: branding.tenantLogoUrl,
      title: "Payment Received",
      bodyHtml: `
        <p>We've received your payment of <strong>${amount}</strong> for your <strong>${sub.plan_name_snapshot}</strong> subscription.</p>
        <p>Your subscription continues uninterrupted. Thank you for your continued support!</p>
      `,
    });

    await this.sendEmail(member.email, `Payment Received - ${branding.tenantName}`, html, `Payment of ${amount} received for ${sub.plan_name_snapshot}.`, branding.tenantName, { tenantId });
  }

  async sendPaymentFailed(tenantId: string, memberId: string, sub: SubscriptionInfo) {
    const [branding, member] = await Promise.all([
      this.fetchTenantBranding(tenantId),
      this.fetchMember(tenantId, memberId),
    ]);
    if (!member?.email || member.email.endsWith("@phone.user")) {
      logger.info(`[sub-notification] Skipping payment failed email for member ${memberId}: email=${member?.email ?? "null"}`);
      return;
    }

    const html = buildTenantBrandedEmailHtml({
      style: branding.emailStyle,
      appLinks: branding.appLinks,
      tenantName: branding.tenantName,
      tenantLogoUrl: branding.tenantLogoUrl,
      title: "Payment Failed",
      bodyHtml: `
        <p>We were unable to process your subscription payment for <strong>${sub.plan_name_snapshot}</strong>.</p>
        <p>Don't worry, we'll automatically retry the payment. If the issue persists, please update your payment method.</p>
      `,
      ctaButton: sub.short_url ? { text: "Update Payment Method", url: sub.short_url } : undefined,
    });

    await this.sendEmail(member.email, `Action Required: Payment Failed - ${branding.tenantName}`, html, `Your payment for ${sub.plan_name_snapshot} failed. Please update your payment method.`, branding.tenantName, { tenantId });
    await this.createInAppNotification(tenantId, memberId, "Payment Failed", "Your subscription payment failed. Please update your payment method.", sub.short_url ?? undefined);
  }

  async sendSubscriptionHalted(tenantId: string, memberId: string, sub: SubscriptionInfo) {
    const [branding, member] = await Promise.all([
      this.fetchTenantBranding(tenantId),
      this.fetchMember(tenantId, memberId),
    ]);
    if (!member?.email || member.email.endsWith("@phone.user")) {
      logger.info(`[sub-notification] Skipping halted email for member ${memberId}: email=${member?.email ?? "null"}`);
      return;
    }

    const html = buildTenantBrandedEmailHtml({
      style: branding.emailStyle,
      appLinks: branding.appLinks,
      tenantName: branding.tenantName,
      tenantLogoUrl: branding.tenantLogoUrl,
      title: "Subscription Payment Halted",
      bodyHtml: `
        <p>All payment retry attempts for your <strong>${sub.plan_name_snapshot}</strong> subscription have been exhausted.</p>
        <p>Please update your payment method to continue your access.</p>
      `,
      ctaButton: sub.short_url ? { text: "Update Payment Method", url: sub.short_url } : undefined,
    });

    await this.sendEmail(member.email, `Urgent: Update Payment - ${branding.tenantName}`, html, `Your subscription payment retries have been exhausted. Please update your payment method.`, branding.tenantName, { tenantId });
    await this.createInAppNotification(tenantId, memberId, "Subscription Halted", "Your payment retries have been exhausted. Please update your payment method.", sub.short_url ?? undefined);
  }

  async sendGracePeriodWarning(tenantId: string, memberId: string, sub: SubscriptionInfo, daysRemaining: number) {
    const [branding, member] = await Promise.all([
      this.fetchTenantBranding(tenantId),
      this.fetchMember(tenantId, memberId),
    ]);
    if (!member?.email || member.email.endsWith("@phone.user")) {
      logger.info(`[sub-notification] Skipping grace period warning for member ${memberId}: email=${member?.email ?? "null"}`);
      return;
    }

    const html = buildTenantBrandedEmailHtml({
      style: branding.emailStyle,
      appLinks: branding.appLinks,
      tenantName: branding.tenantName,
      tenantLogoUrl: branding.tenantLogoUrl,
      title: "Access Expiring Soon",
      bodyHtml: `
        <p>Your access to <strong>${sub.plan_name_snapshot}</strong> will expire in <strong>${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}</strong>.</p>
        <p>Update your payment method to maintain uninterrupted access.</p>
      `,
      ctaButton: sub.short_url ? { text: "Update Payment Method", url: sub.short_url } : undefined,
    });

    await this.sendEmail(member.email, `Access Expiring in ${daysRemaining} Days - ${branding.tenantName}`, html, `Your access expires in ${daysRemaining} days. Update your payment method.`, branding.tenantName, { tenantId });
  }

  async sendSubscriptionCancelled(tenantId: string, memberId: string, sub: SubscriptionInfo) {
    const [branding, member] = await Promise.all([
      this.fetchTenantBranding(tenantId),
      this.fetchMember(tenantId, memberId),
    ]);
    if (!member?.email || member.email.endsWith("@phone.user")) {
      logger.info(`[sub-notification] Skipping cancelled email for member ${memberId}: email=${member?.email ?? "null"}`);
      return;
    }

    const periodEnd = sub.current_period_end
      ? new Date(sub.current_period_end as string | number | Date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "the end of your billing period";

    const html = buildTenantBrandedEmailHtml({
      style: branding.emailStyle,
      appLinks: branding.appLinks,
      tenantName: branding.tenantName,
      tenantLogoUrl: branding.tenantLogoUrl,
      title: "Subscription Cancelled",
      bodyHtml: `
        <p>Your <strong>${sub.plan_name_snapshot}</strong> subscription has been cancelled.</p>
        <p>You'll continue to have access until <strong>${periodEnd}</strong>.</p>
        <p>We hope to see you again! You can always resubscribe from the pricing page.</p>
      `,
    });

    await this.sendEmail(member.email, `Subscription Cancelled - ${branding.tenantName}`, html, `Your ${sub.plan_name_snapshot} subscription has been cancelled.`, branding.tenantName, { tenantId });
    await this.createInAppNotification(tenantId, memberId, "Subscription Cancelled", `Your subscription has been cancelled. Access continues until ${periodEnd}.`);
  }

  async sendSubscriptionPaused(tenantId: string, memberId: string, sub: SubscriptionInfo) {
    const [branding, member] = await Promise.all([
      this.fetchTenantBranding(tenantId),
      this.fetchMember(tenantId, memberId),
    ]);
    if (!member?.email || member.email.endsWith("@phone.user")) {
      logger.info(`[sub-notification] Skipping paused email for member ${memberId}: email=${member?.email ?? "null"}`);
      return;
    }

    const html = buildTenantBrandedEmailHtml({
      style: branding.emailStyle,
      appLinks: branding.appLinks,
      tenantName: branding.tenantName,
      tenantLogoUrl: branding.tenantLogoUrl,
      title: "Subscription Paused",
      bodyHtml: `
        <p>Your <strong>${sub.plan_name_snapshot}</strong> subscription has been paused.</p>
        <p>Your billing is on hold. Contact support if you'd like to resume.</p>
      `,
    });

    await this.sendEmail(member.email, `Subscription Paused - ${branding.tenantName}`, html, `Your ${sub.plan_name_snapshot} subscription has been paused.`, branding.tenantName, { tenantId });
    await this.createInAppNotification(tenantId, memberId, "Subscription Paused", "Your subscription has been paused.");
  }

  async sendSubscriptionResumed(tenantId: string, memberId: string, sub: SubscriptionInfo) {
    const [branding, member] = await Promise.all([
      this.fetchTenantBranding(tenantId),
      this.fetchMember(tenantId, memberId),
    ]);
    if (!member?.email || member.email.endsWith("@phone.user")) {
      logger.info(`[sub-notification] Skipping resumed email for member ${memberId}: email=${member?.email ?? "null"}`);
      return;
    }

    const html = buildTenantBrandedEmailHtml({
      style: branding.emailStyle,
      appLinks: branding.appLinks,
      tenantName: branding.tenantName,
      tenantLogoUrl: branding.tenantLogoUrl,
      title: "Subscription Resumed",
      bodyHtml: `
        <p>Great news! Your <strong>${sub.plan_name_snapshot}</strong> subscription has been resumed.</p>
        <p>You have full access to all courses, books, and learning materials again.</p>
      `,
    });

    await this.sendEmail(member.email, `Subscription Resumed - ${branding.tenantName}`, html, `Your ${sub.plan_name_snapshot} subscription has been resumed.`, branding.tenantName, { tenantId });
    await this.createInAppNotification(tenantId, memberId, "Subscription Resumed", "Your subscription has been resumed. Welcome back!");
  }

  async sendRenewalReminder(tenantId: string, memberId: string, sub: SubscriptionInfo, daysUntilRenewal: number) {
    const [branding, member] = await Promise.all([
      this.fetchTenantBranding(tenantId),
      this.fetchMember(tenantId, memberId),
    ]);
    if (!member?.email || member.email.endsWith("@phone.user")) {
      logger.info(`[sub-notification] Skipping renewal reminder for member ${memberId}: email=${member?.email ?? "null"}`);
      return;
    }

    const amount = this.formatAmount(sub.amount_snapshot, sub.currency_snapshot);
    const html = buildTenantBrandedEmailHtml({
      style: branding.emailStyle,
      appLinks: branding.appLinks,
      tenantName: branding.tenantName,
      tenantLogoUrl: branding.tenantLogoUrl,
      title: "Subscription Renewal Reminder",
      bodyHtml: `
        <p>Your <strong>${sub.plan_name_snapshot}</strong> subscription renews in <strong>${daysUntilRenewal} day${daysUntilRenewal !== 1 ? "s" : ""}</strong>.</p>
        <p>You'll be charged <strong>${amount}</strong> automatically.</p>
      `,
    });

    await this.sendEmail(member.email, `Subscription Renews in ${daysUntilRenewal} Days - ${branding.tenantName}`, html, `Your subscription renews in ${daysUntilRenewal} days. You'll be charged ${amount}.`, branding.tenantName, { tenantId });
  }

  async sendSubscriptionEnded(tenantId: string, memberId: string, sub: SubscriptionInfo) {
    const [branding, member] = await Promise.all([
      this.fetchTenantBranding(tenantId),
      this.fetchMember(tenantId, memberId),
    ]);
    if (!member?.email || member.email.endsWith("@phone.user")) {
      logger.info(`[sub-notification] Skipping ended email for member ${memberId}: email=${member?.email ?? "null"}`);
      return;
    }

    const html = buildTenantBrandedEmailHtml({
      style: branding.emailStyle,
      appLinks: branding.appLinks,
      tenantName: branding.tenantName,
      tenantLogoUrl: branding.tenantLogoUrl,
      title: "Subscription Ended",
      bodyHtml: `
        <p>Your <strong>${sub.plan_name_snapshot}</strong> subscription has ended.</p>
        <p>You can resubscribe anytime from the pricing page to regain access to all courses and books.</p>
      `,
    });

    await this.sendEmail(member.email, `Subscription Ended - ${branding.tenantName}`, html, `Your ${sub.plan_name_snapshot} subscription has ended.`, branding.tenantName, { tenantId });
    await this.createInAppNotification(tenantId, memberId, "Subscription Ended", "Your subscription has ended. Resubscribe to regain access.");
  }
}

export default new SubscriptionNotificationService();
