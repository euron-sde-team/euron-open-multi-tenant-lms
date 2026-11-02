# Documentation

Euron Open Multi-Tenant LMS is a self-hosted, three-tier, multi-tenant learning platform: an
operator console that sells plans and entitlements, a tenant admin for building courses,
books, bundles, batches, test series and storefronts, and a themed learner storefront with
checkout. These pages describe the system as it is in this repository; every path, endpoint
and variable named here is in the code.

## Start here

| If you want to | Read |
| --- | --- |
| Run it on your machine in a few minutes | [guides/quickstart-local.md](guides/quickstart-local.md) |
| See all three tiers working together | [guides/walkthrough.md](guides/walkthrough.md) |
| Understand the design | [architecture/HLD.md](architecture/HLD.md) |
| Put it on AWS | [guides/deploy-aws.md](guides/deploy-aws.md) |
| Know what is not safe yet | [architecture/security.md](architecture/security.md#known-gaps) |

## Architecture

| Page | Covers |
| --- | --- |
| [HLD.md](architecture/HLD.md) | Three tiers, three APIs, one database; tenant resolution by subdomain or custom domain; a request end to end |
| [LLD.md](architecture/LLD.md) | Each app's layers (routes, controllers, services, repositories, Kysely), middleware, auth, workers and queues, front ends |
| [data-model.md](architecture/data-model.md) | Table groups and how they relate |
| [multi-tenancy-and-entitlements.md](architecture/multi-tenancy-and-entitlements.md) | Catalog, immutable plan versions, the snapshot, usage counters, default deny |
| [templates-and-theming.md](architecture/templates-and-theming.md) | JSON pages, the section registry, page templates, two-layer theming, custom-code pages |
| [video.md](architecture/video.md) | EVS playback sessions, external providers, the enrollment check, previews |
| [payments-and-currency.md](architecture/payments-and-currency.md) | Tenant gateways, sealed credentials, checkout, webhooks, fulfillment, price books, platform billing |
| [ai-authoring.md](architecture/ai-authoring.md) | Provider abstraction, offline engine, entitlement gate, what can be generated |
| [security.md](architecture/security.md) | Controls per tier and the known gaps |
| [threat-model.md](architecture/threat-model.md) | STRIDE table and residual risks |

## Decisions

[adr/README.md](adr/README.md): three APIs over one schema, Kysely with SQL migrations,
entitlements first, JSON page templates, video through euron-video-system, Floci for local
AWS, bring-your-own gateway per tenant.

## Guides

| Guide | For |
| --- | --- |
| [quickstart-local.md](guides/quickstart-local.md) | `make up`, `make demo`, URLs, demo accounts, `lvh.me` |
| [walkthrough.md](guides/walkthrough.md) | Operator to tenant admin to learner, end to end |
| [configuration.md](guides/configuration.md) | Every environment variable per app |
| [add-a-template.md](guides/add-a-template.md) | New page templates, themes and section types |
| [connect-real-providers.md](guides/connect-real-providers.md) | Stripe, Razorpay, EVS, SES, an OpenAI-compatible endpoint |
| [deploy-aws.md](guides/deploy-aws.md) | Terraform, images, migrations, first operator, webhooks, custom domains |
| [operations.md](guides/operations.md) | Migrations, seeds, backups, jobs, scaling, logs, secret rotation |
| [testing.md](guides/testing.md) | Unit, integration, end-to-end, CI |
| [troubleshooting.md](guides/troubleshooting.md) | Symptoms and fixes |

## Diagrams

Mermaid sources are in [diagrams/](diagrams) and rendered SVGs in
[assets/diagrams/](assets/diagrams):

| Diagram | Source | Used in |
| --- | --- | --- |
| System context | [context.mmd](diagrams/context.mmd) | [HLD.md](architecture/HLD.md) |
| Deployment on AWS | [deployment.mmd](diagrams/deployment.mmd) | [deploy-aws.md](guides/deploy-aws.md) |
| Request and tenant resolution | [request-and-tenant-resolution.mmd](diagrams/request-and-tenant-resolution.mmd) | [HLD.md](architecture/HLD.md) |
| Checkout and fulfillment | [checkout-and-fulfillment.mmd](diagrams/checkout-and-fulfillment.mmd) | [payments-and-currency.md](architecture/payments-and-currency.md) |

To re-render after editing a source:

```bash
npx -y @mermaid-js/mermaid-cli -i docs/diagrams/context.mmd -o docs/assets/diagrams/context.svg -b white
```

## Conventions in these docs

- Paths are relative to the repository root.
- Ports are the local defaults (console 3600, admin 3610, web 3620, console-api 5076,
  admin-api 5086, learner-api 5096).
- Example domains are `example.com` and its subdomains; local storefronts are
  `<tenant>.lvh.me`.
