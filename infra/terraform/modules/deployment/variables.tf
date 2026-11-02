# ─── Identity ────────────────────────────────────────────────────────────────

variable "name_prefix" {
  description = "Prefix for every resource name, e.g. \"lms-prod\". Lowercase letters, digits and hyphens."
  type        = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,23}$", var.name_prefix))
    error_message = "name_prefix must be 3-24 characters: lowercase letters, digits, hyphens, starting with a letter."
  }
}

variable "domain" {
  description = "Platform domain, e.g. \"lms.example.com\". Storefronts live at it and at <tenant>.<domain>; console., admin., api-console., api-admin., api. and assets. are taken by the platform."
  type        = string
}


variable "route53_zone_id" {
  description = "Route53 hosted zone serving the domain. Enables fully automatic certificates and DNS. Without it, pass certificate_arn and cdn_certificate_arn and publish the records from the outputs."
  type        = string
  default     = null
}

variable "certificate_arn" {
  description = "Existing regional ACM certificate covering <domain> and *.<domain> (the load balancer). Required when route53_zone_id is null."
  type        = string
  default     = null
}

variable "cdn_certificate_arn" {
  description = "Existing ACM certificate in us-east-1 covering assets.<domain> (the media CDN). Required when route53_zone_id is null."
  type        = string
  default     = null
  validation {
    condition     = var.route53_zone_id != null || (var.certificate_arn != null && var.cdn_certificate_arn != null)
    error_message = "Set route53_zone_id (automatic certificates and DNS), or both certificate_arn (regional) and cdn_certificate_arn (us-east-1)."
  }
}

variable "custom_domain_certificate_arns" {
  description = "Extra regional ACM certificates for tenants' custom domains, attached to the load balancer's HTTPS listener (picked by SNI). The storefront rule matches any host."
  type        = list(string)
  default     = []
}

variable "mail_domain" {
  description = "Platform sending domain verified in SES (defaults to domain). Mail goes out as no-reply@<mail_domain>."
  type        = string
  default     = null
}


variable "dmarc_policy" {
  description = "DMARC policy to publish for the mail domain (none, quarantine, reject), or null to leave DMARC alone."
  type        = string
  default     = "none"
}

variable "product_name" {
  description = "BRAND_NAME: the product name in emails, and the sender name (AWS_SES_FROM_NAME)."
  type        = string
  default     = "Open LMS Cloud"
}

variable "image_tag" {
  description = "Tag of the six images in ECR (make aws-deploy uses the git commit)."
  type        = string
}

# ─── Keys and providers ──────────────────────────────────────────────────────

variable "jwt_secret" {
  description = "JWT_SECRET (32+ characters). Null generates one. Set only when moving an existing installation."
  type        = string
  default     = null
  sensitive   = true
}

variable "credentials_encryption_key" {
  description = "CREDENTIALS_ENCRYPTION_KEY (32+ characters). Null generates one. Set only when moving an existing installation, or the stored tenant credentials cannot be decrypted."
  type        = string
  default     = null
  sensitive   = true
}

variable "internal_api_key" {
  description = "INTERNAL_API_KEY shared by the three APIs (32+ characters). Null generates one."
  type        = string
  default     = null
  sensitive   = true
}

variable "provider_secrets" {
  description = "Platform provider keys injected into the APIs by variable name (AI_API_KEY, EVS_API_KEY, PLATFORM_STRIPE_SECRET_KEY, PLATFORM_RAZORPAY_KEY_ID, ...). Values land in Terraform state: pass placeholders and replace <prefix>/providers by hand to avoid that."
  type        = map(string)
  default     = {}
  sensitive   = true
}


# ─── Network ─────────────────────────────────────────────────────────────────

variable "vpc_cidr" {
  description = "VPC CIDR."
  type        = string
  default     = "10.70.0.0/16"
}

variable "az_count" {
  description = "Availability zones (2 or 3)."
  type        = number
  default     = 2
}

variable "single_nat_gateway" {
  description = "One shared NAT gateway (cheaper) instead of one per AZ (resilient)."
  type        = bool
  default     = true
}

variable "enable_interface_endpoints" {
  description = "KMS and Secrets Manager interface endpoints (traffic stays off NAT)."
  type        = bool
  default     = false
}

variable "flow_log_retention_days" {
  description = "VPC flow log retention; 0 disables flow logs."
  type        = number
  default     = 30
}

# ─── Edge ────────────────────────────────────────────────────────────────────

variable "enable_waf" {
  description = "Associate a regional WAF web ACL with the load balancer."
  type        = bool
  default     = true
}


variable "alb_idle_timeout" {
  description = "Load balancer idle timeout in seconds: how long a connection may go without a byte in either direction."
  type        = number
  default     = 120
}

variable "alb_access_logs_bucket" {
  description = "Existing bucket for ALB access logs. Null disables them."
  type        = string
  default     = null
}

# ─── Data ────────────────────────────────────────────────────────────────────

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.medium"
}

variable "db_allocated_storage" {
  description = "Initial storage (GiB)."
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "Storage autoscaling ceiling (GiB)."
  type        = number
  default     = 100
}

