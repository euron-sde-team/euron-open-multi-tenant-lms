variable "name_prefix" {
  description = "Prefix for every resource name."
  type        = string
}

variable "kms_key_arn" {
  description = "CMK that encrypts the secrets. Null uses the AWS-managed key."
  type        = string
  default     = null
}

variable "recovery_window_in_days" {
  description = "Days a deleted secret stays recoverable. 0 deletes immediately (local and throwaway environments)."
  type        = number
  default     = 30
}

variable "jwt_secret" {
  description = "JWT_SECRET (at least 32 characters). Null generates one. Set only when moving an existing installation."
  type        = string
  default     = null
  sensitive   = true
  validation {
    condition     = var.jwt_secret == null || try(length(var.jwt_secret) >= 32, false)
    error_message = "jwt_secret must be at least 32 characters."
  }
}

variable "credentials_encryption_key" {
  description = "CREDENTIALS_ENCRYPTION_KEY (at least 32 characters). Null generates one. Pass it only when moving an existing installation, or the stored tenant credentials cannot be decrypted."
  type        = string
  default     = null
  sensitive   = true
  validation {
    condition     = var.credentials_encryption_key == null || try(length(var.credentials_encryption_key) >= 32, false)
    error_message = "credentials_encryption_key must be at least 32 characters."
  }
}

variable "internal_api_key" {
  description = "INTERNAL_API_KEY shared by the three APIs for service-to-service calls (at least 32 characters). Null generates one."
  type        = string
  default     = null
  sensitive   = true
  validation {
    condition     = var.internal_api_key == null || length(coalesce(var.internal_api_key, "x")) >= 32
    error_message = "internal_api_key must be at least 32 characters."
  }
}

variable "provider_secrets" {
  description = "Platform provider keys to inject into the APIs, by environment variable name (e.g. AI_API_KEY, EVS_API_KEY, PLATFORM_STRIPE_SECRET_KEY). Only the keys present are injected. Values land in Terraform state: pass placeholders and replace them by hand to avoid that."
  type        = map(string)
  default     = {}
  sensitive   = true
  validation {
    condition = alltrue([for k in keys(var.provider_secrets) : contains([
      "AI_API_KEY", "EVS_API_KEY", "OPEN_EXCHANGE_RATES_API_KEY",
      "PLATFORM_STRIPE_SECRET_KEY", "PLATFORM_STRIPE_PUBLISHABLE_KEY", "PLATFORM_STRIPE_WEBHOOK_SECRET",
      "PLATFORM_RAZORPAY_KEY_ID", "PLATFORM_RAZORPAY_KEY_SECRET", "PLATFORM_RAZORPAY_WEBHOOK_SECRET",
      "AWS_SES_ACCESS_KEY", "AWS_SES_SECRET_KEY",
    ], k)])
    error_message = "provider_secrets keys must be provider environment variables the APIs read (see infra/terraform/modules/secrets/variables.tf for the list)."
  }
}
