import logger from "../utils/logger";
import type { GoogleVerificationResult } from "../types/auth.type";

const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

class GoogleOAuthService {
  /**
   * Verify a Google ID token and extract user info.
   * Uses the Google tokeninfo endpoint, no client secret required.
   */
  async verifyToken(idToken: string, expectedClientId: string): Promise<GoogleVerificationResult> {
    const url = new URL(GOOGLE_TOKENINFO_URL);
    url.searchParams.set("id_token", idToken);

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`Google token verification failed (${response.status}): ${errorBody}`);
      throw new Error("Invalid Google token");
    }

    const data = (await response.json()) as GoogleVerificationResult & { aud?: string };

    // Verify the audience matches the tenant's Google Client ID
    if (data.aud !== expectedClientId) {
      logger.warn(`Google token audience mismatch: expected ${expectedClientId}, got ${data.aud}`);
      throw new Error("Google token audience mismatch");
    }

    return data;
  }

  /**
   * Verify a Google access token and extract user info.
   * Used by the OAuth popup flow (useGoogleLogin with implicit grant).
   * 1. Calls tokeninfo to verify audience matches tenant's client ID.
   * 2. Calls userinfo to get the user's profile.
   */
  async verifyAccessToken(accessToken: string, expectedClientId: string): Promise<GoogleVerificationResult> {
    // Step 1: Verify the access token and check audience
    const tokenInfoUrl = new URL(GOOGLE_TOKENINFO_URL);
    tokenInfoUrl.searchParams.set("access_token", accessToken);

    const tokenInfoRes = await fetch(tokenInfoUrl.toString());
    if (!tokenInfoRes.ok) {
      const errorBody = await tokenInfoRes.text();
      logger.error(`Google access token verification failed (${tokenInfoRes.status}): ${errorBody}`);
      throw new Error("Invalid Google access token");
    }

    const tokenInfo = (await tokenInfoRes.json()) as { aud?: string; expires_in?: string };

    if (tokenInfo.aud !== expectedClientId) {
      logger.warn(`Google access token audience mismatch: expected ${expectedClientId}, got ${tokenInfo.aud}`);
      throw new Error("Google access token audience mismatch");
    }

    // Step 2: Fetch user profile from Google userinfo endpoint
    const userInfoRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userInfoRes.ok) {
      const errorBody = await userInfoRes.text();
      logger.error(`Google userinfo fetch failed (${userInfoRes.status}): ${errorBody}`);
      throw new Error("Failed to fetch Google user info");
    }

    const userInfo = (await userInfoRes.json()) as {
      sub: string;
      email: string;
      email_verified: boolean;
      name: string;
      given_name: string;
      family_name: string;
      picture: string;
    };

    return {
      email: userInfo.email,
      email_verified: String(userInfo.email_verified),
      name: userInfo.name,
      given_name: userInfo.given_name,
      family_name: userInfo.family_name,
      picture: userInfo.picture,
      sub: userInfo.sub,
    };
  }
}

export default new GoogleOAuthService();
