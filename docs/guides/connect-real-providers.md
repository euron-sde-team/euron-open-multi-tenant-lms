# Connect real providers

Locally every provider is a stub ([`apps/stubs`](../../apps/stubs/README.md)). This page
replaces each one with the real thing: Stripe and Razorpay for tenants and for platform
billing, euron-video-system for video, SES for mail, and an OpenAI-compatible endpoint for AI
authoring. Paths are relative to the repository root.

Use test-mode accounts first. Never point a real gateway's webhooks, or real keys, at the
stubs.

## Tenant gateways (learner checkout)

Each tenant connects its own account; nothing is configured on the server except the API
base URLs ([ADR 0007](../adr/0007-byo-gateway-per-tenant.md)).

1. Point the APIs at the real gateways. On AWS this is already the case
   (`STRIPE_API_BASE=https://api.stripe.com`, `RAZORPAY_API_BASE=https://api.razorpay.com`).
   Locally, set them in `deploy/compose/.env` and run `make up`:

   ```bash
   STRIPE_API_BASE=https://api.stripe.com
   RAZORPAY_API_BASE=https://api.razorpay.com
   ```

   For Razorpay, also build the storefront with the real Checkout script: leave
   `NEXT_PUBLIC_RAZORPAY_CHECKOUT_URL` empty (the default is
   `https://checkout.razorpay.com/v1/checkout.js`); compose sets it to the stub, so edit the
   `web` build args in `compose.yaml`.
2. The learner API must be reachable from the internet for webhooks. Locally use a tunnel to
   `localhost:5096`, and set `LEARNER_API_PUBLIC_URL` on admin-api to the tunnel URL so the
   tenant admin shows the right webhook address.
3. In the tenant admin, **Payment**, add a connection:

   | Provider | Fields | Webhook URL | Events |
   | --- | --- | --- | --- |
   | Stripe | `secret_key` (`sk_test_...`), `publishable_key`, `webhook_secret` (`whsec_...`) | `<learner API>/api/v1/webhooks/stripe` | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed` |
   | Razorpay | `key_id`, `key_secret`, `webhook_secret` | `<learner API>/api/v1/webhooks/razorpay` | `payment.captured` (plus `subscription.*` for learner subscriptions) |

   The keys are checked with a read-only call before they are saved (Stripe
   `GET /v1/balance`, Razorpay `GET /v1/plans`), then sealed. The webhook secret cannot be
   checked that way: copy it carefully. For Razorpay always set a dedicated webhook secret;
   without one the API falls back to the key secret.
4. Activate the connection (one is active at a time) and buy something on the storefront.
   The order turns `PAID` when the webhook arrives; if it does not, the storefront's verify
   call still fulfils the order. Check the gateway's webhook log for 2xx answers.

Currencies: each gateway's supported currencies are in the currency registry; checkout
refuses a currency the active gateway cannot charge
([payments-and-currency.md](../architecture/payments-and-currency.md#4-price-books-and-currencies)).

## Platform billing (tenants paying the operator)

Configured on admin-api with the operator's own account.

| Variable | Provider |
| --- | --- |
| `PLATFORM_STRIPE_SECRET_KEY`, `PLATFORM_STRIPE_PUBLISHABLE_KEY`, `PLATFORM_STRIPE_WEBHOOK_SECRET` | Stripe |
| `PLATFORM_RAZORPAY_KEY_ID`, `PLATFORM_RAZORPAY_KEY_SECRET`, `PLATFORM_RAZORPAY_WEBHOOK_SECRET` | Razorpay |

On AWS put them in `provider_secrets` (as placeholders) and then the real values into
`<name_prefix>/providers` ([deploy-aws.md](deploy-aws.md#1-configure)). Locally they are in
the `admin-api` service's `environment` in `compose.yaml`.

Webhooks, in the operator's gateway dashboard:

| Provider | URL | Signature header |
| --- | --- | --- |
| Stripe | `<admin API>/api/v1/webhook/stripe/subscription` | `stripe-signature` |
| Razorpay | `<admin API>/api/v1/webhook/razorpay/subscription` | `x-razorpay-signature` |

Subscribe Stripe to `customer.subscription.*` and `invoice.paid`, Razorpay to the
`subscription.*` events. In the console, **Providers** lists `RAZORPAY` and `STRIPE` (the
catalog seed creates both); a plan version needs an external plan at the provider, which
admin-api creates on the first checkout.

## euron-video-system (EVS)

1. Run an EVS deployment and create an API key for this LMS.
2. Set on admin-api and learner-api:

   ```bash
   EVS_API_URL=https://video.example.com
   EVS_API_KEY=<key>
   EVS_PLAYBACK_TTL_SECONDS=3600     # optional
   ```

   On AWS: `evs_api_url` in `terraform.tfvars` and `EVS_API_KEY` in `provider_secrets`.
3. Upload videos in EVS. In the curriculum editor, paste the EVS video id into a lecture.
   learner-api then requests a playback session per learner
   (`POST /v1/videos/{id}/playback-sessions`, viewer `<tenantId>:<memberId>`).

The EVS key is platform-wide: every tenant's staff can browse the EVS library through
`/api/v1/tenant/media/evs/videos`. Keep that in mind before sharing one EVS account across
unrelated tenants ([video.md](../architecture/video.md#7-gaps)).

External `https://` HLS and MP4 URLs and YouTube links need no configuration.

