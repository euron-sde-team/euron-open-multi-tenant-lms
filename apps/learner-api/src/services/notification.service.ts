import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import { NO_GATEWAY_PROVIDER } from "../repositories/orders.repository";
import sharp from "sharp";
import { ulid } from "ulid";
import config from "../config";
import { db } from "../db/connection";
import { sendThroughEngine } from "./email-engine/sender";
import { EmailError } from "./email-engine/errors";
import { domain_status, member_notification_type } from "../db/enums";
import * as cartOrderItemsRepo from "../repositories/cart-order-items.repository";
import authConfigRepository from "../repositories/auth-config.repository";
import invoiceRepository from "../repositories/invoice.repository";
import {
  calculateTaxBreakdown,
  generateInvoiceNumber,
} from "../utils/company-constants";
import { getCurrencyDef } from "../utils/currency-registry";
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

interface ResolvedCartItem {
  title: string;
  item_type: string;
  net_amount: number;
}

/**
 * Currency display for emails/PDF descriptions (UTF-8 safe): the
 * registry symbol, with a space when the symbol ends in a letter (MAD 100.00,
 * KSh 50.00) and attached otherwise ($100.00, ₹999.00, A$84.75).
 */
function formatMoneyForMessage(amount: number, currency: string): string {
  const code = String(currency ?? "").toUpperCase();
  const symbol = getCurrencyDef(code)?.symbol ?? code;
  const separator = /[A-Za-z]$/.test(symbol) ? " " : "";
  return `${symbol}${separator}${amount.toFixed(2)}`;
}

/**
 * The global xss-sanitizer HTML-encodes request bodies at write time, so
 * stored titles carry entities like &amp;. Decode at this render boundary
 * (email subjects/bodies and invoice PDFs are plain-text sinks).
 */
/**
 * Escape for an HTML ATTRIBUTE. Titles reach the email already decoded, so a
 * course called `Angular "Pro" & Projects` would otherwise close the alt
 * attribute early and spill markup into the tag.
 */
function escapeAttribute(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'");
}

const sesClient = new SESClient({
  region: config.AWS_SES_REGION,
  credentials: {
    accessKeyId: config.AWS_SES_ACCESS_KEY,
    secretAccessKey: config.AWS_SES_SECRET_KEY,
  },
});

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

// Module-level cache, persists for worker lifetime, same pattern as _logoCache in invoice-pdf.util.ts
const _convertedLogoCache = new Map<string, Buffer>();
const MAX_LOGO_CACHE = 50;

class NotificationService {
  // ---------------------------------------------------------------------------
  // Public job processors (called by notification worker)
  // ---------------------------------------------------------------------------

  async processUserWelcome(tenantId: string, memberId: string): Promise<void> {
    try {
      const [member, branding, tenantBaseUrl] = await Promise.all([
        this.fetchMember(tenantId, memberId),
        this.fetchTenantBranding(tenantId),
        this.getTenantBaseUrl(tenantId),
      ]);

      if (!member) {
        logger.warn(
          `[notification] Member ${memberId} not found for welcome notification`,
        );
        return;
      }

      const memberName = member.name || "there";

      // Send email
      if (member.email && !member.email.endsWith("@phone.user")) {
        await this.sendEmail({
          to: member.email,
          subject: `Welcome to ${branding.tenantName}!`,
          html: buildTenantBrandedEmailHtml({
            style: branding.emailStyle,
            appLinks: branding.appLinks,
            tenantName: branding.tenantName,
            tenantLogoUrl: branding.tenantLogoUrl,
            title: `Welcome, ${memberName}!`,
            preheader: `You've successfully joined ${branding.tenantName}`,
            bodyHtml: `
              <p style="margin:0 0 16px;">We're excited to have you on board. Your account has been created and you're all set to explore everything we have to offer.</p>
              <p style="margin:0 0 16px;">Here's what you can do next:</p>
              <ul style="margin:0 0 16px;padding-left:20px;color:#374151;">
                <li style="margin-bottom:8px;">Browse our catalog of courses and resources</li>
                <li style="margin-bottom:8px;">Complete your profile to personalize your experience</li>
                <li style="margin-bottom:8px;">Start learning at your own pace</li>
              </ul>
            `,
            ctaButton: {
              text: "Get Started",
              url: tenantBaseUrl,
            },
          }),
          textBody: `Welcome to ${branding.tenantName}, ${memberName}! Your account has been created successfully. Visit ${tenantBaseUrl} to get started.`,
          senderName: branding.tenantName,
          engineRouting: {
            tenantId,
            category: "TRANSACTIONAL",
            idempotencyKey: `welcome:${memberId}`,
          },
        });
      }

      // Create in-app notification
      await this.createInAppNotification(tenantId, memberId, {
        type: "SYSTEM",
        title: `Welcome to ${branding.tenantName}!`,
        message:
          "Your account has been created. Start exploring our courses and resources.",
      });

      logger.info(
        `[notification] Welcome notification sent for member ${memberId}`,
      );
    } catch (error) {
      logger.error(
        `[notification] Failed to process welcome for ${memberId}:`,
        error,
      );
    }
  }

