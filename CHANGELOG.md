# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.1.0]

First public release.

- Three tiers: the operator console and console-api, the tenant admin and admin-api, the
  learner storefront and learner-api, over one Postgres schema.
- Learning products: self-paced courses, books, bundles, batches, test series, quizzes,
  assignments and certificates.
- Plans, immutable plan versions and entitlement snapshots; usage counters with atomic
  consumption.
- JSON page templates (51 home, 7 utility) and 43 themes with server-side theming.
- Checkout through each academy's Stripe or Razorpay with webhook fulfilment and a verify
  fallback; multi-currency price books and coupons; platform billing for academies.
- Video through euron-video-system playback sessions, or HLS, MP4 and YouTube links.
- AI authoring through any OpenAI-compatible endpoint, with an offline mode.
- Docker Compose with an AWS emulator and provider stubs; Terraform for AWS.
