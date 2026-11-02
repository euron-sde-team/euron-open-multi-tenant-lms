import config from "../config";
/**
 * The tenant-branded email wrapper, every learner-facing mail flows through
 * here, which makes it the single place the platform's mail DESIGN lives.
 *
 * TWO STYLES, ONE SHAPE (2026-08-25, owner directive)
 * ---------------------------------------------------
 * "luxe" (the default): the iOS-luxe family, airy white card on soft system
 * gray, large tight title, pill CTA, generous spacing. The same design
 * language as the campaign template library in the tenant-admin backend, so a
 * learner's enrollment mail and the academy's campaigns finally look related.
 *
 * "simple": the previous design, kept intact as the per-tenant opt-out.
 *
 * Callers pass `style`; omitted means luxe. The per-tenant preference lookup
 * lives in the services (tenant_org_details.metadata.email_style), not here.
 * this stays a pure function so it renders identically in tests and previews.
 *
 * EMAIL HTML RULES: inline styles only (no <style> blocks, clients strip
 * them and the platform's content-safety layer refuses them), fluid tables
 * capped at 560px, paddings and sizes chosen to read well at 360px.
 */

export type TenantEmailStyle = "luxe" | "simple";

export interface TenantBrandedEmailOptions {
  tenantName: string;
  tenantLogoUrl?: string;
  title?: string;
  preheader?: string;
  bodyHtml: string;
  ctaButton?: { text: string; url: string };
  footerText?: string;
  style?: TenantEmailStyle;
  /**
   * The academy's own mobile apps, when it has them (tenant_org_details).
   * Rendered as store buttons beside the footer, so a learner who is told to
   * "open the app" in the body has the app one tap away.
   */
  appLinks?: { android?: string | null; ios?: string | null };
}

/**
 * The official store badges, served from the same public bucket the tenant
 * logos in these emails already come from (TENANT_DETAILS_BASE_URL, under
 * general/badges/). Upload the two images there when tenants link apps.
 *
 * Google and Apple both require their own artwork rather than a look alike,
 * and both ask that the two badges be shown at the SAME height, which is why
 * the pair was normalised to 40px before upload. They are stored at twice that
 * so they stay sharp on a retina screen.
 *
 * Every badge carries its wording as alt text, so a reader whose client blocks
 * remote images still sees "Get it on Google Play" and can click through.
 */
const STORE_BADGES = {
  android: {
    src: `${config.TENANT_DETAILS_BASE_URL}/general/badges/google-play.png`,
    alt: "Get it on Google Play",
    width: 135,
  },
  ios: {
    src: `${config.TENANT_DETAILS_BASE_URL}/general/badges/app-store.png`,
    alt: "Download on the App Store",
    width: 120,
  },
} as const;