  async processPurchaseConfirmation(
    tenantId: string,
    orderId: string,
    memberId: string,
    orderType?: string,
  ): Promise<void> {
    try {
      const ctx = await this.buildPurchaseContext(
        tenantId,
        orderId,
        memberId,
        orderType,
      );
      if (!ctx) {
        logger.warn(
          `[notification] Member or order not found for purchase confirmation: member=${memberId}, order=${orderId}`,
        );
        return;
      }
      const {
        member,
        branding,
        order,
        amount,
        taxAmount,
        currency,
        isCart,
        cartItems,
        itemName,
        displayType,
      } = ctx;

      // Generate invoice
      let invoiceUrl: string | undefined;
      try {
        invoiceUrl = await this.generateAndUploadInvoice(tenantId, orderId, {
          branding,
          member,
          order,
          itemName: isCart ? "Cart Order" : itemName,
          amount,
          currency,
          cartItems,
        });
      } catch (err) {
        logger.error(
          `[notification] Invoice generation failed for order ${orderId}:`,
          err,
        );
      }

      // Send email
      if (member.email && !member.email.endsWith("@phone.user")) {
        const money = (n: number) => formatMoneyForMessage(n, currency);

        const invoiceSection = invoiceUrl
          ? `<p style="margin:16px 0 0;font-size:13px;color:#71717a;">Your invoice is available <a href="${invoiceUrl}" style="color:#18181b;font-weight:600;">here</a>.</p>`
          : "";

        let bodyHtml: string;
        let emailSubject: string;
        let preheader: string;
        let textBody: string;

        if (isCart && cartItems && cartItems.length > 0) {
          emailSubject = `Order Confirmed - ${cartItems.length} item${cartItems.length !== 1 ? "s" : ""}`;
          preheader = `Your order with ${cartItems.length} item${cartItems.length !== 1 ? "s" : ""} is confirmed`;

          const subtotal = cartItems.reduce(
            (sum, ci) => sum + ci.net_amount,
            0,
          );
          const itemRowsHtml = cartItems
            .map(
              (ci) =>
                `<tr>
                  <td style="padding:6px 0;color:#18181b;">${ci.title}</td>
                  <td style="padding:6px 0;color:#71717a;text-align:center;">${this.humanizeOrderType(ci.item_type)}</td>
                  <td style="padding:6px 0;text-align:right;">${money(ci.net_amount)}</td>
                </tr>`,
            )
            .join("");

          bodyHtml = `
            <p style="margin:0 0 16px;">Thank you for your purchase! Here are your order details:</p>
            <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin-bottom:16px;">
              <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
                <thead>
                  <tr style="border-bottom:1px solid #d4d4d8;">
                    <th style="padding:6px 0;text-align:left;font-weight:600;">Item</th>
                    <th style="padding:6px 0;text-align:center;font-weight:600;">Type</th>
                    <th style="padding:6px 0;text-align:right;font-weight:600;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemRowsHtml}
                </tbody>
                <tfoot>
                  <tr style="border-top:1px solid #d4d4d8;">
                    <td colspan="2" style="padding:6px 0;font-weight:600;">Subtotal</td>
                    <td style="padding:6px 0;text-align:right;">${money(subtotal)}</td>
                  </tr>
                  ${
                    taxAmount > 0
                      ? `<tr>
                    <td colspan="2" style="padding:4px 0;color:#71717a;">Tax</td>
                    <td style="padding:4px 0;text-align:right;color:#71717a;">${money(taxAmount)}</td>
                  </tr>`
                      : ""
                  }
                  <tr>
                    <td colspan="2" style="padding:6px 0;font-weight:700;font-size:15px;">Total</td>
                    <td style="padding:6px 0;text-align:right;font-weight:700;font-size:15px;">${money(amount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p style="margin:0 0 4px;font-size:12px;color:#71717a;">Order #${order.order_number}</p>
            ${invoiceSection}
          `;

          const itemListText = cartItems
            .map(
              (ci) =>
                `- ${ci.title} (${money(ci.net_amount)})`,
            )
            .join("\n");
          textBody = `Order Confirmed! Your order with ${cartItems.length} item(s) is confirmed.\n\n${itemListText}\n\nTotal: ${money(amount)}\nOrder #${order.order_number}`;
        } else {
          emailSubject = `Purchase Confirmed - ${itemName}`;
          preheader = `Your purchase of ${itemName} is confirmed`;

          bodyHtml = `
            <p style="margin:0 0 16px;">Thank you for your purchase! Here are your order details:</p>
            <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin-bottom:16px;">
              <table style="width:100%;font-size:14px;color:#374151;">
                <tr>
                  <td style="padding:4px 0;font-weight:600;">Item</td>
                  <td style="padding:4px 0;text-align:right;">${itemName}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-weight:600;">Type</td>
                  <td style="padding:4px 0;text-align:right;">${displayType}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-weight:600;">Amount</td>
                  <td style="padding:4px 0;text-align:right;">${money(amount)}</td>
                </tr>
                <tr>
                  <td style="padding:4px 0;font-weight:600;">Order #</td>
                  <td style="padding:4px 0;text-align:right;font-size:12px;color:#71717a;">${order.order_number}</td>
                </tr>
              </table>
            </div>
            ${invoiceSection}
          `;

          textBody = `Purchase Confirmed! You have successfully purchased ${itemName} for ${money(amount)}. Order #${order.order_number}`;
        }

        await this.sendEmail({
          to: member.email,
          subject: emailSubject,
          engineRouting: {
            tenantId,
            category: "TRANSACTIONAL",
            idempotencyKey: `purchase:${orderId}`,
          },
          html: buildTenantBrandedEmailHtml({
            style: branding.emailStyle,
            appLinks: branding.appLinks,
            tenantName: branding.tenantName,
            tenantLogoUrl: branding.tenantLogoUrl,
            title: "Purchase Confirmed!",
            preheader,
            bodyHtml,
          }),
          textBody,
          senderName: branding.tenantName,
        });
      }

      // Create in-app notification
      const inAppMessage =
        isCart && cartItems
          ? `Your order with ${cartItems.length} item${cartItems.length !== 1 ? "s" : ""} is confirmed.`
          : `You have successfully purchased ${itemName}.`;
      await this.createInAppNotification(tenantId, memberId, {
        type: "PURCHASE_CONFIRMED",
        title: "Purchase Confirmed!",
        message: inAppMessage,
      });

      logger.info(
        `[notification] Purchase confirmation sent for order ${orderId}`,
      );
    } catch (error) {
      logger.error(
        `[notification] Failed to process purchase confirmation for order ${orderId}:`,
        error,
      );
    }
  }

