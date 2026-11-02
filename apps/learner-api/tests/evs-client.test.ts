/**
 * EVS playback-session client: request shape and failure handling, with fetch
 * stubbed so no video service is needed.
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

process.env.EVS_API_URL = "http://evs.test/";
process.env.EVS_API_KEY = "evs_test_key";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createPlaybackSession } = require("../src/services/evs.client") as typeof import("../src/services/evs.client");

const realFetch = globalThis.fetch;
after(() => {
  globalThis.fetch = realFetch;
});

describe("EVS playback sessions", () => {
  it("POSTs viewerId and ttlSeconds with the bearer key", async () => {
    let seen: { url: string; init?: RequestInit } | null = null;
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      seen = { url, init };
      return new Response(
        JSON.stringify({ manifestUrl: "http://evs.test/m.m3u8", token: "tok", expiresAt: "2030-01-01T00:00:00Z" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    }) as unknown as typeof globalThis.fetch;

    const session = await createPlaybackSession("vid_1", { viewerId: "t1:m1", ttlSeconds: 600 });
    assert.deepEqual(session, { manifestUrl: "http://evs.test/m.m3u8", token: "tok", expiresAt: "2030-01-01T00:00:00Z" });
    assert.ok(seen);
    const call = seen as { url: string; init?: RequestInit };
    assert.equal(call.url, "http://evs.test/v1/videos/vid_1/playback-sessions");
    assert.equal((call.init?.headers as Record<string, string>).Authorization, "Bearer evs_test_key");
    assert.deepEqual(JSON.parse(String(call.init?.body)), { viewerId: "t1:m1", ttlSeconds: 600 });
  });

  it("maps an EVS error to a 503", async () => {
    globalThis.fetch = (async () => new Response("nope", { status: 404 })) as unknown as typeof globalThis.fetch;
    await assert.rejects(createPlaybackSession("vid_missing", { viewerId: "t1:m1", ttlSeconds: 60 }), (err: unknown) => {
      return (err as { statusCode?: number }).statusCode === 503;
    });
  });
});
