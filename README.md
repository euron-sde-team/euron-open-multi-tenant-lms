<p align="center">
  <img src="docs/assets/banner.svg" alt="Euron Open Multi-Tenant LMS: one platform, every academy. Sell plans to academies, let each one build courses, books and tests, and give every learner a storefront in that academy's brand" width="100%">
</p>

<p align="center">
  <img alt="Open source" src="https://img.shields.io/badge/open_source-%E2%9D%A4-059669?style=flat">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-3b82f6?style=flat"></a>
  <img alt="Node.js 22 LTS" src="https://img.shields.io/badge/node-22_LTS-339933?style=flat&logo=nodedotjs&logoColor=white">
  <img alt="TypeScript strict" src="https://img.shields.io/badge/TypeScript-strict-3178c6?style=flat&logo=typescript&logoColor=white">
  <img alt="Next.js 14" src="https://img.shields.io/badge/Next.js-14-000000?style=flat&logo=nextdotjs&logoColor=white">
  <img alt="Express 5" src="https://img.shields.io/badge/Express-5-000000?style=flat&logo=express&logoColor=white">
  <img alt="PostgreSQL 16" src="https://img.shields.io/badge/PostgreSQL-16-4169e1?style=flat&logo=postgresql&logoColor=white">
  <img alt="Redis 7" src="https://img.shields.io/badge/Redis-7-dc382d?style=flat&logo=redis&logoColor=white">
  <img alt="Multi-tenant" src="https://img.shields.io/badge/multi--tenant-three_tiers-059669?style=flat">
  <img alt="Stripe" src="https://img.shields.io/badge/payments-Stripe-635bff?style=flat&logo=stripe&logoColor=white">
  <img alt="Razorpay" src="https://img.shields.io/badge/payments-Razorpay-0c2451?style=flat&logo=razorpay&logoColor=white">
  <img alt="Terraform" src="https://img.shields.io/badge/IaC-Terraform-7b42bc?style=flat&logo=terraform&logoColor=white">
  <img alt="AWS" src="https://img.shields.io/badge/AWS-ready-ff9900?style=flat&logo=amazonwebservices&logoColor=white">
</p>

<p align="center">
  <a href="https://github.com/euron-sde-team/euron-open-multi-tenant-lms/stargazers"><img alt="Star this repo" src="https://img.shields.io/github/stars/euron-sde-team/euron-open-multi-tenant-lms?style=social&label=Star%20this%20repo"></a>
  <a href="https://github.com/euron-sde-team/euron-open-multi-tenant-lms/fork"><img alt="Fork" src="https://img.shields.io/github/forks/euron-sde-team/euron-open-multi-tenant-lms?style=social&label=Fork"></a>
  <a href="https://github.com/euron-sde-team/euron-open-multi-tenant-lms/watchers"><img alt="Watch" src="https://img.shields.io/github/watchers/euron-sde-team/euron-open-multi-tenant-lms?style=social&label=Watch"></a>
  <br>
  <a href="https://github.com/euron-sde-team/euron-open-multi-tenant-lms/issues"><img alt="Open issues" src="https://img.shields.io/github/issues/euron-sde-team/euron-open-multi-tenant-lms?style=flat&color=059669"></a>
  <a href="https://github.com/euron-sde-team/euron-open-multi-tenant-lms/pulls"><img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-34d399?style=flat"></a>
  <a href="https://github.com/euron-sde-team/euron-open-multi-tenant-lms/commits/main"><img alt="Last commit" src="https://img.shields.io/github/last-commit/euron-sde-team/euron-open-multi-tenant-lms?style=flat&color=8b95a8"></a>
  <img alt="Runs locally with no provider account" src="https://img.shields.io/badge/runs_locally-no_accounts_needed-0a0f1c?style=flat">
  <br>
  <a href="#built-by-the-team-behind-euron"><img alt="Built by the team behind Euron" src="https://img.shields.io/badge/built_by-Euron-4f46e5?style=flat"></a>
</p>

<p align="center">
  <b><a href="#-quickstart">Quickstart</a></b> ·
  <b><a href="#️-architecture">Architecture</a></b> ·
  <b><a href="#-explore-the-repository">Explore the repo</a></b> ·
  <b><a href="docs/guides/add-a-template.md">Add a template</a></b> ·
  <b><a href="#️-deploy-to-aws">Deploy</a></b> ·
  <b><a href="docs/architecture/security.md">Security</a></b> ·
  <b><a href="#-documentation">Docs</a></b>
