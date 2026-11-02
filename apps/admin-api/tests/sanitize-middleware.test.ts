import { describe, expect, it } from "vitest";
import type { NextFunction, Request, Response } from "express";

import { sanitizeInput } from "../src/middlewares/sanitize.middleware";

function run(body: unknown): Promise<unknown> {
  const req = { body, query: {}, params: {}, headers: {} } as unknown as Request;
  return new Promise((resolve, reject) =>
    sanitizeInput(req, {} as Response, ((err?: unknown) => (err ? reject(err) : resolve(req.body))) as NextFunction)
  );
}

describe("sanitizeInput", () => {
  it("keeps URLs with query strings intact", async () => {
    const url = "https://cdn.example.com/v/master.m3u8?token=a1&expires=99";
    expect(await run({ video_key: url, nested: [{ thumb: url }] })).toEqual({
      video_key: url,
      nested: [{ thumb: url }],
    });
  });

  it("still strips markup", async () => {
    const out = (await run({ title: 'Intro <script>alert(1)</script><img src=x onerror="alert(2)"> & more' })) as {
      title: string;
    };
    expect(out.title).not.toMatch(/<script|onerror|<img/i);
    expect(out.title).toContain("Intro");
    expect(out.title).toContain("& more");
  });
});
