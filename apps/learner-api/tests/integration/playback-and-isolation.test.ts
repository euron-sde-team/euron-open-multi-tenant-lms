/**
 * Lecture playback and learner-side tenant isolation.
 *
 * Playback: an enrolled learner gets an EVS session (minted by the EVS stub for the
 * video id stored on the lecture row) or the external URL for HLS/MP4/YouTube; anyone
 * not enrolled gets 403. Isolation: course detail and playback answer 404/403 when the
 * request is for another tenant, whichever tenant's token is used.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createLearner, createTenant, enroll, seedCourse, type Learner, type SeededCourse, type Tenant } from "../../../admin-api/tests/integration/support/fixtures";
import { call, startStack, type Stack } from "../../../admin-api/tests/integration/support/stack";

let stack: Stack;
let a: Tenant;
let b: Tenant;
let course: SeededCourse;
let courseB: SeededCourse;
let enrolled: Learner;
let stranger: Learner;
let learnerB: Learner;

const EVS_ID = "evs-video-0001";
const HLS_URL = "https://video.example.com/stream/master.m3u8";
const YT_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
const MP4_URL = "https://video.example.com/clip.mp4";

beforeAll(async () => {
  stack = await startStack();
  a = await createTenant(stack.db, "play-a");
  b = await createTenant(stack.db, "play-b");
  course = await seedCourse(stack.db, a.id, {
    videos: [
      { provider: "EVS", key: EVS_ID },
      { provider: "HLS", key: HLS_URL },
      { provider: "YOUTUBE", key: YT_URL },
      { provider: "MP4", key: MP4_URL },
    ],
  });
  courseB = await seedCourse(stack.db, b.id, { videos: [{ provider: "HLS", key: HLS_URL }] });
  enrolled = await createLearner(stack.db, a.id);
  stranger = await createLearner(stack.db, a.id);
  learnerB = await createLearner(stack.db, b.id);
  await enroll(stack.db, a.id, enrolled.id, course.id);
  await enroll(stack.db, b.id, learnerB.id, courseB.id);
});
afterAll(() => stack?.stop());

const playback = (who: Learner, host: string, courseId: string, lectureId: string, body?: unknown) =>
  call(stack.learner, "POST", `/courses/${courseId}/lectures/${lectureId}/playback`, { token: who.token, host, body: body ?? {} });

describe("lecture playback", () => {
  it("returns an EVS session for the video id on the lecture row, ignoring any id the client sends", async () => {
    const res = await playback(enrolled, a.host, course.id, course.lectureIds[0], { videoKey: "someone-elses-video", video_key: "x" });
    expect(res.status, res.text).toBe(200);
    const data = res.body.data;
    expect(data.provider).toBe("EVS");
    expect(typeof data.token).toBe("string");
    expect(new Date(data.expiresAt).getTime()).toBeGreaterThan(Date.now());
    const manifest = new URL(data.manifestUrl);
    expect(manifest.searchParams.get("video")).toBe(EVS_ID);
    expect(manifest.searchParams.get("token")).toBe(data.token);
  });

  it("returns the stored URL for HLS, YouTube and MP4 lectures", async () => {
    const expected = [
      ["HLS", HLS_URL],
      ["YOUTUBE", YT_URL],
      ["MP4", MP4_URL],
    ] as const;
    for (const [i, [provider, url]] of expected.entries()) {
      const res = await playback(enrolled, a.host, course.id, course.lectureIds[i + 1]);
      expect(res.status, res.text).toBe(200);
      expect(res.body.data).toEqual({ provider, url });
    }
  });

  it("refuses a learner who is not enrolled (403) and an anonymous caller (401)", async () => {
    for (const lectureId of course.lectureIds) {
      const res = await playback(stranger, a.host, course.id, lectureId);
      expect(res.status).toBe(403);
      expect(res.text).not.toContain(EVS_ID);
      expect(res.text).not.toContain(HLS_URL);
    }
    const anon = await call(stack.learner, "POST", `/courses/${course.id}/lectures/${course.lectureIds[0]}/playback`, { host: a.host });
    expect(anon.status).toBe(401);
  });

  it("a lecture id from another course of the same tenant is not found", async () => {
    const other = await seedCourse(stack.db, a.id, { videos: [{ provider: "EVS", key: "evs-other" }] });
    const res = await playback(enrolled, a.host, course.id, other.lectureIds[0]);
    expect(res.status).toBe(404);
  });
});

describe("cross-tenant isolation (learner-api)", () => {
  it("course detail by slug is 404 on the other tenant's host", async () => {
    const own = await call(stack.learner, "GET", `/courses/by-slug/${course.slug}`, { host: a.host });
    expect(own.status, own.text).toBe(200);
    const cross = await call(stack.learner, "GET", `/courses/by-slug/${course.slug}`, { host: b.host });
    expect(cross.status).toBe(404);
    const crossAuthed = await call(stack.learner, "GET", `/courses/by-slug/${course.slug}`, { host: b.host, token: learnerB.token });
    expect(crossAuthed.status).toBe(404);
  });

  it("playback of A's lecture is refused for B's learner on B's host and on A's host", async () => {
    const onB = await playback(learnerB, b.host, course.id, course.lectureIds[1]);
    expect([403, 404]).toContain(onB.status);
    const onA = await playback(learnerB, a.host, course.id, course.lectureIds[1]);
    expect([401, 403, 404]).toContain(onA.status);
    expect(onB.text + onA.text).not.toContain(HLS_URL);
  });

  it("A's enrolled learner cannot use the token on B's host to reach A's or B's videos", async () => {
    const aCourseOnB = await playback(enrolled, b.host, course.id, course.lectureIds[1]);
    expect([401, 403, 404]).toContain(aCourseOnB.status);
    const bCourseOnB = await playback(enrolled, b.host, courseB.id, courseB.lectureIds[0]);
    expect([401, 403, 404]).toContain(bCourseOnB.status);
    expect(aCourseOnB.text + bCourseOnB.text).not.toContain(HLS_URL);
  });
});
