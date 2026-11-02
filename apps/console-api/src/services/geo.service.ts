import logger from "../utils/logger";

interface GeoResult {
  country: string | null;
  city: string | null;
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
   * Returns null fields gracefully if lookup fails or IP is private/local.
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
   * Parse a user-agent string into device, browser, and OS.
   */
  parseUserAgent(ua: string): UserAgentResult {
    // Device
    let device = "Desktop";
    if (/ipad|tablet/i.test(ua)) {
      device = "Tablet";
    } else if (/mobile|android|iphone|ipod/i.test(ua)) {
      device = "Mobile";
    }

    // Browser (order matters: Edge contains "Chrome", Opera contains "Chrome")
    let browser = "Other";
    if (/edg/i.test(ua)) {
      browser = "Edge";
    } else if (/opr|opera/i.test(ua)) {
      browser = "Opera";
    } else if (/chrome|crios/i.test(ua)) {
      browser = "Chrome";
    } else if (/firefox|fxios/i.test(ua)) {
      browser = "Firefox";
    } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
      browser = "Safari";
    }

    // OS
    let os = "Other";
    if (/windows/i.test(ua)) {
      os = "Windows";
    } else if (/mac os|macintosh/i.test(ua)) {
      os = "macOS";
    } else if (/linux/i.test(ua) && !/android/i.test(ua)) {
      os = "Linux";
    } else if (/android/i.test(ua)) {
      os = "Android";
    } else if (/iphone|ipad|ipod/i.test(ua)) {
      os = "iOS";
    }

    return { device, browser, os };
  }

  /**
   * Format a user-agent string into a readable device description.
   * e.g. "Desktop (Windows, Chrome)" or "iPhone (iOS, Safari)"
   */
  formatDevice(ua: string | null): string {
    if (!ua) return "";

    const { device, browser, os } = this.parseUserAgent(ua);

    if (device === "Mobile" && os === "iOS") {
      return `iPhone (${os}, ${browser})`;
    }
    if (device === "Mobile" && os === "Android") {
      return `Android Phone (${os}, ${browser})`;
    }
    if (device === "Tablet" && os === "iOS") {
      return `iPad (${os}, ${browser})`;
    }

    return `${device} (${os}, ${browser})`;
  }
}

export default new GeoService();
