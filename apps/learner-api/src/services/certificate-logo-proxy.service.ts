import config from "../config";
import { BadRequestError } from "../errors/bad-request.error";
import { NotFoundError } from "../errors/not-found.error";

/**
 * Certificate logo proxy service.
 *
 * Why this exists: certificate templates render `<img src={logoUrl}>` without
 * `crossOrigin` so the on-screen display works regardless of the logo bucket's
 * CORS posture. The PDF exporter, however, must read pixel data via canvas to
 * produce a base64 data URL and embed the logo in the generated PDF. Reading
 * pixels requires the browser to have received the image with a matching
 * `Access-Control-Allow-Origin` header, something we can't assume for every
 * tenant S3 bucket.
 *
 * This service fetches the logo server-side (no browser CORS enforcement) and
 * lets the controller stream the bytes back with CORS headers we control. The
 * frontend then converts the bytes to a same-origin data URL and embeds it.
 *
 * Safety:
 * - Hostname allowlist prevents SSRF, only known object-storage/CDN hosts.
 * - HTTP(S) only.
 * - 8-second fetch timeout.
 * - 10 MB response cap (header + post-read).
 * - Content-type must start with `image/` (defense-in-depth against HTML/JS).
 */

const MAX_LOGO_BYTES = 10 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8_000;

// Object-storage / CDN hosts (suffix match), from CERTIFICATE_LOGO_HOSTS.
const ALLOWED_HOST_SUFFIXES = config.CERTIFICATE_LOGO_HOSTS.map((h) =>
  h.startsWith(".") ? h : `.${h}`
);

function isHostAllowed(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

export interface LogoProxyResult {
  contentType: string;
  buffer: Buffer;
}

class CertificateLogoProxyService {
  async fetchLogo(rawUrl: string): Promise<LogoProxyResult> {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      throw new BadRequestError("Invalid logo URL");
    }

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new BadRequestError("Unsupported URL scheme");
    }

    if (!isHostAllowed(parsed.hostname)) {
      throw new BadRequestError("Logo origin not permitted");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(parsed.toString(), {
        signal: controller.signal,
        redirect: "follow",
      });

      // SSRF hardening: re-validate the FINAL URL after redirects. The initial
      // host check covers the first hop, but `fetch` followed redirects blindly
      // otherwise, an attacker-controlled allowlisted host could 302-redirect
      // to an internal target (e.g. cloud metadata service) and exfiltrate
      // secrets through this proxy. Rejecting final hosts outside the allowlist
      // closes that hole without breaking legitimate S3/CloudFront redirects
      // (which stay within the same allowlist suffixes).
      try {
        const finalHost = new URL(response.url).hostname;
        if (!isHostAllowed(finalHost)) {
          throw new BadRequestError("Redirect target not permitted");
        }
      } catch (err) {
        if (err instanceof BadRequestError) throw err;
        throw new BadRequestError("Invalid redirect target");
      }

      if (!response.ok) {
        throw new NotFoundError(`Upstream responded ${response.status}`);
      }

      const contentType = (response.headers.get("content-type") || "image/png").split(";")[0].trim();
      if (!contentType.toLowerCase().startsWith("image/")) {
        throw new BadRequestError("Not an image resource");
      }

      const contentLengthHeader = response.headers.get("content-length");
      if (contentLengthHeader) {
        const contentLength = parseInt(contentLengthHeader, 10);
        if (Number.isFinite(contentLength) && contentLength > MAX_LOGO_BYTES) {
          throw new BadRequestError("Logo exceeds maximum size");
        }
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_LOGO_BYTES) {
        throw new BadRequestError("Logo exceeds maximum size");
      }

      return {
        contentType,
        buffer: Buffer.from(arrayBuffer),
      };
    } catch (err) {
      if (err instanceof BadRequestError || err instanceof NotFoundError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new NotFoundError("Logo fetch timed out");
      }
      throw new NotFoundError("Failed to fetch logo");
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

export default new CertificateLogoProxyService();
