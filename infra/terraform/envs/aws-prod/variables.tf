variable "region" {
  description = "AWS region."
  type        = string
}

variable "environment" {
  description = "Environment tag."
  type        = string
  default     = "prod"
}

variable "extra_tags" {
  description = "Tags added to every resource."
  type        = map(string)
  default     = {}
}

variable "name_prefix" {
  description = "Prefix for every resource name, 3-24 lowercase characters (e.g. \"lms-prod\")."
  type        = string
}

variable "domain" {
  description = "Platform domain, e.g. lms.example.com: storefronts at it and <tenant>.<domain>; console., admin., api-console., api-admin., api. and assets. are the platform's."
  type        = string
}


variable "route53_zone_id" {
  description = "Hosted zone for the domain (automatic certificates and DNS)."
  type        = string
  default     = null
}

variable "certificate_arn" {
  description = "Existing regional certificate for <domain> and *.<domain>, when the zone is not in Route53."
  type        = string
  default     = null
}

variable "cdn_certificate_arn" {
  description = "Existing us-east-1 certificate for assets.<domain>, when the zone is not in Route53."
  type        = string
  default     = null
}

variable "custom_domain_certificate_arns" {
  description = "Regional ACM certificates for tenants' custom domains (attached to the load balancer)."
  type        = list(string)
  default     = []
}

variable "mail_domain" {
  description = "SES sending domain (defaults to domain)."
  type        = string
  default     = null
}


variable "image_tag" {
  description = "Image tag to deploy (make aws-deploy passes the git commit)."
  type        = string
}

variable "product_name" {
  description = "BRAND_NAME shown in emails and as the sender name."
  type        = string
  default     = "Open LMS Cloud"
}

variable "alarm_email" {
  description = "Alarm notification address."
  type        = string
  default     = null
}

variable "provider_secrets" {
  description = "Platform provider keys by variable name (AI_API_KEY, EVS_API_KEY, PLATFORM_STRIPE_SECRET_KEY, ...), stored in <name_prefix>/providers and in state. Prefer placeholders replaced by hand."
  type        = map(string)
  default     = {}
  sensitive   = true
}


variable "api_extra_environment" {
  description = "Extra environment for the three APIs. Never secrets."
  type        = map(string)
  default     = {}
}

variable "api_extra_secrets" {
  description = "Extra ECS secrets for the three APIs, e.g. [{ name = \"SOME_KEY\", valueFrom = \"<secret arn>:SOME_KEY::\" }]."
  type        = list(object({ name = string, valueFrom = string }))
  default     = []
}

variable "evs_api_url" {
  description = "EVS_API_URL of the video system (EVS_API_KEY goes in provider_secrets)."
  type        = string
  default     = ""
}

variable "ai_provider" {
  description = "AI_PROVIDER: offline (deterministic, no key) or openai (AI_API_KEY in provider_secrets)."
  type        = string
  default     = "offline"
}

variable "ai_base_url" {
  description = "AI_BASE_URL of the OpenAI-compatible API."
  type        = string
  default     = "https://api.openai.com/v1"
}

variable "ai_text_model" {
  description = "AI_TEXT_MODEL (empty: the API default)."
  type        = string
  default     = ""
}

variable "ai_image_model" {
  description = "AI_IMAGE_MODEL (empty: image generation off)."
  type        = string
  default     = ""
}

variable "db_instance_class" {
  description = "RDS instance class."
  type        = string
  default     = "db.t4g.medium"
}

variable "cache_node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.m7g.large"
}

variable "cpu_architecture" {
  description = "X86_64 or ARM64 (Graviton). ARM64 needs linux/arm64 images: PLATFORM=linux/arm64 make aws-deploy."
  type        = string
  default     = "X86_64"
}

variable "log_level" {
  description = "API LOG_LEVEL."
  type        = string
  default     = "info"
}
