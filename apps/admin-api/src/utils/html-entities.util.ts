/**
 * Decode HTML entities (e.g. &amp; -> &) so user-authored strings render
 * correctly outside the web UI (Excel exports, plain-text emails, CSVs).
 *
 * The tenant-admin backend's express-xss-sanitizer escapes special characters
 * in request bodies, so data persisted via the editor arrives here
 * pre-encoded. UI consumers undo this with the frontend's `decodeHtmlEntities`
 * (in `@open-mtlms/lms-templates` / `@open-mtlms/shared`). Non-UI consumers like the
 * .xlsx export do not pass through that decode, so they need this helper.
 */
export function decodeHtmlEntities(
  value: string | null | undefined
): string {
  if (value == null || typeof value !== "string") return "";
  if (!value.includes("&")) return value;
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}
