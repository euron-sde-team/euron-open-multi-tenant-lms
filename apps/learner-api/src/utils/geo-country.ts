import logger from "./logger";

/**
 * IP-to-country lookup via geoip-lite (port of the tenant-admin geo.service
 * pattern). The MaxMind dataset (~60MB) is lazy-loaded on first use per
 * cluster worker; cf-ipcountry short-circuits this for Cloudflare-proxied
 * custom-domain traffic, so most requests never trigger the load.
 */

let geoip: typeof import("geoip-lite") | null = null;

async function getGeoip() {
  if (!geoip) {
    try {
      geoip = await import("geoip-lite");
    } catch (err) {
      logger.warn(`geoip-lite not available: ${(err as Error).message}`);
      return null;
    }
  }
  return geoip;
}

/** ISO-3166 alpha-2 country for an IP, or null when unresolvable. */
export async function getCountryFromIp(ip: string | null | undefined): Promise<string | null> {
  if (!ip) return null;
  try {
    const mod = await getGeoip();
    if (!mod) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyMod = mod as any;
    const lookup = anyMod.default?.lookup ?? anyMod.lookup;
    if (!lookup) return null;
    const geo = lookup(ip);
    const country = geo?.country;
    return typeof country === "string" && /^[A-Z]{2}$/.test(country) ? country : null;
  } catch (err) {
    logger.warn(`Geo lookup failed for IP ${ip}: ${(err as Error).message}`);
    return null;
  }
}

export interface FullGeo {
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
}

/** Country + region (state) + city + timezone for an IP. */
export async function getFullGeoFromIp(ip: string | null | undefined): Promise<FullGeo> {
  const empty: FullGeo = { country: null, region: null, city: null, timezone: null };
  if (!ip) return empty;
  try {
    const mod = await getGeoip();
    if (!mod) return empty;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyMod = mod as any;
    const lookup = anyMod.default?.lookup ?? anyMod.lookup;
    if (!lookup) return empty;
    const geo = lookup(ip);
    if (!geo) return empty;
    return {
      country: geo.country || null,
      region: geo.region || null,
      city: geo.city || null,
      timezone: geo.timezone || null,
    };
  } catch (err) {
    logger.warn(`Full geo lookup failed for IP ${ip}: ${(err as Error).message}`);
    return empty;
  }
}

export function parseUserAgent(ua: string | null | undefined): {
  device: string | null;
  browser: string | null;
  os: string | null;
} {
  if (!ua) return { device: null, browser: null, os: null };
  let device = "Desktop";
  if (/mobile|android|iphone|ipad|ipod/i.test(ua)) {
    device = /ipad|tablet/i.test(ua) ? "Tablet" : "Mobile";
  }
  let browser = "Other";
  if (/edg/i.test(ua)) browser = "Edge";
  else if (/opr|opera/i.test(ua)) browser = "Opera";
  else if (/chrome|crios/i.test(ua)) browser = "Chrome";
  else if (/firefox|fxios/i.test(ua)) browser = "Firefox";
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = "Safari";
  let os = "Other";
  if (/windows/i.test(ua)) os = "Windows";
  else if (/mac os|macintosh/i.test(ua)) os = "macOS";
  else if (/linux/i.test(ua) && !/android/i.test(ua)) os = "Linux";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  return { device, browser, os };
}
