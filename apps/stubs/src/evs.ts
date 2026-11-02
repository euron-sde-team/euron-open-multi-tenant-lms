/**
 * EVS (the video system): playback sessions, and the HLS sample they point at.
 *
 *   POST /v1/videos/:id/playback-sessions   { viewerId, ttlSeconds } -> { manifestUrl, token, expiresAt }
 *   GET  /evs/hls/sample/<file>             the bundled 6-second fMP4 HLS sample (CORS open)
 *
 * Every video id plays the same sample, unless STUBS_HLS_MANIFEST_URL names another
 * manifest (a public test stream, for instance).
 */
import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "./config.ts";
import type { Req } from "./http.ts";
import { credentials, id, int, json, str } from "./http.ts";

const SAMPLE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "hls", "sample");
const TYPES: Record<string, string> = {
  ".m3u8": "application/vnd.apple.mpegurl",
  ".m4s": "video/iso.segment",
  ".mp4": "video/mp4",
};

export const evsRoutes = {
  playbackSession(req: Req, res: ServerResponse, p: Record<string, string>): void {
    if (config.evsApiKey) {
      const c = credentials(req.headers);
      if (c.scheme !== "bearer" || c.user !== config.evsApiKey) return json(res, 401, { error: "unauthorized" });
    }
    const viewerId = str(req.body.viewerId);
    if (!viewerId) return json(res, 400, { error: "viewerId is required" });
    const ttl = Math.min(Math.max(int(req.body.ttlSeconds, 3600), 60), 86_400);
    const token = id("evs_pb", 32);
    const manifestUrl =
      config.hlsManifestUrl || `${config.publicUrl}/evs/hls/sample/index.m3u8?video=${encodeURIComponent(p.id ?? "")}&token=${token}`;
    json(res, 201, { manifestUrl, token, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() });
  },

  async sample(_req: Req, res: ServerResponse, p: Record<string, string>): Promise<void> {
    const file = path.basename(p.file ?? "");
    const type = TYPES[path.extname(file)];
    if (!type) return json(res, 404, { error: "not found" });
    try {
      const data = await readFile(path.join(SAMPLE_DIR, file));
      res.writeHead(200, { "Content-Type": type, "Content-Length": data.length, "Cache-Control": "public, max-age=3600" });
      res.end(data);
    } catch {
      json(res, 404, { error: "not found" });
    }
  },
};