variable "db_multi_az" {
  description = "Synchronous standby in a second AZ."
  type        = bool
  default     = false
}

variable "db_backup_retention_days" {
  description = "Automated backup (point-in-time recovery) retention."
  type        = number
  default     = 7
}

variable "db_monitoring_interval" {
  description = "Enhanced monitoring interval in seconds (0 disables)."
  type        = number
  default     = 60
}

variable "db_pool_max" {
  description = "PG_POOL_MAX: Postgres connections per cluster worker of an API task. Three APIs x tasks x vCPUs x this must stay below the instance's max_connections."
  type        = number
  default     = 8
}

variable "cache_node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.t4g.small"
}

variable "cache_node_count" {
  description = "Redis nodes: 1, or 2+ for a replica in another AZ with automatic failover."
  type        = number
  default     = 1
}

variable "cache_snapshot_retention_days" {
  description = "Daily Redis snapshots kept."
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Protect the database and load balancer from deletion, keep a final snapshot, refuse to delete non-empty repositories and the assets bucket."
  type        = bool
  default     = true
}

variable "kms_deletion_window_days" {
  description = "Waiting period before a scheduled KMS key deletion completes."
  type        = number
  default     = 30
}

variable "kms_admin_principal_arns" {
  description = "IAM principals allowed to administer the KMS key."
  type        = list(string)
  default     = []
}

variable "secret_recovery_window_days" {
  description = "Recovery window for deleted secrets."
  type        = number
  default     = 30
}

variable "storage_noncurrent_version_days" {
  description = "Days an overwritten or deleted object version is kept in the assets bucket."
  type        = number
  default     = 30
}

# ─── Application ─────────────────────────────────────────────────────────────

variable "evs_api_url" {
  description = "EVS_API_URL: base URL of the video system (playback sessions). Its key goes in provider_secrets as EVS_API_KEY."
  type        = string
  default     = ""
}

variable "ai_provider" {
  description = "AI_PROVIDER for AI authoring: offline (deterministic, no key) or openai (any OpenAI-compatible API; AI_API_KEY in provider_secrets)."
  type        = string
  default     = "offline"
  validation {
    condition     = contains(["offline", "openai"], var.ai_provider)
    error_message = "ai_provider must be offline or openai."
  }
}

variable "ai_base_url" {
  description = "AI_BASE_URL of the OpenAI-compatible API."
  type        = string
  default     = "https://api.openai.com/v1"
}

variable "ai_text_model" {
  description = "AI_TEXT_MODEL. Empty uses the API's default."
  type        = string
  default     = ""
}

variable "ai_image_model" {
  description = "AI_IMAGE_MODEL. Empty turns image generation off."
  type        = string
  default     = ""
}

variable "log_level" {
  description = "API LOG_LEVEL."
  type        = string
  default     = "info"
}

variable "cpu_architecture" {
  description = "CPU architecture of every task: X86_64 (default) or ARM64 (Graviton, about 20% cheaper per vCPU). ARM64 needs images built for linux/arm64: deploy with PLATFORM=linux/arm64 make aws-deploy (scripts/aws-deploy.sh), or the tasks fail to start with an exec format error."
  type        = string
  default     = "X86_64"
  validation {
    condition     = contains(["X86_64", "ARM64"], var.cpu_architecture)
    error_message = "cpu_architecture must be X86_64 or ARM64."
  }
}

variable "api_cpu" {
  description = "CPU units of each API task (console-api, admin-api, learner-api). The node cluster forks one worker per vCPU."
  type        = number
  default     = 1024
}

variable "api_memory" {
  description = "API task memory (MiB)."
  type        = number
  default     = 2048
}

variable "api_min_count" {
  description = "Minimum tasks per API."
  type        = number
  default     = 2
}

variable "api_max_count" {
  description = "Maximum tasks per API."
  type        = number
  default     = 6
}

variable "web_cpu" {
  description = "CPU units of each Next.js task (console, admin, web)."
  type        = number
  default     = 512
}

variable "web_memory" {
  description = "Memory (MiB) of each Next.js task."
  type        = number
  default     = 1024
}

variable "web_min_count" {
  description = "Minimum tasks per Next.js service."
  type        = number
  default     = 2
}

variable "web_max_count" {
  description = "Maximum tasks per Next.js service."
  type        = number
  default     = 6
}

variable "api_extra_environment" {
  description = "Extra environment variables for the three APIs, e.g. EMAIL_ACCOUNT_TPS. Never put secrets here."
  type        = map(string)
  default     = {}
}

variable "api_extra_secrets" {
  description = "Extra API secrets as ECS secret references, e.g. [{ name = \"SOME_KEY\", valueFrom = \"<secret arn>:SOME_KEY::\" }]. The execution role is granted read access to each one."
  type        = list(object({ name = string, valueFrom = string }))
  default     = []
}

variable "log_retention_days" {
  description = "CloudWatch log retention."
  type        = number
  default     = 30
}

variable "alarm_email" {
  description = "Address that receives alarm notifications."
  type        = string
  default     = null
}
