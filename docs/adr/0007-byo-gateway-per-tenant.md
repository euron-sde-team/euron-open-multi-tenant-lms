# ADR 0007: Each tenant brings its own payment gateway

## Status

Accepted.

## Context

Learners pay tenants, not the operator. Collecting every tenant's revenue in one operator
account and paying it out later makes the operator a payment facilitator: settlement,
payouts, tax on someone else's income, chargebacks for products it does not sell, and
regulation that varies by country. The code this came from supported that model alongside
several gateways; the open-source version had to pick something a self-hoster can run.

Tenants also already have, or can open, their own Stripe or Razorpay account in their own
name, with their own tax registration and settlement currency.

## Decision

- Each tenant connects its own gateway account in the tenant admin. Supported providers:
  Stripe and Razorpay, mode `SELF_MANAGED` only. One connection is active at a time.
- Learner checkout in learner-api always uses the tenant's active connection; money settles
  directly in the tenant's account. The platform fee on an order is zero.
- Credentials are verified with a live, read-only call before they are saved, then sealed
  with AES-256-GCM (`enc:v1:` prefix, key derived from `CREDENTIALS_ENCRYPTION_KEY`) into
  `tenant_gateway_connections.credentials_encrypted`. The API never returns them; responses
  only say whether credentials are configured.
- Webhooks from a tenant's account go to learner-api, which finds the order, then verifies
  the signature with that tenant's webhook secret before trusting the payload.
- The operator's own account is used only for platform billing (tenants paying for plans),
  configured by the `PLATFORM_*` environment variables on admin-api, with its own webhook
  endpoints.

Details: [payments-and-currency.md](../architecture/payments-and-currency.md).

## Consequences

Positive:

- The operator never holds tenant revenue, so there is no payout ledger and no settlement
  risk in the platform.
- Each tenant sees its payments, refunds and disputes in its own dashboard, and issues
  refunds there (the platform has no refund endpoint; staff revoke access by hand).
- A leaked database dump does not yield usable gateway keys without the encryption key.

Trade-offs:

- Every tenant has to open and configure a gateway account before selling, including the
  webhook URL and secret. The tenant admin shows the URLs and events to configure.
- The operator cannot take a revenue share through the gateway; charging tenants is done
  through plans instead.
- One key encrypts every tenant's credentials, with no key id and no rotation. Changing
  `CREDENTIALS_ENCRYPTION_KEY` makes every stored credential unreadable; tenants must
  re-enter them. Envelope encryption with KMS is the planned improvement.
- `openSecret` returns a value without the `enc:v1:` prefix unchanged, as legacy plaintext.
  Nothing in this codebase writes plaintext, but a row written by hand would be accepted.
- Learner subscriptions exist only for Razorpay.

## Alternatives considered

- **Platform-managed collection with payouts.** Rejected for the regulatory and operational
  load it puts on every self-hoster.
- **Stripe Connect or Razorpay Route.** Lets the platform take a fee automatically, but ties
  the deployment to one provider's marketplace product and its onboarding. A possible later
  addition.
- **Plaintext credentials protected only by database access.** Rejected: dumps, replicas and
  backups would all carry working keys.
