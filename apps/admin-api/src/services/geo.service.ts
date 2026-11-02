import logger from "../utils/logger";

interface GeoResult {
  country: string | null;
  city: string | null;
}

interface FullGeoResult {
  country: string | null;
  region: string | null;
  city: string | null;
  timezone: string | null;
}

interface UserAgentResult {
  device: string;
  browser: string;
  os: string;
}

class GeoService {
  private geoip: typeof import("geoip-lite") | null = null;

  /**
   * Lazy-load geoip-lite (loads ~60MB MaxMind DB on first call).
   */
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

  /**
   * Look up country and city from an IP address.
   * Returns null fields gracefully if lookup fails.
   */
  async getGeoFromIp(ip: string): Promise<GeoResult> {
    try {
      const geoip = await this.getGeoip();
      if (!geoip) return { country: null, city: null };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = geoip as any;
      const lookup = mod.default?.lookup ?? mod.lookup;
      if (!lookup) return { country: null, city: null };

      const geo = lookup(ip);
      if (!geo) return { country: null, city: null };

      return {
        country: geo.country || null,
        city: geo.city || null,
      };
    } catch (err) {
      logger.warn(`Geo lookup failed for IP ${ip}: ${(err as Error).message}`);
      return { country: null, city: null };
    }
  }

  /**
   * Look up country, region (state/province), city and timezone from an IP.
   */
  async getFullGeoFromIp(ip: string): Promise<FullGeoResult> {
    const empty = { country: null, region: null, city: null, timezone: null };
    try {
      const geoip = await this.getGeoip();
      if (!geoip) return empty;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = geoip as any;
      const lookup = mod.default?.lookup ?? mod.lookup;
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

  /**
   * Parse user-agent string into device, browser, and OS.
   */
  parseUserAgent(ua: string): UserAgentResult {
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
}

export default new GeoService();
