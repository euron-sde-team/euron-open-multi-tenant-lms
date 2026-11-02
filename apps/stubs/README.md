# Provider stubs

One dependency-free `node:http` server (port 5189) that stands in for every external
provider the platform calls, so the whole stack runs on a laptop or in CI with no
accounts, no keys and no network:

| Provider | What is simulated |
| --- | --- |
| Stripe | Checkout Sessions, PaymentIntents, refunds, a hosted checkout page, signed `checkout.session.completed` / `payment_intent.succeeded` webhooks |
| Razorpay | Orders, payments, refunds, plans, subscriptions (cancel, pause, resume), a `checkout.js` stand-in with a hosted payment screen, checkout signatures and signed webhooks |
| EVS (video system) | `POST /v1/videos/:id/playback-sessions` returning `{ manifestUrl, token, expiresAt }` for a bundled 6-second HLS sample |
| OpenAI-compatible API | `POST /v1/chat/completions` (plain, `json_object`, `json_schema`, `stream`) and `GET /v1/models`, with deterministic output |

Everything is kept in memory: a restart forgets every order and session.

```bash
pnpm --filter @open-mtlms/stubs start     # node src/server.ts (Node 22.18+ runs TypeScript natively)
pnpm --filter @open-mtlms/stubs test      # vitest: signature helpers, parsers, every flow end to end
```

`make up` starts it as the `stubs` compose service and points the APIs at it. Open
http://localhost:5189 for the route list and http://localhost:5189/__stubs/webhooks for
the last 100 webhook deliveries (target, status and response).

## Pointing the APIs at it

| Variable (API side) | Local value | Used for |
| --- | --- | --- |
| `STRIPE_API_BASE` | `http://stubs:5189` | `new Stripe(key, { host, port, protocol })` |
| `RAZORPAY_API_BASE` | `http://stubs:5189` | the Razorpay SDK's request base (`instance.api.rq.defaults.baseURL`) |
| `NEXT_PUBLIC_RAZORPAY_CHECKOUT_URL` (web) | `http://localhost:5189/razorpay/checkout.js` | instead of the hosted `checkout.js` |
| `EVS_API_URL`, `EVS_API_KEY` | `http://stubs:5189`, any value | playback sessions |
| `AI_BASE_URL`, `AI_API_KEY` | `http://stubs:5189/v1`, any value | `AI_PROVIDER=openai` against the stub |

The REST paths match the real APIs (`/v1/...`). The same paths are also accepted under
`/stripe/v1/...`, `/razorpay/v1/...`, `/evs/v1/...` and `/openai/v1/...`.

## Flows

**Stripe.** The API creates a Checkout Session; `session.url` is the stub's hosted page.
Clicking **Pay** completes the session, POSTs a `checkout.session.completed` event signed
with `STUBS_STRIPE_WEBHOOK_SECRET` (`Stripe-Signature: t=..,v1=..`, the scheme
`stripe.webhooks.constructEvent` verifies) and then redirects to `success_url` with
`{CHECKOUT_SESSION_ID}` filled in. **Cancel** redirects to `cancel_url`.

**Razorpay.** The web app loads the stub's `checkout.js`; `new Razorpay(options).open()`
opens the hosted screen in a popup. **Pay** creates a captured payment, POSTs
`payment.captured` and `order.paid` (or `subscription.authenticated`, `.activated`,
`.charged`) signed with `STUBS_RAZORPAY_WEBHOOK_SECRET` in `X-Razorpay-Signature`, and
hands `options.handler` the usual `{ razorpay_payment_id, razorpay_order_id,
razorpay_signature }`. That signature is HMAC-SHA256 over `order_id|payment_id` (or
`payment_id|subscription_id`) with the key secret the order was created with, so the
API's normal verification passes. **Fail** fires `payment.failed`; **Cancel** calls
`modal.ondismiss`.

**Where webhooks go.** Requests authenticated with the platform keys
(`STUBS_PLATFORM_STRIPE_SECRET_KEY`, `STUBS_PLATFORM_RAZORPAY_KEY_ID`) are platform
billing (the operator charging a tenant): their subscription events go to admin-api
(`/api/v1/webhook/stripe/subscription`, `/api/v1/webhook/razorpay/subscription`). Every
other key is a tenant's own gateway account, and its events go to learner-api
(`/api/v1/webhooks/stripe`, `/api/v1/webhooks/razorpay`). A tenant's gateway connection
must store the stub's webhook secret for learner-api to accept them (the demo seed does
this).

## Settings

| Variable | Default |
| --- | --- |
| `PORT`, `HOST` | `5189`, `0.0.0.0` |
| `STUBS_PUBLIC_URL` | `http://localhost:5189` (what a browser uses: hosted pages, manifests) |
| `STUBS_LEARNER_API_URL`, `STUBS_ADMIN_API_URL` | `http://localhost:5096`, `http://localhost:5086` |
| `STUBS_LEARNER_STRIPE_WEBHOOK_PATH`, `STUBS_LEARNER_RAZORPAY_WEBHOOK_PATH` | `/api/v1/webhooks/stripe`, `/api/v1/webhooks/razorpay` |
| `STUBS_ADMIN_STRIPE_WEBHOOK_PATH`, `STUBS_ADMIN_RAZORPAY_WEBHOOK_PATH` | `/api/v1/webhook/stripe/subscription`, `/api/v1/webhook/razorpay/subscription` |
| `STUBS_STRIPE_WEBHOOK_SECRET`, `STUBS_RAZORPAY_WEBHOOK_SECRET` | visibly fake local values |
| `STUBS_PLATFORM_STRIPE_SECRET_KEY`, `STUBS_PLATFORM_RAZORPAY_KEY_ID` | `sk_test_stub_platform`, `rzp_test_stubplatform` |
| `STUBS_EVS_API_KEY`, `STUBS_AI_API_KEY` | empty (no key check) |
| `STUBS_HLS_MANIFEST_URL` | empty (the bundled sample) |

The secrets here are local-only test values. Never point a real gateway's webhooks, or
real keys, at the stubs.
