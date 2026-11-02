export interface EmailBrand {
  /** Display name, falls back to a text wordmark when there is no logo. */
  name: string;
  /** Public logo URL. Null/undefined is normal: most tenants never upload one. */
  logoUrl?: string | null;
}

export interface EmailTemplateOptions {
  title: string;
  preheader?: string;
  bodyHtml: string;
  ctaButton?: { text: string; url: string };
  footerText?: string;
  /**
   * Whose letterhead this is.
   *
   * Omit for platform mail (staff alerts, system notices), it keeps the platform
   * mark. Supply it for anything an END BUYER receives: they bought from
   * the tenant and have often never heard of the platform, so a platform-branded receipt
   * reads as a phishing attempt.
   */
  brand?: EmailBrand;
}

import { PLATFORM_COMPANY } from "./company-constants";

/**
 * Escape a value that came from the database rather than from a caller that
 * already escaped it, tenant names are user-controlled and land in the header,
 * the <title> and the footer.
 */
function escBrand(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The shared shell every transactional email in this service renders into.
 *
 * Layout notes, because email is not the web:
 *  • Desktop values stay INLINE on each element, that is the only styling a
 *    stripped-down client is guaranteed to honour, so the mail degrades to the
 *    wide, roomy layout rather than to no layout at all.
 *  • The <style> block only ever *narrows* padding under 600px. Gmail, Apple
 *    Mail and Outlook.com all support embedded styles and media queries; the
 *    handful of clients that strip <style> simply keep the desktop padding.
 *    Nothing depends on the media query to be readable.
 *  • color-scheme is declared so clients that auto-invert (Gmail dark mode)
 *    know the design is light and re-map it coherently instead of guessing.
 */
export function buildEmailHtml(options: EmailTemplateOptions): string {
  const { title, preheader, bodyHtml, ctaButton, footerText, brand } = options;

  const brandName = brand ? escBrand(brand.name.trim() || "Store") : null;

  /**
   * The tenant's name, always rendered as real text under their logo.
   *
   * Not the logo's alt attribute, the name has to survive the cases where the
   * image does not. Tenant logos are stored as .webp, which Outlook on Windows
   * cannot decode, and most clients block remote images until the reader allows
   * them. Because the name is live text the header stays correct in every one of
   * those cases; the logo is then decorative, so its alt is deliberately empty
   * rather than repeating the name that already sits below it.
   */
  const brandNameHtml = brandName
    ? `<div class="brandname" style="font-family:Inter,Arial,sans-serif;font-size:17px;font-weight:700;color:#111827;letter-spacing:-0.01em;line-height:1.35;">${brandName}</div>`
    : "";

  /**
   * Header mark:
   *   tenant logo + tenant name  →  tenant name alone  →  the platform logo (or name).
   *
   * A tenant with no uploaded logo gets their name in plain type, never
   * somebody else's brand at the top of their customer's receipt.
   */
  const headerMark = brand
    ? brand.logoUrl
      ? `<img src="${brand.logoUrl}" alt="" class="brandlogo" style="display:block;margin:0 auto 10px auto;max-width:170px;max-height:48px;width:auto;height:auto;" />
              ${brandNameHtml}`
      : brandNameHtml
    : PLATFORM_COMPANY.logoUrl
      ? `<img src="${PLATFORM_COMPANY.logoUrl}" alt="${escBrand(PLATFORM_COMPANY.name)}" width="180" class="logo" style="display:inline-block;width:180px;max-width:180px;height:auto;" />`
      : `<div style="font-size:20px;font-weight:700;color:#111827;">${escBrand(PLATFORM_COMPANY.name)}</div>`;

  const defaultFooter = brandName
    ? `This email was sent by ${brandName} regarding your order. If you have questions, just reply to it.`
    : "You are receiving this email because you have an account on our platform.";

  // Preheaders carry user-authored text (product titles reach them via the store
  // emails), and unescaped markup here escapes the hidden div and renders as
  // visible email content.
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:#f4f4f5;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escBrand(preheader)}</div>`
    : "";

  const ctaHtml = ctaButton
    ? `
              <div style="margin:28px 0 4px 0;">
                <a href="${ctaButton.url}" class="btn"
                   style="display:block;background-color:#1e3a5f;color:#ffffff;font-family:Inter,Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:13px 28px;border-radius:8px;letter-spacing:0.01em;text-align:center;">
                  ${ctaButton.text}
                </a>
              </div>`
    : "";

  const footerHtml = footerText ?? defaultFooter;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${brandName ? `${title} - ${brandName}` : title}</title>
  <style>
    :root { color-scheme: light; supported-color-schemes: light; }
    body { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-collapse:collapse; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { color:#1e3a5f; }

    /* The CTA is full-width on phones and shrinks to its label on desktop, so a
       narrow screen gets an easy tap target without a stretched button on wide ones. */
    @media screen and (min-width:601px) {
      .btn { display:inline-block !important; width:auto !important; }
      .cta-wrap { text-align:center !important; }
    }

    /* Phones. 40px of side padding inside a ~340px viewport spends a quarter of
       the screen on whitespace, which is what made the copy wrap every 3 words. */
    @media screen and (max-width:600px) {
      .outer      { padding:12px 8px !important; }
      .card-head  { padding:20px 16px !important; }
      .card-body  { padding:24px 18px !important; }
      .logo       { width:140px !important; max-width:140px !important; }
      .brandlogo  { max-width:140px !important; max-height:40px !important; }
      .brandname  { font-size:16px !important; }
      .title      { font-size:20px !important; }
      .rule       { margin:24px 0 !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Inter,Arial,sans-serif;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;">
    <tr>
      <td class="outer" align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" style="max-width:600px;" cellpadding="0" cellspacing="0">
          <!-- Header -->
          <tr>
            <td class="card-head" style="background-color:#ffffff;border-bottom:1px solid #e5e7eb;border-radius:12px 12px 0 0;padding:24px 40px;text-align:center;">
              ${headerMark}
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="card-body" style="background-color:#ffffff;padding:36px 40px;border-radius:0 0 12px 12px;">
              <h2 class="title" style="margin:0 0 14px 0;font-size:22px;font-weight:700;color:#111827;line-height:1.3;">${title}</h2>
              <div style="font-size:15px;color:#374151;line-height:1.65;">
                ${bodyHtml}
              </div>
              <div class="cta-wrap">${ctaHtml}</div>
              <hr class="rule" style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 20px 0;" />
              <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">${footerHtml}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