</p>

**Euron Open Multi-Tenant LMS** is an open-source, self-hosted learning platform for running
**many academies on one deployment**. It has three tiers, each a web app with its own API:

- an **operator console** where you, the platform, build a catalogue of features and plans,
  onboard academies, and snapshot each academy's plan into the entitlements the runtime
  enforces;
- a **tenant admin** where each academy builds **courses, books, bundles, batches, test
  series, quizzes, assignments and certificates**, designs its site from **JSON page
  templates and themes**, prices in several currencies, connects its own **Stripe or
  Razorpay**, and drafts content with **AI authoring**;
- a **learner storefront** on the academy's own subdomain or domain, in the academy's brand,
  with checkout, a classroom with video lessons, quizzes and assignments, test series with
  ranks, bookmarks and certificates.

It is MIT-licensed and part of the open-source initiative of **ENGAGESPHERE TECHNOLOGY
PRIVATE LIMITED**.

The parts that usually go wrong in a multi-tenant LMS are designed in, not bolted on:

- **Academies never see each other.** Every tenant table carries `tenant_id`, every query is
  scoped by it, and another academy's course is a 404. The integration suite proves it route
  by route against two academies.
- **What an academy bought is what it gets.** Plans are sales artifacts; plan versions are
  immutable once published; a subscription snapshots the plan into entitlement rows, and the
  runtime reads only those. A missing entitlement is a denial, counts are consumed with an
  atomic compare-and-set, and publishing beyond a limit is refused.
- **Every academy looks like itself.** Pages are JSON documents of sections from a shared
  registry, rendered by the storefront with the academy's theme injected before first paint,
  so 51 home-page templates and 43 themes work for every tenant without a deploy.
- **Money paths are boring on purpose.** Each academy's gateway credentials are sealed with
  AES-256-GCM and never returned; webhooks are verified over the raw body, deduplicated by
  event id, checked against the order's amount and currency, and fulfilled by a queue worker
  with a verify-payment fallback, so a lost webhook never loses a sale and a replay never
  grants twice.
- **It runs with no accounts at all.** Stripe, Razorpay, the video service and the AI endpoint
  have local stubs, AWS runs in an emulator, and AI authoring has an offline mode, so the whole
  product and its test suite work on a laptop.

<p align="center">
  <img src="docs/assets/tour.gif" alt="Product tour: the operator console with tenants and plans, the tenant admin dashboard, courses and the page template picker, then the academy's storefront, a course page, a lesson playing and the learner's dashboard" width="100%">
</p>

> [!NOTE]
> Everything in the tour and the screenshots ran for real on a laptop: `make up && make demo`
> brings up the three APIs, the three apps, Postgres, Redis, the AWS emulator and the provider
> stubs, and seeds two fictional academies. Connect a real provider and the same screens work
> against it ([connect-real-providers.md](docs/guides/connect-real-providers.md)).

<h3 align="center">Built by the team behind Euron</h3>

<p align="center">
  <sub>Euron Open Multi-Tenant LMS is part of the open-source initiative of ENGAGESPHERE TECHNOLOGY PRIVATE LIMITED, made by the people who build<br>the platforms below. If you like how this repository is built, come and see what we build with it.</sub>
</p>

<p align="center">
  <a href="https://euron.one"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/brand/euron-dark.svg"><img src="docs/assets/brand/euron-light.svg" alt="Euron: learn the latest technologies from industry experts. Visit euron.one" width="31%"></picture></a>
  <a href="https://euronsystems.com"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/brand/euron-systems-dark.svg"><img src="docs/assets/brand/euron-systems-light.svg" alt="Euron Systems: the SaaS platform for educators and creators. Visit euronsystems.com" width="31%"></picture></a>
  <a href="https://alphaeuron.com"><picture><source media="(prefers-color-scheme: dark)" srcset="docs/assets/brand/alpha-euron-dark.svg"><img src="docs/assets/brand/alpha-euron-light.svg" alt="Alpha Euron: where school kids grow creativity and tech skills with AI. Visit alphaeuron.com" width="31%"></picture></a>
</p>

