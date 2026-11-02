# ADR 0005: Video through euron-video-system or external URLs, not built in

## Status

Accepted.

## Context

Courses are mostly video. Serving paid video well means uploads of multi-gigabyte files,
transcoding to an adaptive ladder, encryption, signed short-lived URLs, a CDN, watermarking
and analytics. That is a product of its own, with its own workers, storage costs and failure
modes, and it scales on different axes than an LMS.

The code this project came from used a commercial DRM provider and an in-house transcoding
pipeline. Neither belongs in an open-source LMS: one is a paid account every self-hoster
would need, the other is a large subsystem that would dominate the repository.

euron-video-system (EVS) is a separate open-source video platform that does uploads,
transcoding and HLS delivery, and issues per-viewer playback sessions over a small API.

## Decision

- The LMS stores a reference per lecture: `video_provider` (`EVS`, `HLS`, `MP4`, `YOUTUBE`)
  and `video_key` (an EVS id or a URL). It never uploads, stores or transcodes video.
- For `EVS`, learner-api checks the learner's enrollment and then asks EVS for a playback
  session (`POST /v1/videos/{id}/playback-sessions` with viewer id `<tenantId>:<memberId>`
  and a TTL), returning the manifest URL and token to the player.
- For `HLS`, `MP4` and `YOUTUBE`, learner-api checks the same enrollment and returns the
  stored URL. These are meant for free content, or content protected elsewhere.
- One player (hls.js based) plays EVS and HLS, MP4 natively, and YouTube through its embed.
- Locally, `apps/stubs` answers the EVS playback API with a bundled sample.

Details: [video.md](../architecture/video.md).

## Consequences

Positive:

- The LMS has no media pipeline, no video storage bill and no transcoding workers.
- A deployment can start with YouTube or plain MP4 links and add EVS later without a
  migration.
- Video access is decided by the LMS (enrollment) and enforced by EVS (session token and
  TTL), each doing what it is good at.

Trade-offs:

- Protected video needs a second system to run. Without EVS, paid lectures have only
  unsigned URLs.
- EVS is configured once per deployment (`EVS_API_URL`, `EVS_API_KEY`); there is no
  per-tenant EVS account, so tenant isolation of the video library depends on how the
  operator uses that account.
- Upload is outside the LMS: staff upload to EVS and paste the id.
- No DRM. EVS serves HLS with tokens, which stops casual sharing, not determined copying.

## Alternatives considered

- **A commercial DRM video provider.** Strong protection, but a paid account per deployment
  and a vendor lock-in that does not fit a self-hosted project.
- **Built-in upload and transcoding** (S3 plus a transcoder plus CloudFront signed URLs).
  Doubles the size and the operating cost of the project.
- **External URLs only.** Simple, but nothing protects paid content.
