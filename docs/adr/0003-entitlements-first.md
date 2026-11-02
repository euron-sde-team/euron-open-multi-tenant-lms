# ADR 0003: Entitlements first, with default deny

## Status

Accepted.

## Context

The operator sells plans: a price and a set of limits (how many courses can be published,
whether books are on, whether AI authoring is included). Plans change over time: prices
move, limits are raised, promotional versions come and go. A tenant who bought a plan must
keep what they bought until they change it, and support staff need to give one tenant more
of something without inventing a plan for it.

If runtime code read the plan a tenant is on, every plan edit would silently change what
existing tenants get, a manual exception would need a fake plan, and an add-on would need
to be merged with the plan on every check.

## Decision

- **Plans are sales artifacts; entitlements are runtime artifacts.** Runtime code never
  reads `plans`, `plan_versions` or `plan_version_products`. It reads `entitlements`
  (limits) and `tenant_usage_counters` (consumption).
- **Published plan versions are immutable.** Editing a live or published version is refused
  in the service; a change is a new version. Publishing a version retires the previous live
  one. A retired version can be published again (offer cycling).
- **Snapshot on subscription.** Assigning a plan, by the operator or by the tenant paying
  for it, copies every product limit of the version into `entitlements` with
  `source = PLAN`, and copies the plan's code, name, version and price into `subscriptions`,
  under a per-tenant advisory lock. After that, the tenant's entitlements are independent of
  the plan.
- **Other sources sit next to the plan's.** `ADDON` (purchased extras), `ADMIN` (manual
  grants) and `PROMO` rows coexist with `PLAN` rows. A plan change archives only the `PLAN`
  rows. Manual limit changes are overrides with a mandatory reason.
- **Default deny.** No active entitlement for a product means the feature is off and the
  capacity is zero. The seed snapshots every product into each plan, so a plan that should
  allow something says so explicitly.
- **Usage is counted per scope and window.** Counters are keyed by tenant, product, scope
  (`TENANT` or `USER`) and window (`LIFETIME`, `MONTHLY`, `YEARLY`), so monthly and per-user
  limits need no cron. Consumption locks the counter row and checks the limit inside one
  transaction, and each change is an event in `tenant_usage_events`.

Details: [multi-tenancy-and-entitlements.md](../architecture/multi-tenancy-and-entitlements.md).

## Consequences

Positive:

- Changing a plan never changes an existing customer by accident.
- Support can grant, revoke or override a single product for one tenant, with an audit
  trail, and add-ons need no special casing in checks.
- A forgotten product is a locked feature, not an open one. Mistakes fail closed.
- One code path answers every "may this tenant do X" question.

Trade-offs:

- Improving a plan for existing subscribers is an explicit operation (the entitlement sync
  preview and apply endpoints), not a side effect.
- Entitlements and counters can drift from reality (a crash between a publish and its
  consume). A reconciliation job recounts and corrects every 30 minutes.
- Immutability lives in the service layer; a direct database edit can still change a
  published version.
- Default deny means a new feature needs its product added to the catalog, to the plans and
  to existing tenants (through the sync) before anyone can use it.

## Alternatives considered

- **Read the plan at runtime.** Simple until the first price change or exception.
- **Feature flags per tenant without a catalog.** Loses the link between what was sold and
  what is enabled, and has no notion of counted limits.
- **Default allow** (a missing row means unlimited). It was the behaviour of the code this
  came from and it meant any product missing from a plan was free. Rejected.