## Email (SES)

Locally Floci's SES relays to Mailpit. For real mail:

- **`make up-aws`** runs the local stack against real AWS: copy
  `deploy/compose/.env.aws.example` to `.env.aws`, fill in the bucket, region, sender
  (`AWS_SES_FROM_EMAIL`, a verified identity) and the SES events queue from
  `terraform output` of `envs/aws-dev`, and put `AWS_SES_ACCESS_KEY` and
  `AWS_SES_SECRET_KEY` in `deploy/compose/.env`.
- **On AWS** the `email` module creates the identity with DKIM and a custom MAIL FROM, and the
  APIs get `AWS_SES_FROM_EMAIL`, `AWS_SES_REGION` and `SES_EVENTS_QUEUE_URL`.
- Out of the SES sandbox you can mail anyone; in it, only verified addresses.
- Tenants can add their own sending domains in the tenant admin (**Settings**, **Email
  sending**). admin-api creates an SES identity and a configuration set per tenant that
  publishes to the events topic, verifies the DNS records every minute, and watches bounce
  and complaint rates.
- console-api reads its sender from `AWS_SES_FROM_EMAIL` (then `SES_FROM_EMAIL`) and
  `AWS_SES_FROM_NAME` (then `SES_FROM_NAME`), like the other APIs, and sends operator mail
  only when `AWS_SES_ACCESS_KEY` and `AWS_SES_SECRET_KEY` are set.

## AI authoring (OpenAI-compatible)

Set on admin-api:

```bash
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1     # or any OpenAI-compatible server
AI_API_KEY=<key>
AI_TEXT_MODEL=<model id>                  # empty means gpt-4o-mini
AI_IMAGE_MODEL=<image model id>           # optional; images are skipped when empty
```

Works with OpenAI, Azure OpenAI, OpenRouter, Ollama, vLLM, LM Studio and Gemini's
OpenAI-compatible endpoint. Per-purpose models: `AI_MODEL_COURSE`, `AI_MODEL_PAGE`,
`AI_MODEL_TEST` and so on. Without `AI_API_KEY` the offline engine keeps answering. On AWS:
`ai_provider`, `ai_base_url`, `ai_text_model`, `ai_image_model` in `terraform.tfvars` and
`AI_API_KEY` in `provider_secrets`. Tenants still need the `ai_authoring_enabled` entitlement
([ai-authoring.md](../architecture/ai-authoring.md)).

## Google sign-in for learners

Set `GOOGLE_CLIENT_ID` on learner-api and enable Google in the tenant's sign-in settings
(**Settings**, **Authentication**).

## Custom domains through Cloudflare

admin-api's `domain-verification` worker can verify tenant custom domains through Cloudflare:
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_CNAME_TARGET`. On AWS without
Cloudflare, add an ACM certificate per domain to the load balancer
([deploy-aws.md](deploy-aws.md#5-tenant-custom-domains)).
