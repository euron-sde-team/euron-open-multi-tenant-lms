# ADR 0006: Floci for AWS locally, provisioned by the production Terraform

## Status

Accepted.

## Context

The APIs use S3 for files (course media, book files, submissions, certificates, exports),
SES for mail, and an SNS topic with an SQS queue for SES delivery events. A developer or a
CI job should run the whole product with no AWS account, and the local resources should be
the same shape as the ones production gets, so a missing bucket CORS rule or a wrong
identity is found before a deploy.

Mocking each client in code would test the mock. LocalStack's free edition no longer covers
everything needed. Pointing development at a shared AWS account costs money, needs
credentials on every laptop, and lets one developer's test mail reach real inboxes.

## Decision

- Run [Floci](https://github.com/floci-io/floci) (MIT), an AWS emulator, as the `floci`
  service in [`deploy/compose/compose.floci.yaml`](../../deploy/compose/compose.floci.yaml).
  `make up` uses this overlay.
- A `terraform` one-shot container applies
  [`infra/terraform/envs/local-floci`](../../infra/terraform/envs/local-floci/main.tf) against
  the emulator before any API starts. That environment calls the same `kms`, `secrets`,
  `storage` and `email` modules production uses, plus an emulated Route53 zone so the SES
  identity is verified through its DKIM records as on AWS.
- The APIs get `AWS_ENDPOINT_URL=http://floci:4566`, path-style S3, the bucket
  `open-mtlms-local-assets`, and `AWS_S3_PUBLIC_ENDPOINT=http://localhost:4647` so browsers
  receive links and presigned uploads they can reach.
- Floci relays every SES send to Mailpit; mail is read at `http://localhost:8096`.
- Postgres and Redis stay plain containers. Floci emulates the ElastiCache control plane but
  needs the Docker socket to back it with a real server, which is not worth mounting.
- Terraform state for the emulator lives in the `tfdata` volume next to the emulator's own
  data, so `make down` deletes both together.
- Payment gateways, the video system and the AI endpoint are not AWS; they are simulated by
  [`apps/stubs`](../../apps/stubs/README.md) instead.

## Consequences

Positive:

- The modules that build production are applied on every `make up`; a module that does not
  apply locally is noticed early.
- Mail, presigned uploads and the SES event queue work end to end on a laptop and in CI.
- No AWS credentials exist on a developer machine for the local stack.

Trade-offs:

- An emulator is not AWS. IAM policies are not enforced, and some behaviours (SES sandbox
  limits, bucket policy denials, KMS grants) only show up on a real account. `make up-aws`
  runs the local containers against real AWS resources to close that gap.
- The first `make up` pulls the emulator and Terraform images and applies the modules,
  which adds time.
- The stack depends on a third-party emulator release (`floci/floci:2.3.0`, pinned).

## Alternatives considered

- **No AWS at all locally.** The base `compose.yaml` alone still works: files on local disk
  (`LOCAL_STORAGE_DIR`) and mail logged instead of sent. Kept as a fallback, not the default,
  because it skips the code paths production uses.
- **LocalStack.** Similar idea; the services this stack needs are not all in its free
  edition.
- **A shared development AWS account.** Rejected for cost, credentials on laptops, and real
  mail.
