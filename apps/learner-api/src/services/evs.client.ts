import config from "../config";
import { ServiceUnavailableError } from "../errors/service-unavailable.error";
import logger from "../utils/logger";

/**
 * Minimal client for the video service (EVS). One EVS deployment serves one
 * LMS install; the learner API only ever mints short-lived playback sessions.
 * EVS serves manifests, keys and segments itself, so no key material passes
 * through here.
 */

export interface EvsPlaybackSession {
  manifestUrl: string;
  token: string;
  expiresAt: string;
}

export function isEvsConfigured(): boolean {
  return Boolean(config.EVS_API_URL && config.EVS_API_KEY);
}

/**
 * POST {EVS_API_URL}/v1/videos/{id}/playback-sessions
 * viewerId is `${tenantId}:${memberId}` so per-viewer limits stay tenant-safe.
 */
export async function createPlaybackSession(
  videoId: string,
  opts: { viewerId: string; ttlSeconds: number }
): Promise<EvsPlaybackSession> {
  if (!isEvsConfigured()) {
    throw new ServiceUnavailableError("Video service is not configured");
  }

  const url = `${config.EVS_API_URL}/v1/videos/${encodeURIComponent(videoId)}/playback-sessions`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.EVS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ viewerId: opts.viewerId, ttlSeconds: opts.ttlSeconds }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    logger.error(`[evs] playback-session request failed: ${(err as Error).message}`);
    throw new ServiceUnavailableError("Video service is unavailable");
  }

  if (!res.ok) {
    logger.error(`[evs] playback-session for ${videoId} returned HTTP ${res.status}`);
    throw new ServiceUnavailableError("Video service could not start playback");
  }

  const body = (await res.json()) as Partial<EvsPlaybackSession>;
  if (!body.manifestUrl || !body.token || !body.expiresAt) {
    logger.error(`[evs] playback-session for ${videoId} returned an incomplete body`);
    throw new ServiceUnavailableError("Video service could not start playback");
  }
  return { manifestUrl: body.manifestUrl, token: body.token, expiresAt: body.expiresAt };
}
