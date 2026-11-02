import config from "../config";
import { BadRequestError } from "../errors/bad-request.error";
import { UpstreamError } from "../errors/upstream.error";
import { NotFoundError } from "../errors/not-found.error";
import { video_provider } from "../db/enums";
import logger from "../utils/logger";

/**
 * Lecture video sources. The platform never uploads or transcodes video: a
 * lecture points at a video that lives elsewhere.
 *
 *   EVS      an id in the video system (EVS). video_key = the EVS video id.
 *   HLS      an https .m3u8 manifest URL.               video_key = the URL.
 *   MP4      an https progressive video URL.            video_key = the URL.
 *   YOUTUBE  a YouTube link or 11-character id.         video_key = the canonical watch URL.
 *
 * learner-api resolves playback from the stored row after its enrollment
 * check; this service validates what admins store and mints admin previews.
 */

export type VideoProvider = (typeof video_provider)[keyof typeof video_provider];

export const VIDEO_PROVIDERS: readonly VideoProvider[] = Object.values(video_provider);

export const EVS_VIDEO_ID = /^[A-Za-z0-9_-]{1,64}$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const EVS_TIMEOUT_MS = 10_000;

export interface VideoSource {
  provider: VideoProvider;
  videoKey: string;
}

function parseHttpsUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

