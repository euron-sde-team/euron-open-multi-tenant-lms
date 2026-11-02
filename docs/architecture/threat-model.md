# Threat model

A STRIDE pass over Euron Open Multi-Tenant LMS: what is worth stealing or abusing, where trust
changes, what stops each threat, and what is left. The controls themselves are in
[security.md](security.md).

## Assets

| Asset | Why it matters |
| --- | --- |
| Tenant isolation | One tenant reading or changing another's courses, learners, orders or pages is the worst failure of a multi-tenant system |
| Learner personal data | Names, emails, phone numbers, progress, test results, submissions, certificates |
| Paid content | Lectures, books, tests; their value is that only enrolled learners get them |
| Orders and access grants | Marking an order paid or granting an enrollment without payment is direct revenue loss for a tenant |
| Tenant gateway credentials | A tenant's Stripe or Razorpay secret can refund, read customers and move money on that tenant's account |
| Platform billing keys | The operator's own gateway account |
| `JWT_SECRET`, `LEARNER_JWT_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`, `INTERNAL_API_KEY` | The first mints an operator or staff session; the second a learner session on any storefront; the third opens every stored gateway credential; the fourth calls internal endpoints |
| Operator sessions | An operator token reaches every tenant's plan, entitlements and staff |
| Entitlements | Decide what a tenant gets without paying for it |
| Storefront integrity | A tenant's pages are its brand; injected script there runs against its learners |
| Sending reputation | One tenant's mail can harm the shared SES account |

## Trust boundaries

1. **Browsers to the three APIs.** Operators, tenant staff and learners with bearer tokens;
   anyone on the internet without one, on public catalog, page and preview routes.
2. **Storefront host to tenant.** The learner API decides the tenant from a host name the
   client supplies (`Host` or `X-Tenant-Host`).
3. **Tenant staff to the storefront.** Tenant staff author content (sections, themes,
   custom-code pages, descriptions) that learners' browsers render.
4. **Gateways to webhook endpoints.** Stripe and Razorpay calling unauthenticated URLs that
   must prove themselves by signature.
5. **APIs to providers.** Gateways with tenant keys, EVS with the platform key, an AI endpoint
   that receives tenant content.
6. **APIs to Postgres, Redis, S3, SES.** Trusted, inside private networking on AWS.

## STRIDE

| Threat | Example | Mitigation | Residual |
| --- | --- | --- | --- |
| **Spoofing** | Guessing or stuffing a password | bcrypt; per-IP and per-email limits on every public auth route in all three APIs; WAF per-IP limit on AWS | console-api and admin-api count per process; no 2FA |
| | A staff or operator token used on another plane | Each API checks the token `type`; learner tokens have their own secret (`LEARNER_JWT_SECRET`) | |
| | A learner token used on another storefront | The token's `tenantId` must equal the tenant resolved from the host | |
| | Forging a payment webhook | HMAC or Stripe signature over the raw body with the tenant's secret, before any change | Razorpay falls back to `key_secret` when no webhook secret is stored |
| | Forging a Razorpay checkout return | Signature over the order's stored gateway order id and the payment id with the key secret; a mismatched id is refused | |
| | Calling internal endpoints | `INTERNAL_API_KEY` in `x-internal-key` | Non-constant-time compare |
| **Tampering** | Editing another tenant's course by id | Every query filtered by `tenant_id`; membership check on `X-Tenant-Id` | No row-level security behind the code |
| | Paying less than the price | Server-side pricing from the price book, server-side coupons and tax; captured amount and currency must equal the order total on every path that marks it paid | |
| | Changing a sold plan | Published plan versions are immutable in the service | No database constraint |
| | Script in a theme or HTML field | Sanitizer on input; theme values filtered to plain CSS values; JSON-LD escaped; custom-code pages in an opaque-origin sandbox | Some HTML fields render unsanitised ([security](security.md#known-gaps)) |
| | Replaying a webhook | Unique `(tenant, provider, event_id)`; `metadata.fulfilled`; Stripe timestamp tolerance | Razorpay event ids may fall back to a time-based value |
| **Repudiation** | Staff deny changing prices or publishing | `tenant_audit_logs` on `/tenant` and `/pages` writes; `admin_audit_logs` for operators | Audit rows are written after the response, best effort |
| | Operator denies raising a limit | `entitlement_overrides` and `tenant_usage_events` with a required reason and the operator id | |
| **Information disclosure** | Reading another tenant's data | Tenant scoping; 404 for foreign ids | As above |
| | Gateway keys from a database dump | AES-256-GCM sealing; write-only API | One key for all tenants; no rotation |
| | Paid video without enrollment | Enrollment check before playback; EVS session tokens with a TTL | External HLS and MP4 URLs are unsigned; EVS library not tenant-scoped for staff |
| | Draft content through public endpoints | Storefront and the public page-by-slug endpoint return only published content, without drafts or staff ids | |
| | Tokens stolen by script | CSP and sanitizer | Tokens in `localStorage` |
| | Tenant content sent to an AI provider | Offline mode by default; provider chosen by the operator | Prompts carry tenant content in `openai` mode |
| **Denial of service** | Request floods | WAF per-IP rate limit, autoscaling on AWS; auth route limits in the APIs | No general in-app rate limit |
| | Cache filling with fake hosts | Negative caching with a 60 second TTL | Tenant cache has no size bound |
| | Long AI jobs | One job per tenant per kind on BullMQ | No per-tenant AI budget |
| | A lost queue job after a webhook | Verify fallback, `verify-and-fulfill`, poll reconciliation for platform billing | No outbox |
| **Elevation of privilege** | Staff granting themselves owner powers | Owner-only codes (`gateway.configure`, `roles.manage`, `staff.manage`, `settings.auth`) are never granted to roles | |
| | A tenant using features it did not buy | Default-deny entitlements, checked server-side, including `quizzes_enabled`, `assignments_enabled` and `quiz_questions_per_quiz` | The AI question imports need only `tests.import`, not `ai_authoring_enabled` |
| | A suspended operator or staff member keeps acting | Status re-checked on every request | Sign-out does not revoke the token |
| | Any operator emailing tenants | `tenants.manage` on `/admin/tenant-analytics/:id/send-email` | |
| | Refund while keeping access | No learner refund endpoint | A refund made in the gateway dashboard leaves the order `PAID` and access in place until staff revoke it |

## Residual risks, in priority order

1. Tokens in `localStorage` combined with tenant HTML that some storefront components render
   unsanitised.
2. Refunds made in a gateway dashboard do not revoke access.
3. No 2FA for operators and staff, and their sign-out does not revoke the token.
4. One unrotatable credential encryption key.
5. EVS library shared across tenants.
6. A suspended tenant can still edit pages, uploads and certificate settings.

Each is listed with its location in [security.md](security.md#known-gaps) and
[payments-and-currency.md](payments-and-currency.md#8-gaps).
