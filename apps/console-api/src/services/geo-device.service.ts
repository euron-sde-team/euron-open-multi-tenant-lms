import logger from "../utils/logger";

export interface FullGeo {
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
}

export interface ParsedUa {
  device: string;
  browser: string;
  os: string;
}

/**
 * IP → geolocation (offline, via geoip-lite) and user-agent parsing. Used to
 * enrich the admin audit trail with where/what-device an action came from.
 * Loads lazily and fails soft (null geo) so it never blocks a request.
 */
class GeoDeviceService {
  private geoip: typeof import("geoip-lite") | null = null;

  private async getGeoip() {
    if (!this.geoip) {
      try {
        this.geoip = await import("geoip-lite");
      } catch (err) {
        logger.warn(`geoip-lite not available: ${(err as Error).message}`);
        return null;
      }
    }
    return this.geoip;
  }

  async getFullGeoFromIp(ip: string | null | undefined): Promise<FullGeo> {
    const empty: FullGeo = { country: null, region: null, city: null, timezone: null };
    if (!ip) return empty;
    // strip ipv6-mapped prefix + take the first IP if a list
    const clean = ip.replace(/^::ffff:/, "").split(",")[0].trim();
    try {
      const geoip = await this.getGeoip();
      if (!geoip) return empty;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = geoip as any;
      const lookup = mod.default?.lookup ?? mod.lookup;
      if (!lookup) return empty;
      const geo = lookup(clean);
      if (!geo) return empty;
      return {
        country: geo.country || null,
        region: geo.region || null,
        city: geo.city || null,
        timezone: geo.timezone || null,
      };
    } catch (err) {
      logger.warn(`Geo lookup failed for IP ${clean}: ${(err as Error).message}`);
      return empty;
    }
  }

  parseUserAgent(ua: string | null | undefined): ParsedUa {
    const s = ua ?? "";
    let device = "Desktop";
    if (/mobile|android|iphone|ipad|ipod/i.test(s)) {
      device = /ipad|tablet/i.test(s) ? "Tablet" : "Mobile";
    }
    let browser = "Other";
    if (/edg/i.test(s)) browser = "Edge";
    else if (/opr|opera/i.test(s)) browser = "Opera";
    else if (/chrome|crios/i.test(s)) browser = "Chrome";
    else if (/firefox|fxios/i.test(s)) browser = "Firefox";
    else if (/safari/i.test(s) && !/chrome/i.test(s)) browser = "Safari";
    let os = "Other";
    if (/windows/i.test(s)) os = "Windows";
    else if (/mac os|macintosh/i.test(s)) os = "macOS";
    else if (/linux/i.test(s) && !/android/i.test(s)) os = "Linux";
    else if (/android/i.test(s)) os = "Android";
    else if (/iphone|ipad|ipod/i.test(s)) os = "iOS";
    return { device, browser, os };
  }
}

export default new GeoDeviceService();
