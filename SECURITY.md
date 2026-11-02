# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.x (latest minor) | Yes |
| Older minors | No |

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository ("Security" tab, "Report a vulnerability"):
https://github.com/euron-sde-team/euron-open-multi-tenant-lms/security/advisories/new

Please include:

- the affected component (`apps/console-api`, `apps/admin-api`, `apps/learner-api`,
  `apps/console`, `apps/admin`, `apps/web`, a package, `infra/terraform/...`) and version or
  commit,
- a description of the issue and its impact,
- steps to reproduce, or a proof of concept (against your own deployment or the local
  stack, never someone else's),
- any suggested mitigation.

What to expect:

| Stage | Target |
| ----- | ------ |
| Acknowledgement | within 3 business days |
| Initial assessment and severity | within 7 business days |
| Fix or mitigation for critical / high issues | within 30 days |
| Coordinated public disclosure | after a fix is released, credited to you unless you prefer otherwise |

## Scope

In scope: the code in this repository and the infrastructure it provisions with its
default settings. We are most interested in:

- **Tenant isolation.** Reading or changing another academy's courses, books, tests,
  learners, orders, pages, files or settings; a learner of one academy acting on another;
  any query path that is not scoped by `tenant_id`.
- **Authentication and authorisation.** Signing in as someone else, using a token from one
  tier on another, password reset or one-time-code flaws, sign-in rate limits that can be
  sidestepped, staff reaching what their role does not grant.
- **Entitlements and billing.** Using a product or a count the plan does not include,
  editing a published plan version, activating an academy subscription without paying.
- **Payments.** Getting access to paid content without paying: forged or replayed Stripe or
  Razorpay webhooks, a verify call bound to another order, an amount or currency mismatch
  that is accepted, a purchase granted twice.
- **Credentials.** Any way to make an API return, log or store an academy's gateway
  credentials in clear.
- **Content.** Watching a video or reading a book without access, reaching an unpublished
  page, script injection through page content, themes or SEO fields.

Out of scope:

- **What admins can already do.** Academy staff manage their own content, learners and
  settings; operators manage academies, plans and billing. Reports that rely on that access
  are out of scope; reports that let someone gain it are very much in scope.
- **Documented gaps** listed in
  [docs/architecture/security.md](docs/architecture/security.md#known-gaps).
- **The demo seed.** `make demo` creates well-known demo accounts on purpose and refuses to
  run with `NODE_ENV=production`.
- **The provider stubs** in `apps/stubs`, which exist for local development and tests.
- Findings that require a compromised host, compromised AWS account, or leaked deployment
  secrets.
- Denial of service through resource exhaustion of a deployment you operate yourself.

## Hardening checklist for operators

- Deploy with the Terraform in `infra/terraform` (or match it): private subnets, TLS
  everywhere, encryption at rest with a customer-managed key, Redis with TLS, secrets only
  in Secrets Manager.
- Keep `NODE_ENV=production`: every API refuses to boot with development or short secrets,
  and learner-api without its own `LEARNER_JWT_SECRET`.
- Keep `CREDENTIALS_ENCRYPTION_KEY` in Secrets Manager and back it up: without it every
  academy has to enter its gateway credentials again.
- Set `TRUST_PROXY` to the number of proxies in front of each API (1 behind the ALB) so rate
  limits and logs see the real client address.
- Point `STRIPE_API_BASE`, `RAZORPAY_API_BASE`, `EVS_API_URL` and `AI_BASE_URL` at the real
  services (or leave the gateway bases unset), and set the platform webhook secrets before
  taking real payments.
- Keep the platform sender on a verified SES domain with DKIM.
- Subscribe someone to the alarm topic (`alarm_email`).