<p align="center">
  <a href="https://www.instagram.com/euron_official"><img src="https://img.shields.io/badge/Instagram-E4405F?style=flat-square&logo=instagram&logoColor=white" alt="Instagram"></a>
  <a href="https://www.linkedin.com/company/euronone/posts/"><img src="https://img.shields.io/badge/LinkedIn-0A66C2?style=flat-square&logo=linkedin&logoColor=white" alt="LinkedIn"></a>
  <a href="https://x.com/euron712"><img src="https://img.shields.io/badge/X-000000?style=flat-square&logo=x&logoColor=white" alt="X"></a>
  <a href="https://www.youtube.com/@Euron-official"><img src="https://img.shields.io/badge/YouTube-FF0000?style=flat-square&logo=youtube&logoColor=white" alt="YouTube"></a>
  <a href="https://whatsapp.com/channel/0029VaeeJwq9RZAfPW9P2l07"><img src="https://img.shields.io/badge/WhatsApp_channel-25D366?style=flat-square&logo=whatsapp&logoColor=white" alt="WhatsApp channel"></a>
</p>

---

## 📚 Table of contents

- [Why Euron Open Multi-Tenant LMS](#-why-euron-open-multi-tenant-lms)
- [At a glance](#-at-a-glance)
- [Screenshots](#️-screenshots)
- [Features](#-features)
- [Architecture](#️-architecture)
- [Tech stack](#-tech-stack)
- [Prerequisites](#-prerequisites)
- [Quickstart](#-quickstart)
- [Explore the repository](#-explore-the-repository)
- [API](#-api)
- [Configuration](#️-configuration)
- [Deploy to AWS](#️-deploy-to-aws)
- [Security model](#-security-model)
- [Testing](#-testing)
- [Documentation](#-documentation)
- [Roadmap](#️-roadmap)
- [FAQ](#-faq)
- [Contributing, security and license](#-contributing-security-and-license)

## 💡 Why Euron Open Multi-Tenant LMS

Most open-source LMSs are built for one school. Running learning **for other schools** (a
platform that hosts creators and academies, a training company with many client brands, a
university group with separate faculties) needs more than a `tenant_id` column: plans and
limits enforced at runtime, a site per academy in its own brand and domain, each academy's own
payment account, prices in each buyer's currency, and a console to run it all. This repository
ships that operator layer together with a complete learning product, and keeps the three tiers
apart: each has its own app, its own API and its own sessions, over one shared schema.

## 📊 At a glance

| | |
| --- | --- |
| Tiers | Operator console (the platform), tenant admin (each academy's staff), learner storefront (each academy's learners) |
| Learning products | Self-paced courses (sections, lessons, video lectures, resources), books, bundles, batches (cohorts), test series with sections, question banks, taxonomy, rank curves and scholarships, quizzes, assignments, certificates |
| Commerce | Single-item and cart checkout, coupons, multi-currency price books, learner subscriptions, receipts |
| Site builder | 51 home-page templates, 7 utility page templates, 43 themes, a section registry, custom domains |
| Payments | Each academy's own Stripe or Razorpay for learner purchases; the operator's for academy subscriptions |
| Video | [euron-video-system](https://github.com/euron-sde-team/euron-video-system) playback sessions, or external HLS, MP4 and YouTube |
| AI authoring | Courses, books, batches, pages, quizzes, assignments, tests and test series from a prompt; any OpenAI-compatible endpoint, or offline |
| Data | 167 tables in one Postgres schema, forward-only SQL migrations |
| Runs on | Docker Compose locally (with an AWS emulator and provider stubs), ECS Fargate + RDS + ElastiCache on AWS |

## 🖼️ Screenshots

| | |
| :---: | :---: |
| <img src="docs/assets/screenshots/01-storefront-home.png" alt="Storefront home" width="100%"><br><sub><b>An academy's storefront.</b> The Northwind home page, built from a JSON template in the academy's theme.</sub> | <img src="docs/assets/screenshots/02-storefront-course.png" alt="Course page" width="100%"><br><sub><b>A course.</b> Curriculum, instructor, outcomes and the price in the buyer's currency.</sub> |
| <img src="docs/assets/screenshots/03-storefront-lesson.png" alt="Lesson" width="100%"><br><sub><b>The classroom.</b> A lecture playing from a signed playback session, with progress tracked.</sub> | <img src="docs/assets/screenshots/04-storefront-my-learning.png" alt="My learning" width="100%"><br><sub><b>My learning.</b> Enrolled courses, books and batches with progress.</sub> |
| <img src="docs/assets/screenshots/05-admin-dashboard.png" alt="Tenant admin dashboard" width="100%"><br><sub><b>Tenant admin.</b> Learners, enrolments, revenue per currency and the launch checklist.</sub> | <img src="docs/assets/screenshots/06-admin-courses.png" alt="Courses" width="100%"><br><sub><b>Courses.</b> Published and draft courses, each counted against the plan's limit.</sub> |
| <img src="docs/assets/screenshots/07-admin-curriculum.png" alt="Curriculum editor" width="100%"><br><sub><b>Curriculum.</b> Sections, lessons, video lectures from the video service or a link, quizzes and assignments.</sub> | <img src="docs/assets/screenshots/08-admin-templates.png" alt="Page templates" width="100%"><br><sub><b>Templates.</b> Pick a home page and a theme; pages are JSON, edited section by section.</sub> |
| <img src="docs/assets/screenshots/09-admin-test-series.png" alt="Test series" width="100%"><br><sub><b>Test series.</b> Tests with sections, question banks and rank curves.</sub> | <img src="docs/assets/screenshots/10-admin-dark.png" alt="Tenant admin in dark mode" width="100%"><br><sub><b>Dark mode.</b> Every admin screen in the dark theme.</sub> |
| <img src="docs/assets/screenshots/11-console-dashboard.png" alt="Operator console" width="100%"><br><sub><b>Operator console.</b> Tenants, subscriptions and plan distribution for the platform.</sub> | <img src="docs/assets/screenshots/12-console-tenants.png" alt="Tenants" width="100%"><br><sub><b>Tenants.</b> Every academy with its plan, status and owner.</sub> |
| <img src="docs/assets/screenshots/13-console-plans.png" alt="Plans" width="100%"><br><sub><b>Plans.</b> Versioned plans; a published version never changes, existing academies keep theirs.</sub> | <img src="docs/assets/screenshots/14-storefront-acme.png" alt="A second academy" width="100%"><br><sub><b>A second academy.</b> Acme Robotics on the Starter plan, on its own subdomain and theme.</sub> |

## ✨ Features

**Operator console (tier 1)**
- Applications, features and products (boolean gates, counts and limits, per tenant or per
  user, lifetime or windowed), assembled into plans with versions that become immutable when
  published.
- Tenants, their staff and roles; plan assignment that snapshots every product into
  entitlements; add-ons and manual overrides with a reason; audit log and an activity feed.
- Platform billing providers (Stripe and Razorpay) for academy subscriptions, with signed
  webhooks that activate, renew or lapse a subscription and its entitlements.

**Tenant admin (tier 2)**
- Self-paced courses with sections, lessons, lectures (euron-video-system ids, HLS, MP4 or
  YouTube), downloadable resources, FAQs, instructors, categories and ordering.
- Books with reader access, bundles of courses, books and test series, and batches (cohorts)
  with dates, items and learners.
- Test series: tests with sections and modules, question banks and a question library,
  taxonomy, grading, rank curves and scholarships; quizzes and assignments inside courses.
- Certificates: a designer, templates, per-course assignment and bulk issue.
- Learners: profiles, bulk enrol and bulk import from CSV, access grants, progress and
  analytics; staff with built-in and custom roles.
- Commerce: per-currency price books with a default currency and country rules, coupons
  (percentage or fixed in a currency), learner subscription plans, orders and receipts.
- Site: JSON page templates for the home page and utility pages, 43 themes, layouts, header and
  footer, custom domains, SEO settings; transactional email through SES from the academy's
  own verified sending domain.
- AI authoring behind the `ai_authoring_enabled` entitlement: outline and draft courses, books,
  batches, page sections, quizzes, assignments, tests and test series.

**Learner storefront (tier 3)**
- The academy's own site at `<slug>.<your domain>` or a custom domain, themed before first
  paint, with search, catalogue pages, course, book, bundle, batch and test series pages.
- Sign-up and sign-in (password or email one-time code), cart and single-item checkout through
  the academy's Stripe or Razorpay, payment history and receipts.
- The classroom: video lessons with resume and watch-time tracking, resources, quizzes,
  assignments with file submissions, ratings, bookmarks, a book reader, test attempts with
  results and ranks, and certificates.

## 🏗️ Architecture

<p align="center">
  <img src="docs/assets/diagrams/context.svg" alt="System context: operators, academy staff and learners using three apps, each backed by its own API over one Postgres schema, Redis, S3, SES, the payment gateways, the video service and an AI endpoint" width="100%">
</p>

Three tiers, three Next.js apps, three Express APIs, one Postgres schema. Each API owns its
tier's routes, sessions and background jobs; they share the database, Redis and a small
internal channel (cache invalidation over Redis pub/sub and an internal API key)
([HLD.md](docs/architecture/HLD.md), [ADR 0001](docs/adr/0001-three-apis-one-schema.md)).

<p align="center">
  <img src="docs/assets/diagrams/request-and-tenant-resolution.svg" alt="A storefront request: the host resolves to a tenant by subdomain or custom domain, the theme is injected server-side, and every query is scoped by tenant" width="100%">
</p>

The storefront resolves the academy from the host (a subdomain of `ROOT_DOMAIN` or a verified
custom domain), renders the academy's JSON page with its theme injected server-side, and every
learner-api query is scoped by that tenant
([templates-and-theming.md](docs/architecture/templates-and-theming.md),
[multi-tenancy-and-entitlements.md](docs/architecture/multi-tenancy-and-entitlements.md)).

<p align="center">
  <img src="docs/assets/diagrams/checkout-and-fulfillment.svg" alt="Checkout: an order with the academy's gateway, the learner pays, the signed webhook is deduplicated and queued, a worker grants access, and verify-payment fulfils if the webhook is late" width="100%">
</p>

Purchases go through the academy's own gateway; access is granted by a queue worker from the
signed webhook, with verify-payment as an idempotent fallback
([payments-and-currency.md](docs/architecture/payments-and-currency.md)).

<p align="center">
  <img src="docs/assets/diagrams/deployment.svg" alt="AWS deployment: an ALB with host rules in front of six ECS Fargate services, RDS Postgres, ElastiCache Redis, S3 behind CloudFront for assets, SES with SNS and SQS, Secrets Manager, KMS and a WAF" width="100%">
</p>

[LLD.md](docs/architecture/LLD.md) walks through each app and API;
[data-model.md](docs/architecture/data-model.md) maps the tables.

## 🧰 Tech stack

| Layer | Choice |
| --- | --- |
| APIs | Node.js 22, Express 5, TypeScript strict, Kysely on Postgres, Node cluster |
| Jobs | BullMQ on Redis: fulfilment, notifications, AI generation, bulk imports, email events and recurring sweeps |
| Data | PostgreSQL 16 (with a search materialized view), Redis 7, S3 for files |
| Schema | `packages/db/prisma/schema.prisma` for types only (Prisma never touches a database), plain SQL migrations with a checksummed runner |
| Apps | Next.js 14, React 18, TanStack Query, Zustand, Tailwind, Radix UI, hls.js |
| Shared packages | UI kit, section registry and themes, page, course, book, LMS and certificate templates, shared types and money helpers |
| Providers | Stripe, Razorpay, euron-video-system, Amazon SES, any OpenAI-compatible AI endpoint |
| Infra | Docker Compose, Floci (local AWS emulator), provider stubs, Terraform: ECS Fargate, ALB, CloudFront, RDS, ElastiCache, SES, SNS, SQS, KMS, Secrets Manager, WAF |
| Quality | Vitest, Node test runner, Playwright with axe, ESLint, tflint, checkov, gitleaks |

## 📋 Prerequisites

- Docker with Compose v2
- Node.js 22 and pnpm 9 (`corepack enable`)
- For AWS: an AWS account, Terraform 1.6+ (or Docker, the Makefile falls back to the
  container), and a domain with a wildcard record you control

## 🚀 Quickstart

```bash
git clone https://github.com/euron-sde-team/euron-open-multi-tenant-lms.git
cd euron-open-multi-tenant-lms
pnpm install
make up      # Postgres, Redis, the AWS emulator, the stubs, migrations, three APIs and three apps
make demo    # the plan catalogue, an operator and two fictional academies full of content
```

| | URL | Sign in as |
| --- | --- | --- |
| Operator console | http://localhost:3600 | `root@example.com` |
| Tenant admin | http://localhost:3610 | `maya@northwind.example.com` (Northwind Academy, Scale) or `arjun@acme.example.com` (Acme Robotics, Starter) |
| Storefronts | http://northwind.lvh.me:3620 and http://acme.lvh.me:3620 | `lee@example.com` and five more Northwind learners |
| Mail | http://localhost:8096 | every email the stack sends |
| Provider stubs | http://localhost:5189 | Stripe, Razorpay, the video service and AI |

`lvh.me` and every subdomain of it resolve to `127.0.0.1`, so tenant subdomains work with no
hosts file. Every demo account uses `MTLMS_DEMO_PASSWORD` from `deploy/compose/.env`
(generated by `make env`, which `make up` runs). `make down` stops everything and deletes the
volumes. [quickstart-local.md](docs/guides/quickstart-local.md) covers running the apps outside
Docker and [walkthrough.md](docs/guides/walkthrough.md) tours all three tiers.

## 🧭 Explore the repository

```
apps/
  console-api/   tier 1 API: operators, catalogue, plans, tenants, entitlements (port 5076)
  console/       tier 1 app: the operator console (3600)
  admin-api/     tier 2 API: content, site, commerce, platform billing, AI authoring (5086)
  admin/         tier 2 app: the tenant admin (3610)
  learner-api/   tier 3 API: storefront, checkout, classroom, tests (5096)
  web/           tier 3 app: the themed storefront (3620)
  stubs/         local stand-ins for Stripe, Razorpay, the video service and an AI endpoint
packages/
  db/            the one schema, generated Kysely types for every API
  core/          the UI kit and the section components
  shared/        types, section and route registries, money and currency helpers
  ui-config/     section defaults, themes and layouts
  lms-templates/ course-templates/ book-templates/ certificate-templates/
db/              SQL migrations and the runner
deploy/compose/  Docker Compose: local with the AWS emulator, or against real AWS
infra/           Dockerfiles and Terraform (modules and three environments)
e2e/             Playwright tests, including axe accessibility checks
docs/            architecture, ADRs and guides
```

## 🔌 API

Each tier has its own JSON API under `/api/v1`, with a `{ success, data, message, statusCode }`
envelope and bearer tokens from its own sign-in route. The route files are the reference:
[`apps/console-api/src/routes`](apps/console-api/src/routes),
[`apps/admin-api/src/routes`](apps/admin-api/src/routes) (tenant staff send `X-Tenant-Id`) and
[`apps/learner-api/src/routes`](apps/learner-api/src/routes) (the tenant comes from the host, or
`X-Tenant-Host` outside a browser).

```bash
# The published catalogue of an academy, as its storefront sees it
curl -s http://localhost:5096/api/v1/courses -H "X-Tenant-Host: northwind.lvh.me"
```

## ⚙️ Configuration

Every setting is an environment variable read in one file per app (for example
[`apps/admin-api/src/config/index.ts`](apps/admin-api/src/config/index.ts)) and documented in
[configuration.md](docs/guides/configuration.md). In production each API refuses to start with
the development secrets or short ones, and learner-api also requires its own
`LEARNER_JWT_SECRET`. Connecting real providers is in
[connect-real-providers.md](docs/guides/connect-real-providers.md).

## ☁️ Deploy to AWS

```bash
cp infra/terraform/envs/aws-prod/terraform.tfvars.example infra/terraform/envs/aws-prod/terraform.tfvars
make aws-plan ENV=aws-prod
make aws-deploy ENV=aws-prod                          # six images, migrations, services
make aws-operator ENV=aws-prod EMAIL=you@example.com  # the first operator
```

The Terraform builds a VPC, RDS Postgres, ElastiCache Redis, six ECS Fargate services behind
one ALB with host rules (console, admin, the three APIs, and a wildcard for storefronts and
custom domains), an assets bucket behind CloudFront, SES with event queues, KMS keys, Secrets
Manager entries, a WAF and alarms. [deploy-aws.md](docs/guides/deploy-aws.md) has the full
walk-through and [operations.md](docs/guides/operations.md) the day-two tasks.

## 🔐 Security model

- **Isolation.** Shared schema, `tenant_id` on every tenant table and query, 404 for other
  academies' records; staff tokens are checked against an active membership of the tenant they
  name, and learner tokens are bound to the tenant of the host.
- **Access.** Entitlements first (a missing row is a denial), then role permissions for staff;
  tenant status is enforced (a suspended academy is read-only, a cancelled one locked out);
  operator, staff and learner tokens are separate types, and learner tokens have their own key.
- **Money.** Gateway credentials sealed at rest and write-only; webhooks verified over the raw
  body with constant-time comparison, deduplicated, bound to the stored order and checked
  against its amount and currency.
- **Edges.** CORS allowlists for the console and admin, sign-in, sign-up and one-time-code rate
  limits on every tier, a configured proxy hop count, escaped theme CSS and JSON-LD, and a
  production configuration guard.

Known gaps are listed honestly in [security.md](docs/architecture/security.md#known-gaps) and the
threats in [threat-model.md](docs/architecture/threat-model.md). Report vulnerabilities
privately as described in [SECURITY.md](SECURITY.md).

## 🧪 Testing

```bash
pnpm test              # unit tests in every package, no database
make test-integration  # the three APIs and the stubs in-process against a fresh Postgres
make e2e               # Playwright against the running stack, with axe accessibility checks
make tf-validate tf-lint tf-security
make sanitize          # no credentials, account ids, real emails or IPs in the repo
```

The integration suite runs the real Express apps against a freshly migrated database and
covers entitlements, plan immutability, cross-tenant isolation, both gateways end to end
(webhook replay, verify fallback, forged signatures, amount mismatches), playback access,
sealed credentials, multi-currency, platform billing, tenant status and the hardening rules
([testing.md](docs/guides/testing.md)).

## 📖 Documentation

| Architecture | Guides |
| --- | --- |
| [HLD](docs/architecture/HLD.md), [LLD](docs/architecture/LLD.md), [data model](docs/architecture/data-model.md) | [Quickstart](docs/guides/quickstart-local.md), [walkthrough](docs/guides/walkthrough.md) |
| [Multi-tenancy and entitlements](docs/architecture/multi-tenancy-and-entitlements.md) | [Configuration](docs/guides/configuration.md), [connect real providers](docs/guides/connect-real-providers.md) |
| [Templates and theming](docs/architecture/templates-and-theming.md), [video](docs/architecture/video.md) | [Add a template](docs/guides/add-a-template.md) |
| [Payments and currency](docs/architecture/payments-and-currency.md), [AI authoring](docs/architecture/ai-authoring.md) | [Deploy to AWS](docs/guides/deploy-aws.md), [operations](docs/guides/operations.md) |
| [Security](docs/architecture/security.md), [threat model](docs/architecture/threat-model.md), [ADRs](docs/adr/README.md) | [Testing](docs/guides/testing.md), [troubleshooting](docs/guides/troubleshooting.md) |

## 🗺️ Roadmap

- Live classes and webinars behind a meeting-provider interface (a self-hosted meeting server,
  or a custom link).
- Learner community, course Q&A and discussions.
- Coding practice with a sandboxed judge, and learning roadmaps.
- Stripe subscriptions for learner plans (Razorpay only today).
- Revocable server-side sessions with refresh rotation, and two-factor sign-in.
- Refunds from the admin that also revoke access, and gateway refund webhooks.
- A mobile app on top of learner-api.

## ❓ FAQ

<details>
<summary><b>Do I need any provider account to try it?</b></summary>

No. `make up && make demo` runs Stripe, Razorpay, the video service and an AI endpoint as local
stubs, email through the AWS emulator into Mailpit, and AI authoring offline.
</details>

<details>
<summary><b>Can I run it for a single school?</b></summary>

Yes. Create one tenant on a plan with every product and point your domain at its storefront.
Nothing requires more than one academy.
</details>

<details>
<summary><b>Where do videos live?</b></summary>

Lectures store a video id from [euron-video-system](https://github.com/euron-sde-team/euron-video-system)
(upload, transcoding and signed HLS playback) or a link to HLS, MP4 or YouTube. learner-api
checks enrolment before it asks the video service for a playback session
([video.md](docs/architecture/video.md)).
</details>

<details>
<summary><b>Who gets paid when a learner buys a course?</b></summary>

The academy. Each academy connects its own Stripe or Razorpay account and is the merchant of
record; the platform bills academies separately for their plan through its own gateway.
</details>

<details>
<summary><b>How do I add my own page template or section?</b></summary>

Templates are data: add the sections and their default content to the registry and a template
entry, regenerate the catalogue, and every academy can pick it
([add-a-template.md](docs/guides/add-a-template.md)).
</details>

## 🤝 Contributing, security and license

- [CONTRIBUTING.md](CONTRIBUTING.md): how to set up, the checks a pull request must pass, and the
  coding conventions.
- [SECURITY.md](SECURITY.md): how to report a vulnerability privately.
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
- [MIT License](LICENSE).
