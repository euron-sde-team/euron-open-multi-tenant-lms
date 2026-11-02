# Application secrets in Secrets Manager. ECS injects them into the three API
# containers as environment variables; the values never appear in a task definition
# or a log.
#
#   <prefix>/app        JWT_SECRET: 64 random characters, signs staff and operator tokens;
#                       LEARNER_JWT_SECRET signs learner sessions.
#                       CREDENTIALS_ENCRYPTION_KEY: 64 random characters, seals every
#                       tenant-supplied gateway credential at rest (Stripe, Razorpay
#                       keys and webhook signing secrets).
#                       INTERNAL_API_KEY: 48 random characters, authenticates the calls
#                       the APIs make to each other.
#                       The APIs refuse to start in production without all three. Rotating
#                       JWT_SECRET signs everyone out; rotating the encryption key makes
#                       the stored tenant credentials unreadable (re-enter them), so it
#                       is a procedure, not a re-roll.
#   <prefix>/providers  Platform provider keys (AI, EVS, platform Stripe / Razorpay
#                       billing), only the ones passed in provider_secrets. A deployment
#                       boots with none: AI authoring falls back to the offline engine.
#
# Third-party values passed in provider_secrets land in Terraform state. To keep them
# out, pass a placeholder (for example "set-me") for each key you want injected and
# replace the whole JSON by hand afterwards (aws secretsmanager put-secret-value).
# Terraform never overwrites a value afterwards: secret_string is ignore_changes.
#
# REDIS_URL lives in the cache module's secret and PG_DATABASE_PASSWORD in the
# database module's, next to what they belong to.
locals {
  provider_keys = sort(nonsensitive(keys(var.provider_secrets)))
}

resource "random_password" "jwt" {
  length  = 64
  special = false
}

# Signs learner sessions only, so a staff or operator token can never pass as a
# learner's (learner-api refuses to start in production without it).
resource "random_password" "learner_jwt" {
  length  = 64
  special = false
}

resource "random_password" "credentials" {
  length  = 64
  special = false
}

resource "random_password" "internal" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "app" {
  #checkov:skip=CKV2_AWS_57:Signing and data-encryption keys; rotating them signs everyone out or needs re-encryption, so it is an operator procedure, not a Lambda.
  name                    = "${var.name_prefix}/app"
  description             = "JWT_SECRET, LEARNER_JWT_SECRET, CREDENTIALS_ENCRYPTION_KEY and INTERNAL_API_KEY for the APIs"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = var.recovery_window_in_days
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    JWT_SECRET                 = coalesce(var.jwt_secret, random_password.jwt.result)
    LEARNER_JWT_SECRET         = random_password.learner_jwt.result
    CREDENTIALS_ENCRYPTION_KEY = coalesce(var.credentials_encryption_key, random_password.credentials.result)
    INTERNAL_API_KEY           = coalesce(var.internal_api_key, random_password.internal.result)
  })

  # Rotation happens out of band (put a new version by hand or by pipeline). Without
  # this, the next `terraform apply` would quietly roll the values back.
  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "providers" {
  #checkov:skip=CKV2_AWS_57:Third-party provider keys; they are rotated at each provider, then put here by hand.
  count                   = length(local.provider_keys) > 0 ? 1 : 0
  name                    = "${var.name_prefix}/providers"
  description             = "Platform provider keys for the APIs (AI, video, platform billing)"
  kms_key_id              = var.kms_key_arn
  recovery_window_in_days = var.recovery_window_in_days
}

resource "aws_secretsmanager_secret_version" "providers" {
  count         = length(local.provider_keys) > 0 ? 1 : 0
  secret_id     = aws_secretsmanager_secret.providers[0].id
  secret_string = jsonencode(var.provider_secrets)

  lifecycle {
    ignore_changes = [secret_string]
  }
}

locals {
  refs = concat(
    [for k in ["CREDENTIALS_ENCRYPTION_KEY", "INTERNAL_API_KEY", "JWT_SECRET", "LEARNER_JWT_SECRET"] : { name = k, valueFrom = "${aws_secretsmanager_secret.app.arn}:${k}::" }],
    [for k in local.provider_keys : { name = k, valueFrom = "${aws_secretsmanager_secret.providers[0].arn}:${k}::" }],
  )
}