function appStoreButtonsHtml(
  appLinks: TenantBrandedEmailOptions["appLinks"],
  muted: string,
): string {
  const android = appLinks?.android?.trim();
  const ios = appLinks?.ios?.trim();
  if (!android && !ios) return "";

  const badge = (url: string, badge: (typeof STORE_BADGES)[keyof typeof STORE_BADGES]) =>
    `<a href="${url}" style="display:inline-block;margin:0 4px;text-decoration:none;"><img src="${badge.src}" alt="${badge.alt}" width="${badge.width}" height="40" style="display:inline-block;width:${badge.width}px;height:40px;border:0;outline:none;" /></a>`;

  return `<div style="text-align:center;padding-top:4px;">
    <p style="margin:0 0 10px;font-family:${FONT};font-size:12px;color:${muted};">Get the app</p>
    ${android ? badge(android, STORE_BADGES.android) : ""}
    ${ios ? badge(ios, STORE_BADGES.ios) : ""}
  </div>`;
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function docShell(title: string, tenantName: string, bg: string, inner: string, preheader?: string): string {
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || tenantName}</title>
</head>
<body style="margin:0;padding:0;font-family:${FONT};background-color:${bg};">
  ${preheaderHtml}
  ${inner}
</body>
</html>`;
}

/** The luxe rendering: what "premium" looks like in an inbox. */
function luxe(options: TenantBrandedEmailOptions): string {
  const { tenantName, tenantLogoUrl, title, bodyHtml, ctaButton } = options;

  const logo = tenantLogoUrl
    ? `<img src="${tenantLogoUrl}" alt="${tenantName}" style="max-height:44px;max-width:170px;object-fit:contain;display:block;margin:0 auto 10px;" />`
    : "";

  const inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f2f2f7;padding:36px 14px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">
        <tr><td style="text-align:center;padding-bottom:20px;">
          ${logo}
          <span style="font-family:${FONT};font-size:12.5px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#8e8e93;">${tenantName}</span>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:22px;padding:38px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
          ${title ? `<h1 style="font-family:${FONT};font-size:26px;line-height:1.2;font-weight:700;letter-spacing:-0.4px;color:#1c1c1e;margin:0 0 16px;">${title}</h1>` : ""}
          <div style="font-family:${FONT};font-size:15.5px;color:#3a3a3c;line-height:1.65;">
            ${bodyHtml}
          </div>
          ${
            ctaButton
              ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 4px;"><tr><td style="border-radius:999px;background:#0a84ff;">
                   <a href="${ctaButton.url}" style="display:inline-block;font-family:${FONT};font-size:15.5px;font-weight:600;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:999px;">${ctaButton.text}</a>
                 </td></tr></table>`
              : ""
          }
        </td></tr>
        <tr><td style="text-align:center;padding-top:20px;">
          ${appStoreButtonsHtml(options.appLinks, "#aeaeb2")}
          <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:#aeaeb2;">${
            options.footerText ?? `This email was sent by ${tenantName}. If you have questions, please contact support.`
          }</p>
        </td></tr>
      </table>
    </td></tr>
  </table>`;

  return docShell(title ?? "", tenantName, "#f2f2f7", inner, options.preheader);
}

/** The previous design, preserved verbatim as the opt-out. */
function simple(options: TenantBrandedEmailOptions): string {
  const { tenantName, tenantLogoUrl, title, bodyHtml, ctaButton, footerText } = options;

  const logoSection = tenantLogoUrl
    ? `<div style="text-align:center;margin-bottom:16px;"><img src="${tenantLogoUrl}" alt="${tenantName}" style="max-height:48px;max-width:180px;object-fit:contain;" /></div>`
    : "";

  const titleHtml = title
    ? `<h2 style="margin:0 0 16px 0;font-size:22px;font-weight:700;color:#18181b;line-height:1.3;">${title}</h2>`
    : "";

  const ctaHtml = ctaButton
    ? `<div style="text-align:center;margin:28px 0;">
        <a href="${ctaButton.url}" style="display:inline-block;background-color:#1e3a5f;color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;text-decoration:none;padding:14px 28px;border-radius:8px;">${ctaButton.text}</a>
      </div>`
    : "";

  const footer = footerText ?? `This email was sent by ${tenantName}. If you have questions, please contact support.`;

  const inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:540px;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
              <div style="padding:32px 32px 24px;">
                ${logoSection}
                <h3 style="margin:0 0 20px 0;font-size:18px;font-weight:600;color:#18181b;text-align:center;">${tenantName}</h3>
                ${titleHtml}
                <div style="font-size:15px;color:#374151;line-height:1.7;">
                  ${bodyHtml}
                </div>
                ${ctaHtml}
              </div>
              <div style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
                ${appStoreButtonsHtml(options.appLinks, "#a1a1aa")}
                <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">${footer}</p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;

  return docShell(title ?? "", tenantName, "#f4f4f5", inner, options.preheader);
}

export function buildTenantBrandedEmailHtml(options: TenantBrandedEmailOptions): string {
  return (options.style ?? "luxe") === "simple" ? simple(options) : luxe(options);
}