  /**
   * Alerts the tenant owner that one of their customers bought something.
   *
   * Deliberately a separate job from the buyer confirmation: a bounced owner
   * address must never cause the buyer's receipt to be re-sent by BullMQ's
   * retry.
   *
   * Sent on the legacy platform-SES path (no `engineRouting`), same choice the
   * hub creator alerts make. A staff alert must not be silenced by the tenant's
   * own suppression list, nor blocked when their sending domain is paused.
   */
  async processTenantPurchaseAlert(
    tenantId: string,
    orderId: string,
    memberId: string,
    orderType?: string,
  ): Promise<void> {
    try {
      const owner = await this.fetchTenantOwner(tenantId);
      if (!owner?.email) {
        logger.warn(
          `[notification] No owner email for tenant ${tenantId}; skipping purchase alert for order ${orderId}`,
        );
        return;
      }

      const ctx = await this.buildPurchaseContext(
        tenantId,
        orderId,
        memberId,
        orderType,
      );
      if (!ctx) {
        logger.warn(
          `[notification] Member or order not found for tenant purchase alert: member=${memberId}, order=${orderId}`,
        );
        return;
      }
      const {
        member,
        branding,
        order,
        amount,
        taxAmount,
        netAmount,
        discountAmount,
        currency,
        isCart,
        cartItems,
        itemName,
        displayType,
      } = ctx;

      const money = (n: number) => formatMoneyForMessage(n, currency);
      const buyerName = decodeEntities(member.name || "Customer");

      // The buyer job generates the invoice PDF; this alert links the same one.
      // Absent (not generated yet, or generation failed) is fine, every field
      // the invoice carries is already in the body below.
      const invoice = await invoiceRepository
        .findLatestByOrderId(tenantId, orderId)
        .catch(() => undefined);

      const itemRowsHtml = (
        isCart && cartItems && cartItems.length > 0
          ? cartItems.map((ci) => ({
              title: ci.title,
              type: this.humanizeOrderType(ci.item_type),
              amount: ci.net_amount,
            }))
          : [{ title: itemName, type: displayType, amount: netAmount }]
      )
        .map(
          (row) =>
            `<tr>
              <td style="padding:6px 0;color:#18181b;">${row.title}</td>
              <td style="padding:6px 0;color:#71717a;text-align:center;">${row.type}</td>
              <td style="padding:6px 0;text-align:right;">${money(row.amount)}</td>
            </tr>`,
        )
        .join("");

      const detailRow = (label: string, value: string) =>
        `<tr>
          <td style="padding:4px 0;color:#71717a;">${label}</td>
          <td style="padding:4px 0;text-align:right;color:#18181b;">${value}</td>
        </tr>`;

      const paidAt = order.paid_at ?? order.created_at;
      const paidAtLabel =
        paidAt instanceof Date
          ? paidAt.toUTCString()
          : new Date(String(paidAt)).toUTCString();

      const subject = `New purchase: ${itemName} for ${money(amount)}`;

      const bodyHtml = `
        <p style="margin:0 0 16px;">${buyerName} just completed a purchase on ${branding.tenantName}.</p>

        <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin-bottom:16px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#71717a;">Customer</p>
          <table style="width:100%;font-size:14px;color:#374151;">
            ${detailRow("Name", buyerName)}
            ${member.email && !member.email.endsWith("@phone.user") ? detailRow("Email", member.email) : ""}
            ${member.phone ? detailRow("Phone", member.phone) : ""}
          </table>
        </div>

        <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin-bottom:16px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#71717a;">Purchase</p>
          <table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid #d4d4d8;">
                <th style="padding:6px 0;text-align:left;font-weight:600;">Item</th>
                <th style="padding:6px 0;text-align:center;font-weight:600;">Type</th>
                <th style="padding:6px 0;text-align:right;font-weight:600;">Amount</th>
              </tr>
            </thead>
            <tbody>${itemRowsHtml}</tbody>
            <tfoot>
              <tr style="border-top:1px solid #d4d4d8;">
                <td colspan="2" style="padding:6px 0;font-weight:600;">Subtotal</td>
                <td style="padding:6px 0;text-align:right;">${money(netAmount)}</td>
              </tr>
              ${
                taxAmount > 0
                  ? `<tr>
                      <td colspan="2" style="padding:4px 0;color:#71717a;">Tax</td>
                      <td style="padding:4px 0;text-align:right;color:#71717a;">${money(taxAmount)}</td>
                    </tr>`
                  : ""
              }
              <tr>
                <td colspan="2" style="padding:6px 0;font-weight:700;font-size:15px;">Total paid</td>
                <td style="padding:6px 0;text-align:right;font-weight:700;font-size:15px;">${money(amount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin-bottom:16px;">
          <p style="margin:0 0 8px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#71717a;">Payment</p>
          <table style="width:100%;font-size:14px;color:#374151;">
            ${detailRow("Order #", order.order_number)}
            ${detailRow("Paid on", paidAtLabel)}
            ${
              discountAmount > 0
                ? detailRow(
                    "Coupon applied",
                    order.coupon_code_snapshot
                      ? `${decodeEntities(order.coupon_code_snapshot)} (-${money(discountAmount)})`
                      : `-${money(discountAmount)}`,
                  )
                : ""
            }
            ${order.gateway_provider_name && order.gateway_provider_name !== NO_GATEWAY_PROVIDER
              ? detailRow("Gateway", order.gateway_provider_name)
              : ""}
            ${order.gateway_payment_id ? detailRow("Payment reference", order.gateway_payment_id) : ""}
            ${invoice?.invoice_number ? detailRow("Invoice", invoice.invoice_number) : ""}
          </table>
        </div>

        ${
          invoice?.invoice_url
            ? `<p style="margin:0 0 16px;font-size:13px;color:#71717a;">The customer's invoice is available <a href="${invoice.invoice_url}" style="color:#18181b;font-weight:600;">here</a>.</p>`
            : ""
        }
      `;

      const textBody = [
        `${buyerName} just purchased ${itemName} on ${branding.tenantName}.`,
        `Type: ${displayType}`,
        `Total paid: ${money(amount)}`,
        `Order #${order.order_number}`,
        `Paid on ${paidAtLabel}`,
        invoice?.invoice_url ? `Invoice: ${invoice.invoice_url}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await this.sendEmail({
        to: owner.email,
        subject,
        html: buildTenantBrandedEmailHtml({
          tenantName: branding.tenantName,
          tenantLogoUrl: branding.tenantLogoUrl,
          title: "New purchase",
          preheader: `${buyerName} purchased ${itemName} for ${money(amount)}`,
          bodyHtml,
          ctaButton: {
            text: "View in dashboard",
            url: `${config.ADMIN_PORTAL_URL}/dashboard/analytics/users`,
          },
        }),
        textBody,
        senderName: branding.tenantName,
      });

      logger.info(
        `[notification] Tenant purchase alert sent to owner for order ${orderId}`,
      );
    } catch (error) {
      logger.error(
        `[notification] Failed to send tenant purchase alert for order ${orderId}:`,
        error,
      );
      throw error;
    }
  }

  async processEnrollmentConfirmation(
    tenantId: string,
    memberId: string,
    metadata: { itemName: string; itemType: string; itemId: string },
  ): Promise<void> {
    try {
      const [member, branding, tenantBaseUrl] = await Promise.all([
        this.fetchMember(tenantId, memberId),
        this.fetchTenantBranding(tenantId),
        this.getTenantBaseUrl(tenantId),
      ]);

      if (!member) {
        logger.warn(
          `[notification] Member ${memberId} not found for enrollment notification`,
        );
        return;
      }

      const displayType = this.humanizeOrderType(metadata.itemType);

      // Send email. The in-app notification below goes out either way.
      if (
        member.email &&
        !member.email.endsWith("@phone.user")
      ) {
        await this.sendEmail({
          to: member.email,
          subject: `You're enrolled in ${metadata.itemName}`,
          html: buildTenantBrandedEmailHtml({
            style: branding.emailStyle,
            appLinks: branding.appLinks,
            tenantName: branding.tenantName,
            tenantLogoUrl: branding.tenantLogoUrl,
            title: "You're Enrolled!",
            preheader: `You now have access to ${metadata.itemName}`,
            bodyHtml: `
              <p style="margin:0 0 16px;">Great news! You've been enrolled in the following ${displayType.toLowerCase()}:</p>
              <div style="background:#f4f4f5;border-radius:8px;padding:16px;margin-bottom:16px;">
                <p style="margin:0;font-size:16px;font-weight:600;color:#18181b;">${metadata.itemName}</p>
                <p style="margin:4px 0 0;font-size:13px;color:#71717a;">${displayType}</p>
              </div>
              <p style="margin:0;">You can start accessing your content right away.</p>
            `,
            ctaButton: {
              text: "Start Learning",
              url: tenantBaseUrl,
            },
          }),
          textBody: `You're enrolled! You now have access to ${metadata.itemName} (${displayType}). Visit ${tenantBaseUrl} to start learning.`,
          senderName: branding.tenantName,
          engineRouting: {
            tenantId,
            category: "TRANSACTIONAL",
            idempotencyKey: `enrollment:${memberId}:${metadata.itemId}`,
          },
        });
      }

      // Create in-app notification
      await this.createInAppNotification(tenantId, memberId, {
        type: "ENROLLMENT_NEW",
        title: "You're Enrolled!",
        message: `You now have access to ${metadata.itemName}.`,
      });

      logger.info(
        `[notification] Enrollment confirmation sent for member ${memberId}, item ${metadata.itemName}`,
      );
    } catch (error) {
      logger.error(
        `[notification] Failed to process enrollment confirmation for ${memberId}:`,
        error,
      );
    }
  }

  /**
   * "Welcome to the course", the mail a buyer actually reads.
   *
   * A separate job from the receipt on purpose. The receipt proves money moved
   * and carries the invoice; this one tells the learner how to get in and
   * where the thing they bought now lives. Splitting them also means a bounce
   * or a retry on one can never re-send the other.
   *
   * Sign in steps are read off tenant_auth_config rather than written out
   * once, because a learner told to "use your password" on an academy that
   * only does one time codes has been given a wrong instruction, and that is
   * a support ticket on day one.
   */
  async processCourseWelcome(
    tenantId: string,
    orderId: string,
    memberId: string,
    orderType?: string,
  ): Promise<void> {
    try {
      const [ctx, tenantBaseUrl, signIn] = await Promise.all([
        this.buildPurchaseContext(tenantId, orderId, memberId, orderType),
        this.getTenantBaseUrl(tenantId),
        this.buildSignInSteps(tenantId, memberId),
      ]);

      if (!ctx) {
        logger.warn(
          `[notification] Member or order not found for course welcome: member=${memberId}, order=${orderId}`,
        );
        return;
      }

      const { member, branding, isCart, cartItems, itemName, displayType, itemThumbnailUrl } = ctx;

      if (!member.email || member.email.endsWith("@phone.user")) return;

      const items =
        isCart && cartItems && cartItems.length > 0
          ? cartItems.map((ci) => ({
              title: ci.title,
              type: this.humanizeOrderType(ci.item_type),
              thumbnailUrl: null as string | null,
            }))
          : [{ title: itemName, type: displayType, thumbnailUrl: itemThumbnailUrl }];

      const heading =
        items.length === 1 ? `Welcome to ${items[0].title}` : "Welcome aboard";
      const learningUrl = `${tenantBaseUrl}/my-learning`;

      // The artwork sits ABOVE the title inside the same card, full width, so
      // it reads the same on a phone as on a desktop. `width="100%"` on the tag
      // itself matters: Outlook ignores the CSS width and would otherwise print
      // the image at its natural pixel size and blow the card open.
      const itemRows = items
        .map(
          (it) =>
            `<div style="background:#f4f4f5;border-radius:8px;overflow:hidden;margin-bottom:10px;">
              ${
                it.thumbnailUrl
                  ? `<img src="${it.thumbnailUrl}" alt="${escapeAttribute(it.title)}" width="100%" style="display:block;width:100%;max-width:100%;height:auto;border:0;outline:none;" />`
                  : ""
              }
              <div style="padding:14px 16px;">
                <p style="margin:0;font-size:16px;font-weight:600;color:#18181b;">${it.title}</p>
                <p style="margin:4px 0 0;font-size:13px;color:#71717a;">${it.type}</p>
              </div>
            </div>`,
        )
        .join("");

      const hasApp = Boolean(
        branding.appLinks?.android || branding.appLinks?.ios,
      );
      const whereToFind = hasApp
        ? `<p style="margin:0 0 6px;">You will find it under My Learning, both on the website and in the ${branding.tenantName} app. The store links are at the bottom of this email.</p>`
        : `<p style="margin:0 0 6px;">You will find it under My Learning every time you sign in.</p>`;

      const bodyHtml = `
        <p style="margin:0 0 16px;">Hi ${member.name || "there"}, your access is ready. Here is what you can start on right now:</p>
        ${itemRows}
        <p style="margin:20px 0 8px;font-size:15px;font-weight:600;color:#18181b;">How to sign in</p>
        ${signIn.html}
        <p style="margin:18px 0 8px;font-size:15px;font-weight:600;color:#18181b;">Where to find it</p>
        ${whereToFind}
      `;

      const textBody = [
        `Welcome to ${branding.tenantName}.`,
        "",
        "You now have access to:",
        ...items.map((it) => `- ${it.title} (${it.type})`),
        "",
        "How to sign in:",
        signIn.text,
        "",
        `Open your learning at ${learningUrl}`,
      ].join("\n");

      await this.sendEmail({
        to: member.email,
        subject: heading,
        engineRouting: {
          tenantId,
          category: "TRANSACTIONAL",
          idempotencyKey: `course-welcome:${orderId}`,
        },
        html: buildTenantBrandedEmailHtml({
          style: branding.emailStyle,
          appLinks: branding.appLinks,
          tenantName: branding.tenantName,
          tenantLogoUrl: branding.tenantLogoUrl,
          title: heading,
          preheader: `Your access is ready. Here is how to sign in.`,
          bodyHtml,
          ctaButton: { text: "Start learning", url: learningUrl },
        }),
        textBody,
        senderName: branding.tenantName,
      });

      logger.info(
        `[notification] Course welcome sent for order ${orderId} to member ${memberId}`,
      );
    } catch (error) {
      logger.error(
        `[notification] Failed to process course welcome for order ${orderId}:`,
        error,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * The "how to sign in" block, written from the academy's own auth settings.
   *
   * Every academy switches on a different combination (one time code to a
   * phone, one time code to an email, a password, Google), and a buyer who is
   * told to use a password on an academy that has none writes to support
   * instead of signing in. So the steps are read off tenant_auth_config, and
   * the identifier shown back is the one that was actually captured at
   * checkout, so there is no guessing which email or number to type.
   *
   * Falls back to the platform default (email and password) when a tenant has
   * no row, which is what the login screen itself falls back to.
   */
  private async buildSignInSteps(
    tenantId: string,
    memberId: string,
  ): Promise<{ html: string; text: string }> {
    const [authConfig, member] = await Promise.all([
      authConfigRepository.findByTenantId(tenantId),
      this.fetchMember(tenantId, memberId),
    ]);

    const emailOtp = authConfig?.email_otp_enabled ?? false;
    const phoneOtp = authConfig?.phone_otp_enabled ?? false;
    const password = authConfig?.email_password_enabled ?? true;
    const google = authConfig?.google_oauth_enabled ?? false;

    const email =
      member?.email && !member.email.endsWith("@phone.user")
        ? member.email
        : null;
    const phone = member?.phone ?? null;

    // Each entry is a WAY IN, not a step. An academy with both one time codes
    // and passwords switched on offers a choice, and numbering them would
    // read as "do all four of these in order".
    const options: string[] = [];

    if (phoneOtp && emailOtp) {
      options.push(
        `Enter your mobile number${phone ? ` (${phone})` : ""} or your email address${email ? ` (${email})` : ""} and we send you a one time code. No password needed.`,
      );
    } else if (phoneOtp) {
      options.push(
        `Enter your mobile number${phone ? ` (${phone})` : ""} and we send a one time code to it. No password needed.`,
      );
    } else if (emailOtp) {
      options.push(
        `Enter your email address${email ? ` (${email})` : ""} and we send a one time code to it. No password needed.`,
      );
    }

    if (password) {
      options.push(
        `Use your email address${email ? ` (${email})` : ""} and your password. If you have not set one yet, tap Forgot password and we will email you a link.`,
      );
    }

    if (google) {
      options.push(
        `Continue with Google${email ? `, using ${email}` : ""}.`,
      );
    }

    if (options.length === 0) {
      options.push(
        `Use the email address you gave at checkout${email ? ` (${email})` : ""}.`,
      );
    }

    const lead =
      options.length > 1
        ? "Go to Sign in and pick whichever suits you:"
        : "Go to Sign in, then:";

    return {
      html: `<p style="margin:0 0 8px;">${lead}</p>
        <ul style="margin:0;padding-left:20px;">${options
          .map((option) => `<li style="margin:0 0 6px;">${option}</li>`)
          .join("")}</ul>`,
      text: [lead, ...options.map((option) => `- ${option}`)].join("\n"),
    };
  }

  private async getTenantBaseUrl(tenantId: string): Promise<string> {
    const domain = await db
      .selectFrom("tenant_domains")
      .select(["domain_name", "domain_type", "subdomain_prefix"])
      .where("tenant_id", "=", tenantId)
      .where("is_primary", "=", true)
      .where("status", "=", domain_status.ACTIVE)
      .executeTakeFirst();

    if (domain) {
      return `https://${domain.domain_name}`;
    }

    // Fallback: latest ACTIVE domain for this tenant
    const fallback = await db
      .selectFrom("tenant_domains")
      .select(["domain_name"])
      .where("tenant_id", "=", tenantId)
      .where("status", "=", domain_status.ACTIVE)
      .orderBy("created_at", "desc")
      .executeTakeFirst();

    if (fallback) {
      return `https://${fallback.domain_name}`;
    }

    // Fallback: latest domain in any usable status (pending verification/SSL)
    const anyDomain = await db
      .selectFrom("tenant_domains")
      .select(["domain_name"])
      .where("tenant_id", "=", tenantId)
      .where("status", "not in", [
        domain_status.FAILED,
        domain_status.REMOVING,
      ])
      .orderBy("created_at", "desc")
      .executeTakeFirst();

    if (anyDomain) {
      return `https://${anyDomain.domain_name}`;
    }

    // Last resort: construct from tenant slug + main domain
    const tenant = await db
      .selectFrom("tenants")
      .select(["slug"])
      .where("id", "=", tenantId)
      .executeTakeFirst();

    if (tenant?.slug) {
      return `https://${tenant.slug}.${config.MAIN_DOMAIN}`;
    }

    return config.FRONTEND_APP_URL;
  }

  /**
   * Everything both purchase emails need: the buyer, the tenant branding, the
   * order, and the resolved item name(s)/type. Shared by the buyer confirmation
   * and the tenant owner alert so the two can never describe the same order
   * differently.
   *
   * Titles are decoded here (the xss-sanitizer stores `&` as `&amp;`) because
   * every downstream sink (email subject/body, invoice PDF) is
   * plain text or tolerant HTML.
   */
  private async buildPurchaseContext(
    tenantId: string,
    orderId: string,
    memberId: string,
    orderType?: string,
  ) {
    const [member, branding, order] = await Promise.all([
      this.fetchMember(tenantId, memberId),
      this.fetchTenantBranding(tenantId),
      this.fetchOrder(tenantId, orderId),
    ]);

    if (!member || !order) return null;

    const num = (value: unknown): number =>
      typeof value === "string" ? parseFloat(value) : Number(value ?? 0);

    const amount = num(order.total_amount);
    const taxAmount = num(order.tax_amount);
    const netAmount = num(order.net_amount);
    const discountAmount = num(order.discount_amount);
    const currency = order.currency || "INR";
    const effectiveType = orderType || order.order_type;
    const isCart = effectiveType === "CART";

    let cartItems: ResolvedCartItem[] | undefined;
    let itemName: string;
    let displayType: string;
    // Only single item orders carry one. A cart has many, and the resolved
    // cart rows do not keep the ids a lookup would need.
    let itemThumbnailUrl: string | null = null;
    if (isCart) {
      cartItems = (await this.resolveCartItems(tenantId, orderId)).map((ci) => ({
        ...ci,
        title: decodeEntities(ci.title),
      }));
      itemName = `${cartItems.length} item${cartItems.length !== 1 ? "s" : ""}`;
      displayType = this.humanizeOrderType(effectiveType);
    } else {
      itemName = decodeEntities(await this.resolveOrderItemName(tenantId, order));
      displayType = await this.resolveItemTypeLabel(
        tenantId,
        effectiveType,
        order.item_id,
      );
      itemThumbnailUrl = await this.resolveOrderItemThumbnail(tenantId, order);
    }

    return {
      member,
      branding,
      order,
      amount,
      taxAmount,
      netAmount,
      discountAmount,
      currency,
      isCart,
      cartItems,
      itemName,
      displayType,
      itemThumbnailUrl,
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
    // Preserve the raw S3 key for direct S3 fetch (avoids public URL issues)
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

  private async fetchOrder(tenantId: string, orderId: string) {
    return db
      .selectFrom("payment_orders")
      .select([
        "id",
        "order_number",
        "tenant_member_id",
        "order_type",
        "item_id",
        "net_amount",
        "discount_amount",
        "coupon_code_snapshot",
        "total_amount",
        "tax_amount",
        "currency",
        "gateway_provider_name",
        "gateway_order_id",
        "gateway_payment_id",
        "metadata",
        "paid_at",
        "created_at",
      ])
      .where("id", "=", orderId)
      .where("tenant_id", "=", tenantId)
      .executeTakeFirst();
  }

  private async resolveOrderItemName(
    tenantId: string,
    order: { order_type: string; item_id: string | null },
  ): Promise<string> {
    if (!order.item_id) return "Purchase";

    try {
      switch (order.order_type) {
        case "COURSE": {
          const course = await db
            .selectFrom("courses")
            .select(["title"])
            .where("id", "=", order.item_id)
            .where("tenant_id", "=", tenantId)
            .executeTakeFirst();
          return course?.title || "Course";
        }
        case "BOOK": {
          const book = await db
            .selectFrom("books")
            .select(["title"])
            .where("id", "=", order.item_id)
            .where("tenant_id", "=", tenantId)
            .executeTakeFirst();
          return book?.title || "Book";
        }
        case "BUNDLE": {
          const bundle = await db
            .selectFrom("bundles")
            .select(["title"])
            .where("id", "=", order.item_id)
            .where("tenant_id", "=", tenantId)
            .executeTakeFirst();
          return bundle?.title || "Bundle";
        }
        case "BATCH": {
          const batch = await db
            .selectFrom("batches")
            .select(["title"])
            .where("id", "=", order.item_id)
            .where("tenant_id", "=", tenantId)
            .executeTakeFirst();
          return batch?.title || "Batch";
        }
        case "TEST_SERIES": {
          const series = await db
            .selectFrom("test_series")
            .select(["title"])
            .where("id", "=", order.item_id)
            .where("tenant_id", "=", tenantId)
            .executeTakeFirst();
          return series?.title || "Test Series";
        }
        default:
          return "Purchase";
      }
    } catch {
      return "Purchase";
    }
  }

  /**
   * The artwork for what was bought, as an absolute URL an inbox can load.
   *
   * Each table names its image differently, and some store an S3 key while
   * others already hold a full URL, so both shapes are handled. Returns null
   * when there is no image, and the caller then renders the card without one
   * rather than leaving a broken box in the email.
   */
  private async resolveOrderItemThumbnail(
    tenantId: string,
    order: { order_type: string; item_id: string | null },
  ): Promise<string | null> {
    if (!order.item_id) return null;

    const toUrl = (value: string | null | undefined, base: string): string | null => {
      if (!value?.trim()) return null;
      const v = value.trim();
      if (v.startsWith("http://") || v.startsWith("https://")) return v;
      // Some rows hold a base64 data URI rather than a key. Those are useless
      // here: Gmail and Outlook both refuse to render a data URI image, and
      // one seen in dev was 1.5MB on its own, which would push the message
      // past what SES will even accept. Drop the picture instead.
      if (v.startsWith("data:")) return null;
      if (!base) return null;
      return `${base}/${v.startsWith("/") ? v.slice(1) : v}`;
    };

    const first = async (
      table: "courses" | "books" | "bundles" | "batches" | "test_series",
      column: string,
      base: string = config.THUMBNAILS_BASE_URL,
    ): Promise<string | null> => {
      const row = await db
        .selectFrom(table)
        .select(column as never)
        .where("id", "=", order.item_id as string)
        .where("tenant_id", "=", tenantId)
        .executeTakeFirst();
      return toUrl((row as Record<string, string | null> | undefined)?.[column], base);
    };

    try {
      switch (order.order_type) {
        case "COURSE":
          return await first("courses", "thumbnail_key");
        case "BOOK":
          return await first("books", "thumbnail_url");
        case "BUNDLE":
          return await first("bundles", "thumbnail_url");
        case "BATCH":
          return (
            (await first("batches", "thumbnail_url")) ??
            (await first("batches", "web_thumbnail_key"))
          );
        case "TEST_SERIES":
          return await first("test_series", "cover_image_key");
        default:
          return null;
      }
    } catch {
      // An email is worth sending without its picture.
      return null;
    }
  }

  private humanizeOrderType(type: string): string {
    const map: Record<string, string> = {
      COURSE: "Course",
      BOOK: "Book",
      BUNDLE: "Bundle",
      BATCH: "Batch",
      TEST_SERIES: "Test Series",
      CART: "Cart Order",
    };
    return map[type] || "Item";
  }

  /** Human label for the purchased item's type. */
  private async resolveItemTypeLabel(
    _tenantId: string,
    orderType: string,
    _itemId: string | null,
  ): Promise<string> {
    return this.humanizeOrderType(orderType);
  }

  /** Tenant owner's email, the recipient of staff-facing purchase alerts. */
  private async fetchTenantOwner(
    tenantId: string,
  ): Promise<{ name: string; email: string } | undefined> {
    return db
      .selectFrom("tenants")
      .innerJoin("tenant_users", "tenants.owner_user_id", "tenant_users.id")
      .select(["tenant_users.name", "tenant_users.email"])
      .where("tenants.id", "=", tenantId)
      .executeTakeFirst();
  }

  private async generateAndUploadInvoice(
    tenantId: string,
    orderId: string,
    ctx: {
      branding: TenantBranding;
      member: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
      };
      order: {
        net_amount: unknown;
        currency: string | null;
        gateway_payment_id: string | null;
        created_at: unknown;
        metadata?: unknown;
      };
      itemName: string;
      amount: number;
      currency: string;
      cartItems?: ResolvedCartItem[];
    },
  ): Promise<string> {
    const invoiceNumber = generateInvoiceNumber("INV");

    // Read tax config from order metadata snapshot, fallback to defaults
    const meta =
      ctx.order.metadata && typeof ctx.order.metadata === "object"
        ? (ctx.order.metadata as Record<string, unknown>)
        : {};
    const taxSnapshot = meta.tax_config as
      | { mode?: string; percentage?: number; isIndian?: boolean }
      | undefined;
    const taxPercentage = taxSnapshot?.percentage ?? 18;
    const isIndian = taxSnapshot?.isIndian ?? ctx.currency === "INR";

    const taxBreakdown = calculateTaxBreakdown(ctx.amount, ctx.currency, {
      taxPercentage,
      taxMode: "INCLUSIVE",
      isIndian,
    });

    // Pre-fetch tenant logo via S3 SDK (avoids public URL / ACL issues)
    // Prefer light logo, fallback to dark, then convert to PNG if needed (PDFKit only supports PNG/JPEG)
    const logoS3Key =
      ctx.branding.tenantLogoS3Key ?? ctx.branding.tenantLogoDarkS3Key;
    logger.info(
      `[invoice] Logo key: light=${ctx.branding.tenantLogoS3Key ?? "none"}, dark=${ctx.branding.tenantLogoDarkS3Key ?? "none"}, selected=${logoS3Key ?? "none"}`,
    );

    let sellerLogoBuffer: Buffer | undefined;
    if (logoS3Key) {
      const cached = _convertedLogoCache.get(logoS3Key);
      if (cached) {
        sellerLogoBuffer = cached;
        logger.info(
          `[invoice] Logo cache hit for key=${logoS3Key} (${cached.length} bytes)`,
        );
      } else {
        try {
          const bucket = config.TENANT_DETAILS_S3_BUCKET;
          logger.info(
            `[invoice] Fetching logo from S3: bucket=${bucket}, key=${logoS3Key}`,
          );
          const rawBuffer = await getS3ObjectBuffer(bucket, logoS3Key);
          logger.info(`[invoice] Logo fetched: ${rawBuffer.length} bytes`);

          // PDFKit only supports PNG/JPEG, convert otherwise (e.g. WebP from upload pipeline)
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
            logger.info(
              `[invoice] Logo is native PNG/JPEG, no conversion needed`,
            );
          } else {
            sellerLogoBuffer = await sharp(rawBuffer).png().toBuffer();
            logger.info(
              `[invoice] Converted logo to PNG: ${rawBuffer.length} -> ${sellerLogoBuffer.length} bytes`,
            );
          }

          // Cache the converted buffer
          if (_convertedLogoCache.size >= MAX_LOGO_CACHE) {
            const firstKey = _convertedLogoCache.keys().next().value;
            if (firstKey) _convertedLogoCache.delete(firstKey);
          }
          _convertedLogoCache.set(logoS3Key, sellerLogoBuffer);
        } catch (err) {
          logger.warn(
            `[invoice] Failed to fetch/convert tenant logo: ${(err as Error).message}`,
          );
        }
      }
    }

    // Build line items: itemized for cart orders, single line for standard orders
    let items: InvoiceData["items"];
    let subtotal: number;
    if (ctx.cartItems && ctx.cartItems.length > 0) {
      // Cart order: one line per cart item, tax applied on the total
      const cartSubtotal = ctx.cartItems.reduce(
        (sum, ci) => sum + ci.net_amount,
        0,
      );
      const cartTaxBreakdown = calculateTaxBreakdown(ctx.amount, ctx.currency, {
        taxPercentage,
        taxMode: "INCLUSIVE",
        isIndian,
      });
      // Derive per-item tax-exclusive amounts proportionally
      const ratio = cartTaxBreakdown.subtotal / (cartSubtotal || 1);
      items = ctx.cartItems.map((ci) => {
        const taxExclusive = +(ci.net_amount * ratio).toFixed(2);
        return {
          description: ci.title,
          quantity: 1,
          unitPrice: taxExclusive,
          amount: taxExclusive,
        };
      });
      subtotal = cartTaxBreakdown.subtotal;
    } else {
      items = [
        {
          description: ctx.itemName,
          quantity: 1,
          unitPrice: taxBreakdown.subtotal,
          amount: taxBreakdown.subtotal,
        },
      ];
      subtotal = taxBreakdown.subtotal;
    }

    const invoiceData: InvoiceData = {
      invoiceNumber,
      invoiceDate:
        ctx.order.created_at instanceof Date
          ? ctx.order.created_at
          : new Date(),
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
      items,
      currency: ctx.currency,
      subtotal,
      taxBreakdown: {
        cgst: taxBreakdown.cgst,
        sgst: taxBreakdown.sgst,
        totalTax: taxBreakdown.totalTax,
      },
      taxPercentage,
      isIndian,
      totalAmount: taxBreakdown.total,
      transactionId: ctx.order.gateway_payment_id ?? undefined,
      paymentMethod: "Online Payment",
    };

    const pdfBuffer = await generateInvoicePdf(invoiceData);
    const key = `invoices/${tenantId}/${orderId}/${invoiceNumber}.pdf`;
    const url = await uploadInvoiceToS3({ key, body: pdfBuffer });

    // Record invoice in database
    try {
      await invoiceRepository.create({
        id: ulid(),
        tenant_id: tenantId,
        invoice_number: invoiceNumber,
        invoice_type: "USER_PURCHASE",
        order_id: orderId,
        member_id: ctx.member.id,
        currency: ctx.currency,
        subtotal,
        tax_amount: taxBreakdown.totalTax,
        total_amount: ctx.amount,
        invoice_url: url,
        s3_key: key,
        payment_method: "Online Payment",
        transaction_id: ctx.order.gateway_payment_id ?? undefined,
      });
    } catch (err) {
      logger.warn(
        `[notification] Failed to record invoice in DB: ${(err as Error).message}`,
      );
    }

    return url;
  }

  private async resolveCartItems(
    tenantId: string,
    orderId: string,
  ): Promise<ResolvedCartItem[]> {
    const rows = await cartOrderItemsRepo.findByOrderId(tenantId, orderId);
    if (rows.length === 0) return [];

    // Batch-collect all item IDs by type
    const courseIds = rows.filter((r) => r.course_id).map((r) => r.course_id!);
    const bookIds = rows.filter((r) => r.book_id).map((r) => r.book_id!);
    const bundleIds = rows.filter((r) => r.bundle_id).map((r) => r.bundle_id!);
    const batchIds = rows.filter((r) => r.batch_id).map((r) => r.batch_id!);

    // Batch fetch titles
    const titleMap = new Map<string, string>();
    const queries: Promise<void>[] = [];
    if (courseIds.length > 0) {
      queries.push(
        db
          .selectFrom("courses")
          .select(["id", "title"])
          .where("tenant_id", "=", tenantId)
          .where("id", "in", courseIds)
          .execute()
          .then((rows) => rows.forEach((r) => titleMap.set(r.id, r.title))),
      );
    }
    if (bookIds.length > 0) {
      queries.push(
        db
          .selectFrom("books")
          .select(["id", "title"])
          .where("tenant_id", "=", tenantId)
          .where("id", "in", bookIds)
          .execute()
          .then((rows) => rows.forEach((r) => titleMap.set(r.id, r.title))),
      );
    }
    if (bundleIds.length > 0) {
      queries.push(
        db
          .selectFrom("bundles")
          .select(["id", "title"])
          .where("tenant_id", "=", tenantId)
          .where("id", "in", bundleIds)
          .execute()
          .then((rows) => rows.forEach((r) => titleMap.set(r.id, r.title))),
      );
    }
    if (batchIds.length > 0) {
      queries.push(
        db
          .selectFrom("batches")
          .select(["id", "title"])
          .where("tenant_id", "=", tenantId)
          .where("id", "in", batchIds)
          .execute()
          .then((rows) => rows.forEach((r) => titleMap.set(r.id, r.title))),
      );
    }
    await Promise.all(queries);

    return rows.map((row) => {
      const itemId =
        row.course_id ||
        row.book_id ||
        row.bundle_id ||
        row.batch_id ||
        "";
      return {
        title: titleMap.get(itemId) || this.humanizeOrderType(row.item_type),
        item_type: row.item_type,
        net_amount: parseFloat(row.net_amount),
      };
    });
  }

  private async createInAppNotification(
    tenantId: string,
    memberId: string,
    data: { type: string; title: string; message: string },
  ): Promise<void> {
    try {
      const now = new Date();
      await db
        .insertInto("member_notifications")
        .values({
          id: ulid(),
          tenant_id: tenantId,
          member_id: memberId,
          type: data.type as member_notification_type,
          title: data.title,
          message: data.message,
          is_read: false,
          created_at: now,
          updated_at: now,
        })
        .execute();
    } catch (error) {
      logger.error(
        `[notification] Failed to create in-app notification for ${memberId}:`,
        error,
      );
    }
  }

  /**
   * Public email sender, used by support emails and other modules that
   * need to share the SES wiring (verified sender, region, error logging).
   */
  /**
   * Public send helper used by support-email and any caller outside the
   * standard purchase/welcome processors. Accepts optional `engineRouting`
   * so END_USER callers route through the email engine while TENANT_STAFF
   * callers stay on the legacy SES path.
   */
  async sendCustomEmail(params: {
    to: string;
    subject: string;
    html: string;
    textBody: string;
    senderName?: string;
    engineRouting?: NotificationEngineRouting;
  }): Promise<void> {
    return this.sendEmail(params);
  }

  /**
   * Phase 10 retrofit: when `engineRouting` is provided, try the email
   * engine first. The engine routes through the tenant's verified sending
   * domain when configured; on legacy mode we fall through to the unchanged
   * SES call so the FROM line stays
   * `"{senderName} <{config.AWS_SES_FROM_EMAIL}>"`.
   *
   * Errors are swallowed (not re-thrown) to preserve existing behavior:
   * notification sends are background jobs that must not crash the queue
   * worker on a single bad recipient.
   */
  private async sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    textBody: string;
    senderName?: string;
    engineRouting?: NotificationEngineRouting;
  }): Promise<void> {
    if (params.engineRouting) {
      try {
        const result = await sendThroughEngine({
          tenantId: params.engineRouting.tenantId,
          category: params.engineRouting.category,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.textBody,
          senderName: params.senderName,
          idempotencyKey: params.engineRouting.idempotencyKey,
        });
        if (result.mode === "custom") {
          logger.info(
            `[notification] Engine send to ${params.to} (tenant=${params.engineRouting.tenantId}): ${params.subject}`,
          );
          return;
        }
        // mode === "legacy", fall through to platform SES below.
      } catch (err) {
        if (err instanceof EmailError) {
          if (err.code === "SUPPRESSED") {
            logger.info(
              `[notification] Skipped suppressed recipient ${params.to} for tenant ${params.engineRouting.tenantId}`,
            );
            return;
          }
          if (err.code === "RATE_LIMITED" || err.code === "SES_FAILED" || err.code === "RENDER_FAILED") {
            // Log + swallow (existing semantics for notification.sendEmail).
            logger.error(
              `[notification] Engine ${err.code} for ${params.to}: ${err.message}`,
            );
            return;
          }
          // Other engine codes: fall through to legacy.
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

    // Legacy SES path, unchanged behavior for callers without engineRouting
    // and for legacy-fallback callers above.
    const source = params.senderName
      ? `${params.senderName} <${config.AWS_SES_FROM_EMAIL}>`
      : config.AWS_SES_FROM_EMAIL;

    const command = new SendEmailCommand({
      Destination: { ToAddresses: [params.to] },
      Message: {
        Body: {
          Html: { Charset: "UTF-8", Data: params.html },
          Text: { Charset: "UTF-8", Data: params.textBody },
        },
        Subject: { Charset: "UTF-8", Data: params.subject },
      },
      Source: source,
    });

    try {
      await sesClient.send(command);
      logger.info(
        `[notification] Email sent to ${params.to}: ${params.subject}`,
      );
    } catch (error) {
      logger.error(
        `[notification] Failed to send email to ${params.to}:`,
        error,
      );
    }
  }
}

/**
 * Routing hint passed to sendEmail / sendCustomEmail. When present, the
 * notification.service tries the email engine first; otherwise it goes
 * straight to the legacy SES path (used by historical callers + by
 * TENANT_STAFF audience sends from support-email).
 */
export interface NotificationEngineRouting {
  tenantId: string;
  category: "TRANSACTIONAL" | "NOTIFICATION" | "MARKETING";
  /** Optional stable key for idempotent retries. */
  idempotencyKey?: string;
}

export default new NotificationService();