function youtubeIdOf(raw: string): string | null {
  if (YOUTUBE_ID.test(raw)) return raw;
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = u.searchParams.get("v");
    if (!id) {
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?#]+)/);
      id = m?.[1] ?? null;
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

export function isVideoProvider(value: unknown): value is VideoProvider {
  return typeof value === "string" && (VIDEO_PROVIDERS as readonly string[]).includes(value);
}

/**
 * Validates a provider + key pair and returns the stored form. Throws
 * BadRequestError with a message an admin can act on.
 */
export function normalizeVideoSource(provider: unknown, rawKey: unknown): VideoSource {
  if (!isVideoProvider(provider)) {
    throw new BadRequestError(`video_provider must be one of ${VIDEO_PROVIDERS.join(", ")}`);
  }
  const key = typeof rawKey === "string" ? rawKey.trim() : "";
  if (!key) throw new BadRequestError("A video id or URL is required");

  switch (provider) {
    case "EVS":
      if (!EVS_VIDEO_ID.test(key)) {
        throw new BadRequestError("An EVS video id is 1 to 64 letters, digits, - or _");
      }
      return { provider, videoKey: key };
    case "YOUTUBE": {
      const id = youtubeIdOf(key);
      if (!id) throw new BadRequestError("Paste a YouTube link or an 11-character video id");
      return { provider, videoKey: `https://www.youtube.com/watch?v=${id}` };
    }
    case "HLS":
    case "MP4": {
      const url = parseHttpsUrl(key);
      if (!url) throw new BadRequestError("Use an https:// URL for this video");
      return { provider, videoKey: url.toString() };
    }
    default:
      throw new BadRequestError("Unsupported video provider");
  }
}

/**
 * Optional variant for update payloads: returns undefined when neither field
 * is present, null when the video is being cleared, otherwise the validated pair.
 */
export function normalizeOptionalVideoSource(
  provider: unknown,
  rawKey: unknown
): VideoSource | null | undefined {
  if (provider === undefined && rawKey === undefined) return undefined;
  if (rawKey === null || rawKey === "" || provider === null) return null;
  return normalizeVideoSource(provider, rawKey);
}

// ─── EVS API ─────────────────────────────────────────────────────────────────

export function evsConfigured(): boolean {
  return !!config.EVS_API_URL && !!config.EVS_API_KEY;
}

async function evsCall(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${config.EVS_API_URL}${path}`, {
      ...init,
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.EVS_API_KEY}`,
        ...(init.headers ?? {}),
      },
      signal: AbortSignal.timeout(EVS_TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn("[evs] request failed", { path, error: (err as Error).message });
    throw new UpstreamError("The video service is not reachable", 502);
  }
}

export interface EvsVideo {
  id: string;
  title: string | null;
  status: string;
  durationSeconds: number | null;
  posterUrl: string | null;
}

/** Looks a video up in EVS. Returns null when EVS is not configured. */
export async function getEvsVideo(videoId: string): Promise<EvsVideo | null> {
  if (!evsConfigured()) return null;
  const res = await evsCall(`/v1/videos/${encodeURIComponent(videoId)}`);
  if (res.status === 404) throw new NotFoundError("No video with this id exists in the video service");
  if (!res.ok) throw new UpstreamError("The video service did not answer", 502);
  const body = (await res.json()) as { video?: Record<string, unknown> } & Record<string, unknown>;
  const v = (body.video ?? body) as Record<string, unknown>;
  return {
    id: String(v.id ?? videoId),
    title: typeof v.title === "string" ? v.title : null,
    status: typeof v.status === "string" ? v.status : "unknown",
    durationSeconds: typeof v.durationSeconds === "number" ? v.durationSeconds : null,
    posterUrl: typeof v.posterUrl === "string" ? v.posterUrl : null,
  };
}

/** Lists videos in EVS for the admin picker. Empty when EVS is not configured. */
export async function listEvsVideos(q: {
  q?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: EvsVideo[]; page: number; total: number; configured: boolean }> {
  if (!evsConfigured()) return { items: [], page: 1, total: 0, configured: false };
  const params = new URLSearchParams();
  if (q.q) params.set("q", q.q);
  params.set("page", String(q.page ?? 1));
  params.set("limit", String(Math.min(50, q.limit ?? 20)));
  const res = await evsCall(`/v1/videos?${params.toString()}`);
  if (!res.ok) throw new UpstreamError("The video service did not answer", 502);
  const body = (await res.json()) as {
    data?: Array<Record<string, unknown>>;
    pagination?: { page?: number; total?: number };
  };
  return {
    items: (body.data ?? []).map((v) => ({
      id: String(v.id),
      title: typeof v.title === "string" ? v.title : null,
      status: typeof v.status === "string" ? v.status : "unknown",
      durationSeconds: typeof v.durationSeconds === "number" ? v.durationSeconds : null,
      posterUrl: typeof v.posterUrl === "string" ? v.posterUrl : null,
    })),
    page: body.pagination?.page ?? 1,
    total: body.pagination?.total ?? 0,
    configured: true,
  };
}

export type PlaybackResult =
  | { provider: "EVS"; manifestUrl: string; token: string; expiresAt: string }
  | { provider: "HLS" | "MP4" | "YOUTUBE"; url: string };

/**
 * Admin preview playback. Same response shape as learner-api's lecture
 * playback endpoint. The viewer id is the staff user, scoped by tenant.
 */
export async function createPreviewPlayback(
  tenantId: string,
  staffUserId: string,
  source: VideoSource
): Promise<PlaybackResult> {
  if (source.provider !== "EVS") {
    return { provider: source.provider, url: source.videoKey };
  }
  if (!evsConfigured()) {
    throw new UpstreamError("Video playback is not configured (set EVS_API_URL and EVS_API_KEY)", 503);
  }
  const res = await evsCall(`/v1/videos/${encodeURIComponent(source.videoKey)}/playback-sessions`, {
    method: "POST",
    body: JSON.stringify({
      viewerId: `${tenantId}:staff:${staffUserId}`,
      ttlSeconds: config.EVS_PLAYBACK_TTL_SECONDS,
    }),
  });
  if (res.status === 404) throw new NotFoundError("This video is not available");
  if (res.status === 422) throw new UpstreamError("This video is still processing", 409);
  if (!res.ok) throw new UpstreamError("The video service refused to start playback", 502);
  const body = (await res.json()) as { manifestUrl: string; token?: string; expiresAt: string };
  return {
    provider: "EVS",
    manifestUrl: body.manifestUrl,
    token: body.token ?? "",
    expiresAt: body.expiresAt,
  };
}
