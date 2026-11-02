# Configuration

Every environment variable each app reads, with its default and meaning, taken from each
app's `src/config/index.ts` (and the few files that read `process.env` directly), the
compose files and the Terraform task definitions. Paths are relative to the repository root.

Where settings come from:

| Where | Source |
| --- | --- |
| Local stack | [`deploy/compose/compose.yaml`](../../deploy/compose/compose.yaml) (`x-api-env` block and per-service `environment`), overlays [`compose.floci.yaml`](../../deploy/compose/compose.floci.yaml) and [`compose.aws.yaml`](../../deploy/compose/compose.aws.yaml), secrets from `deploy/compose/.env` (`make env`) |
| AWS | `api_environment` in [`infra/terraform/modules/deployment/main.tf`](../../infra/terraform/modules/deployment/main.tf), secrets from Secrets Manager, plus `api_extra_environment` and `api_extra_secrets` |
| An app run on the host | The shell, or a `.env` file in the app's folder (dotenv) |

The defaults in code are for local development. In production (`NODE_ENV=production`) the
APIs refuse to start with the development secrets
([security.md](../architecture/security.md#5-production-configuration-guard)).

## Compose variables (`deploy/compose/.env`)

| Variable | Default | Meaning |
| --- | --- | --- |
| `MTLMS_JWT_SECRET` | generated | `JWT_SECRET` of all three APIs |
| `MTLMS_LEARNER_JWT_SECRET` | generated | `LEARNER_JWT_SECRET` (learner-api reads it) |
| `MTLMS_CREDENTIALS_ENCRYPTION_KEY` | generated | `CREDENTIALS_ENCRYPTION_KEY` of all three APIs |
| `MTLMS_INTERNAL_API_KEY` | generated | `INTERNAL_API_KEY` of all three APIs |
| `MTLMS_DEMO_PASSWORD` | generated (`Demo-...`) | `DEMO_PASSWORD` for `make demo` |
| `MTLMS_BRAND_NAME` | `Open LMS Cloud` | `BRAND_NAME`, sender name |
| `MTLMS_ROOT_DOMAIN` | `lvh.me` | `ROOT_DOMAIN` and `NEXT_PUBLIC_ROOT_DOMAIN` |
| `MTLMS_*_PORT` | see [quickstart-local.md](quickstart-local.md#ports) | Host ports |
| `LOG_LEVEL`, `PG_POOL_MAX` | `info`, `10` | Passed to the APIs |
| `MTLMS_AUTH_RATE_LIMIT_PER_EMAIL`, `MTLMS_AUTH_RATE_LIMIT_PER_IP`, `MTLMS_AUTH_RATE_LIMIT_SCALE` | `100`, `300`, `10` | Relaxed sign-in limits for local use, passed as `AUTH_RATE_LIMIT_PER_EMAIL`, `AUTH_RATE_LIMIT_PER_IP` (console-api, admin-api) and `AUTH_RATE_LIMIT_SCALE` (learner-api) |
| `STRIPE_API_BASE`, `RAZORPAY_API_BASE`, `EVS_API_URL`, `EVS_API_KEY` | the stubs | Provider endpoints |
| `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_TEXT_MODEL`, `AI_IMAGE_MODEL` | `offline`, the stub | AI authoring on admin-api |
| `NEXT_PUBLIC_POSTHOG_KEY` | empty | Product analytics in the web apps |

## Shared by the three APIs

| Variable | Default in code | Meaning |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` enables the config guard, hides error messages, forks one worker per CPU |
| `PORT` | `5076`, `5086`, `5096` | Listen port |
| `JWT_SECRET` | a `dev-only-...` value per API | Signs and verifies operator and staff tokens; learner-api checks it in production only to refuse a reuse as `LEARNER_JWT_SECRET` |
| `JWT_EXPIRY` | `24h` (console, admin), `30d` (learner) | Token lifetime |
| `CREDENTIALS_ENCRYPTION_KEY` | `dev-only-credentials-encryption-key-change-me` | Seals tenant gateway credentials; admin-api and learner-api must agree. Changing it makes stored credentials unreadable |
| `INTERNAL_API_KEY` | dev value (empty in console-api) | Service-to-service key, header `x-internal-key` |
| `TRUST_PROXY` | `1` | Number of proxy hops Express trusts for `req.ip` (logs and rate limits). Compose sets `0`, Terraform `1` |
| `LOG_LEVEL` | `info` in production, else `debug` (learner-api: `debug`) | winston level |
| `LOG_FILE` | empty | Adds a file transport at this path (learner-api: errors only); logs always go to stdout |
| `SERVER_NAME` | the app name | Log label |
| `PG_DATABASE_HOST`, `PG_DATABASE_PORT`, `PG_DATABASE_USER`, `PG_DATABASE_PASSWORD`, `PG_DATABASE` | `localhost`, `5542`, `postgres`, `postgres`, `open_mtlms` | Database |
| `PG_POOL_MAX`, `PG_POOL_MIN`, `PG_CONNECTION_TIMEOUT`, `PG_IDLE_TIMEOUT` | pool defaults in each `db/connection.ts` | Pool per cluster worker |
| `PGSSLMODE`, `NODE_EXTRA_CA_CERTS` | unset | Set on AWS to `verify-full` and the bundled RDS CA |
| `ROOT_DOMAIN` | `lvh.me` | Storefronts are `<tenant>.<ROOT_DOMAIN>` |

`db/migrate.ts` reads `DATABASE_URL` first, otherwise the `PG_DATABASE_*` variables, plus
`PG_SSL=true` and `MIGRATIONS_DIR`. `BRAND_NAME` (outside admin-api) and
`CONSOLE_API_PUBLIC_URL` are set by compose and Terraform but not read by every API.

Redis (admin-api and learner-api; console-api uses none): `REDIS_URL`
(`redis[s]://[user:password@]host:port[/db]`) wins over `REDIS_HOST`, `REDIS_PORT`,
`REDIS_PASSWORD` and `REDIS_DB`; `rediss://` (or `REDIS_TLS=true` without a URL) turns TLS
on. `BULLMQ_PREFIX` (`bull`) and `CACHE_BUS_PREFIX` (`lms:`) give a second install or a
test run its own keys.

## console-api

| Variable | Default | Meaning |
| --- | --- | --- |
| `CORS_ORIGINS` | `http://localhost:3600` | Allowed browser origins, comma-separated |
| `APP_CONFIG_SALT` | `open-lms-application-config-salt` | Salt for sealing application config; refused in production when left at the default |
| `AUTH_RATE_LIMIT_PER_IP`, `AUTH_RATE_LIMIT_PER_EMAIL`, `AUTH_RATE_LIMIT_WINDOW_MS` | `30`, `10`, `900000` (15 minutes) | Operator sign-in limits, counted in process memory |
| `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY`, `AWS_SES_SECRET_KEY` | `us-east-1`, empty, empty | SES; no mail is sent while the keys are empty |
| `AWS_SES_FROM_EMAIL` or `SES_FROM_EMAIL`, `AWS_SES_FROM_NAME` or `SES_FROM_NAME` | `noreply@example.com`, `Open LMS Cloud` | Sender |
| `PLATFORM_NAME` | `Open LMS Cloud` | Name in operator emails |
| `DEFAULT_SUPPORT_EMAIL` | `support@example.com` | Support address on new tenants |
| `CONSOLE_URL` | `http://localhost:3600` | Console address |

Scripts in `apps/console-api/scripts` also read `DEMO_PASSWORD`,
`CONSOLE_API_INTERNAL_URL`, `ADMIN_API_INTERNAL_URL`, `LEARNER_API_INTERNAL_URL`,
`STUBS_URL` or `STRIPE_API_BASE`, `ROOT_DOMAIN`, `CONSOLE_URL`, `ADMIN_URL`, `WEB_PORT` and
the `STUB_*` credentials (demo seed).

## admin-api

| Group | Variables (default) |
| --- | --- |
| Web | `CORS_ORIGINS` (empty: any origin; required in production) |
| Sign-in limits | `AUTH_RATE_LIMIT_PER_IP` (`30`), `AUTH_RATE_LIMIT_PER_EMAIL` (`10`), `AUTH_RATE_LIMIT_WINDOW_MS` (`900000`), per route, in process memory |
| Identity | `BRAND_NAME` or `PLATFORM_NAME` (`Open LMS Cloud`), `PLATFORM_URL` or `WEB_URL` (`https://example.com`), `PLATFORM_LOGO_URL`, `CONTACT_EMAIL` (`support@example.com`); invoice details `PLATFORM_LEGAL_NAME`, `BILLING_EMAIL`, `PLATFORM_CIN`, `PLATFORM_GSTIN`, `PLATFORM_PAN`, `PLATFORM_HSN_SAC`, `PLATFORM_ADDRESS_LINE1`, `PLATFORM_ADDRESS_CITY`, `PLATFORM_ADDRESS_STATE`, `PLATFORM_ADDRESS_COUNTRY`, `PLATFORM_ADDRESS_POSTAL_CODE` |
| URLs | `ADMIN_URL` or `ADMIN_PORTAL_URL` (`http://localhost:3610`), `CONSOLE_URL` (`http://localhost:3600`), `STOREFRONT_SCHEME` (`https` in production, else `http`), `STOREFRONT_PORT` or `WEB_PORT` (`3620` outside production), `ADMIN_API_PUBLIC_URL` or `PUBLIC_API_BASE_URL` (`http://localhost:5086/api/v1`), `LEARNER_API_PUBLIC_URL` or `LEARNER_PUBLIC_API_BASE_URL` (`http://localhost:5096/api/v1`; shown to tenants as their webhook base), `LEARNER_API_INTERNAL_URL` (`http://localhost:5096`), `CONSOLE_API_INTERNAL_URL` (`http://localhost:5076/api/v1`), `CORE_ADMIN_INTERNAL_SECRET` |
| Redis and jobs | `REDIS_URL` (wins over the rest; `rediss://` means TLS), `REDIS_HOST` (`localhost`), `REDIS_PORT` (`6379`), `REDIS_PASSWORD`, `REDIS_DB` (`0`), `REDIS_TLS`, `BULLMQ_PREFIX` (`bull`), `CACHE_BUS_PREFIX` (`lms:`, must match learner-api), `RUN_JOB_WORKERS` (anything but `false` starts the workers) |
| S3 | `AWS_REGION` (`us-east-1`), `AWS_ENDPOINT_URL` (an emulator; also turns on path-style), `AWS_S3_FORCE_PATH_STYLE`, `AWS_S3_BUCKET` (`open-mtlms-local-assets`), `AWS_S3_PUBLIC_ENDPOINT` (host browsers use for presigned URLs), `AWS_S3_PUBLIC_BASE_URL` (public media base), `AWS_S3_ACCESS_KEY` or `AWS_ACCESS_KEY`, `AWS_S3_SECRET_KEY` or `AWS_SECRET_KEY`, `THUMBNAILS_S3_BUCKET`, `S3_LECTURE_RESOURCES_BUCKET`, `TESTIMONIALS_S3_BUCKET`, `TENANT_DETAILS_S3_BUCKET` (all default to the assets bucket) |
| Email | `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY`, `AWS_SES_SECRET_KEY` (fall back to the S3 keys), `AWS_SES_FROM_EMAIL` (`noreply@example.com`), `AWS_SES_FROM_NAME`, `SES_EVENTS_SNS_TOPIC_ARN`, `SES_EVENTS_QUEUE_URL` (enables the SES events consumer), `SES_EVENTS_DLQ_URL`, `EMAIL_UNSUBSCRIBE_SIGNING_SECRET` (`JWT_SECRET`), `EMAIL_DEFAULT_TENANT_TPS` (`12`), `EMAIL_ACCOUNT_TPS` (`25`), `EMAIL_REPUTATION_MIN_VOLUME` (`100`), `EMAIL_REPUTATION_AUTO_RECOVERY_HOURS` (`48`), `EMAIL_OPS_ALERT_WEBHOOK_URL` |
| Gateways | `STRIPE_API_BASE` (`https://api.stripe.com`), `RAZORPAY_API_BASE` (`https://api.razorpay.com`) |
| Platform billing | `PLATFORM_RAZORPAY_KEY_ID`, `PLATFORM_RAZORPAY_KEY_SECRET`, `PLATFORM_RAZORPAY_WEBHOOK_SECRET`, `PLATFORM_STRIPE_SECRET_KEY`, `PLATFORM_STRIPE_WEBHOOK_SECRET`, `PLATFORM_STRIPE_PUBLISHABLE_KEY` (all empty) |
| AI | `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_TEXT_MODEL` (`gpt-4o-mini`), `AI_MODEL_<PURPOSE>`, `AI_IMAGE_MODEL`, `AI_AUTO_GENERATION_ENABLED` (`false`), `AI_REQUEST_TIMEOUT_MS` (read, not applied); see [ai-authoring.md](../architecture/ai-authoring.md#1-provider) |
| Video | `EVS_API_URL`, `EVS_API_KEY` (empty), `EVS_PLAYBACK_TTL_SECONDS` (`3600`) |
| Custom domains | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `CLOUDFLARE_CNAME_TARGET` (`origin.example.com`) for domain verification through Cloudflare |
| Signed media | `CLOUDFRONT_DOMAIN`, `CLOUDFRONT_KEY_PAIR_ID`, `CLOUDFRONT_PRIVATE_KEY` |
| FX | `OPEN_EXCHANGE_RATES_API_KEY`, `USD_TO_INR_RATE` (`90`, display-only combined revenue) |
| Analytics | `ANALYTICS_DB_CONCURRENCY` (`4`), `POSTHOG_HOST`, `POSTHOG_APP_HOST`, `POSTHOG_PROJECT_ID`, `POSTHOG_PERSONAL_API_KEY` |
| One-time codes | `OTP_LENGTH` (`6`), `OTP_EXPIRY_MINUTES` (`15`), `OTP_MAX_ATTEMPTS` (`5`) |

## learner-api

| Group | Variables (default) |
| --- | --- |
| Tokens | `LEARNER_JWT_SECRET` (signs learner tokens; outside production falls back to `JWT_SECRET`; in production required, 32 or more characters, different from `JWT_SECRET`) |
| Sign-in limits | `AUTH_RATE_LIMIT_SCALE` (`1`): multiplies every per-IP and per-identifier budget of the auth routes (counted in Redis) |
| Tenancy | `ROOT_DOMAIN` (`lvh.me`), `RESERVED_SUBDOMAINS` (`www,admin,api,console,api-console,api-admin,assets`) |
| Web | none: CORS is `*` without credentials, so the `CORS_ORIGINS` compose passes to learner-api is not read |
| URLs | `FRONTEND_APP_URL` (`http://localhost:3620`; fallback for tenant links), `ADMIN_PORTAL_URL` (`http://localhost:3610`), `CONTACT_EMAIL`, `PLATFORM_NAME` |
| Redis and jobs | `REDIS_URL` (wins over the rest; `rediss://` means TLS), `REDIS_HOST` (`localhost`), `REDIS_PORT` (`6379`), `REDIS_PASSWORD`, `REDIS_DB`, `REDIS_TLS` (only without a URL), `BULLMQ_PREFIX` (`bull`), `CACHE_BUS_PREFIX` (`lms:`) |
| S3 | `AWS_REGION`, `AWS_ENDPOINT_URL`, `AWS_S3_FORCE_PATH_STYLE`, `AWS_S3_BUCKET`, `AWS_S3_PUBLIC_BASE_URL`, `AWS_S3_ACCESS_KEY` or `AWS_ACCESS_KEY`, `AWS_S3_SECRET_KEY` or `AWS_SECRET_KEY`, `TENANT_DETAILS_S3_BUCKET`, `THUMBNAILS_S3_BUCKET`, `S3_LECTURE_RESOURCES_BUCKET` (default the assets bucket, else `open-mtlms-assets`), `THUMBNAILS_BASE_URL`, `TENANT_DETAILS_BASE_URL`, `CERTIFICATE_LOGO_HOSTS` (`amazonaws.com,cloudfront.net`; allowlist of the certificate logo proxy) |
| Email | `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY`, `AWS_SES_SECRET_KEY`, `AWS_SES_FROM_EMAIL` (then `SES_FROM_EMAIL`, then `noreply@example.com`), `EMAIL_UNSUBSCRIBE_SIGNING_SECRET` (must match admin-api), `EMAIL_DEFAULT_TENANT_TPS`, `EMAIL_ACCOUNT_TPS`, `EMAIL_OPS_ALERT_WEBHOOK_URL` |
| Gateways | `STRIPE_API_BASE`, `RAZORPAY_API_BASE` (empty means the SDK default) |
| Video | `EVS_API_URL`, `EVS_API_KEY`, `EVS_PLAYBACK_TTL_SECONDS` (`3600`) |
| Sign-in | `GOOGLE_CLIENT_ID`, `OTP_LENGTH`, `OTP_EXPIRY_MINUTES`, `OTP_MAX_ATTEMPTS` |

## console (apps/console)

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:5076/api/v1` | console-api |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3600` | Own URL |
| `NEXT_PUBLIC_BRAND_NAME` | `Open LMS Cloud` | Brand |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `lvh.me` | Builds storefront links |
| `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_WEB_BASE_URL` | build args | Links to the other tiers |
| `NEXT_PUBLIC_ASSET_HOSTS` | empty | Image hosts for `next/image` |
| `NEXT_PUBLIC_SHOW_LOGGER` | unset | `true` logs API calls in the browser |

## admin (apps/admin)

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:5086/api/v1` | admin-api, reached from the browser through the `/api/proxy` rewrite |
| `API_BASE_URL` | unset | admin-api for server-side calls |
| `API_PROXY_TARGET` | unset (then `NEXT_PUBLIC_API_BASE_URL`) | Build arg: where the `/api/proxy` rewrite sends requests. Compose sets `http://admin-api:5086/api/v1` so the rewrite stays inside the network |
| `NEXT_PUBLIC_LEARNER_API_BASE_URL` | `http://localhost:5096/api/v1` | learner-api |
| `NEXT_PUBLIC_WEB_APP_URL` or `NEXT_PUBLIC_WEB_BASE_URL` | `http://<ROOT_DOMAIN>:3620` in development | Storefront links |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `lvh.me` | Tenant subdomains |
| `NEXT_PUBLIC_THUMBNAILS_BASE_URL`, `NEXT_PUBLIC_API_URL` | empty | Media and upload bases |
| `NEXT_PUBLIC_PLATFORM_NAME`, `NEXT_PUBLIC_PLATFORM_SENDER_EMAIL`, `NEXT_PUBLIC_SUPPORT_EMAIL`, `NEXT_PUBLIC_PLATFORM_LOGO_URL` | `Open LMS Cloud`, `noreply@example.com`, `support@example.com`, `/brand-logo.svg` | Brand |
| `NEXT_PUBLIC_AI_AUTO_IMAGES_ENABLED` | `false` | Generate images automatically during AI authoring |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_POSTHOG_PROJECT_ID`, `NEXT_PUBLIC_POSTHOG_APP_URL` | off | Analytics |
| `NEXT_PUBLIC_NODE_ENV` | unset | `production` switches storefront links to production form |

## web (apps/web)

| Variable | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:5096/api/v1` | learner-api from the browser |
| `API_INTERNAL_BASE_URL` | unset | learner-api from the server (middleware and server components); runtime, not build time |
| `USER_SERVER_URL`, `NEXT_PUBLIC_USER_SERVER_PORT` | unset, `5096` | Older fallbacks some helpers still read |
| `NEXT_PUBLIC_ROOT_DOMAIN` | `lvh.me` | Host classification in `middleware.ts` |
| `NEXT_PUBLIC_RESERVED_SUBDOMAINS` | `www,admin,api,console` | Hosts that are not tenants |
| `NEXT_PUBLIC_PLATFORM_NAME`, `NEXT_PUBLIC_PLATFORM_URL` | `Open LMS Cloud`, `https://example.com` | Brand |
| `NEXT_PUBLIC_ASSET_BASE_URL`, `NEXT_PUBLIC_TENANT_ASSETS_BASE_URL`, `NEXT_PUBLIC_THUMBNAILS_BASE_URL`, `NEXT_PUBLIC_PROFILE_BASE_URL` | empty | Media bases |
| `NEXT_PUBLIC_IMAGE_HOSTS` | empty (any `https` host) | `next/image` hosts |
| `NEXT_PUBLIC_RAZORPAY_CHECKOUT_URL` | `https://checkout.razorpay.com/v1/checkout.js` | Razorpay Checkout script (the stub's locally) |
| `NEXT_PUBLIC_TINYMCE_SCRIPT_SRC` | a pinned jsDelivr URL | Rich text editor script |
| `NEXT_PUBLIC_BOOK_AI_ENABLED` | unset | Book reader AI features |
| `NEXT_PUBLIC_POSTHOG_KEY`, `POSTHOG_PROXY_HOST`, `POSTHOG_ASSETS_HOST` | off | Analytics, proxied through the app |
| `NEXT_PUBLIC_NODE_ENV` | unset | `https` vs `http` in robots, sitemap and SEO links |

`NEXT_PUBLIC_*` values are compiled into the browser bundle: they are Docker build args
([`infra/docker/next.Dockerfile`](../../infra/docker/next.Dockerfile)) and a change needs a
rebuild. `scripts/aws-deploy.sh` builds each image with the deployment's hosts.

## Stubs (apps/stubs)

`PORT` (`5189`), `HOST`, `STUBS_PUBLIC_URL`, `STUBS_LEARNER_API_URL`, `STUBS_ADMIN_API_URL`, the
four `STUBS_*_WEBHOOK_PATH` values, `STUBS_STRIPE_WEBHOOK_SECRET`,
`STUBS_RAZORPAY_WEBHOOK_SECRET`, `STUBS_PLATFORM_STRIPE_SECRET_KEY`,
`STUBS_PLATFORM_RAZORPAY_KEY_ID`, `STUBS_EVS_API_KEY`, `STUBS_AI_API_KEY`,
`STUBS_HLS_MANIFEST_URL`. Defaults and meaning: [`apps/stubs/README.md`](../../apps/stubs/README.md#settings).

## End-to-end tests

`E2E_*` variables: [testing.md](testing.md#end-to-end-tests).

## On AWS

The deployment module sets, for the three APIs: `NODE_ENV=production`, `TZ=UTC`,
`LOG_LEVEL`, `BRAND_NAME`, `ROOT_DOMAIN`, the public and internal URLs of every tier,
`CORS_ORIGINS` (console and admin), `TRUST_PROXY=1`, `PG_*` and the TLS settings,
`AWS_REGION`, `AWS_S3_BUCKET`, `AWS_S3_PUBLIC_BASE_URL` (the media CDN), `AWS_SES_*`,
`SES_EVENTS_QUEUE_URL`, the real Stripe and Razorpay API bases, `EVS_API_URL` and the `AI_*`
settings. Secrets: `JWT_SECRET`, `LEARNER_JWT_SECRET`, `CREDENTIALS_ENCRYPTION_KEY`,
`INTERNAL_API_KEY` (`<name_prefix>/app`), `PG_DATABASE_PASSWORD`, `REDIS_URL`, and any `provider_secrets`
(`<name_prefix>/providers`). The Next.js services get `NODE_ENV`, `PORT`, `HOSTNAME`,
`ROOT_DOMAIN` and `API_INTERNAL_BASE_URL`. Add anything else with `api_extra_environment` or
`api_extra_secrets` ([deploy-aws.md](deploy-aws.md#1-configure)).
