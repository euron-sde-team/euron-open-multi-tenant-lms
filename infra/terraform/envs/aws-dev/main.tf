# ─────────────────────────────────────────────────────────────────────────────
# aws-dev: a full, cheaper copy of production. Two AZs with a single NAT, single-AZ
# database, one Redis node, one task per service, no deletion protection, WAF on.
#
# Everything is in ../../modules/deployment; this file only picks the sizes.
#   make aws-deploy ENV=aws-dev
# ─────────────────────────────────────────────────────────────────────────────
module "app" {
  source    = "../../modules/deployment"
  providers = { aws = aws, aws.us_east_1 = aws.us_east_1 }

  name_prefix                    = var.name_prefix
  domain                         = var.domain
  route53_zone_id                = var.route53_zone_id
  certificate_arn                = var.certificate_arn
  cdn_certificate_arn            = var.cdn_certificate_arn
  custom_domain_certificate_arns = var.custom_domain_certificate_arns
  mail_domain                    = var.mail_domain
  product_name                   = var.product_name
  image_tag                      = var.image_tag

  # Platform provider keys (AI_API_KEY, EVS_API_KEY, PLATFORM_* billing keys). Empty
  # leaves <name_prefix>/providers uncreated and AI authoring offline.
  provider_secrets = var.provider_secrets
  evs_api_url      = var.evs_api_url
  ai_provider      = var.ai_provider
  ai_base_url      = var.ai_base_url
  ai_text_model    = var.ai_text_model
  ai_image_model   = var.ai_image_model

  log_level = var.log_level
  # Anything else the APIs read, as plain environment or ECS secret references.
  api_extra_secrets     = var.api_extra_secrets
  api_extra_environment = var.api_extra_environment

  az_count                   = 2
  single_nat_gateway         = true
  enable_interface_endpoints = false

  enable_waf = true

  db_instance_class        = var.db_instance_class
  db_multi_az              = false
  db_backup_retention_days = 3
  deletion_protection      = false

  cache_node_type               = var.cache_node_type
  cache_node_count              = 1
  cache_snapshot_retention_days = 1

  kms_deletion_window_days    = 7
  secret_recovery_window_days = 0

  cpu_architecture = var.cpu_architecture

  api_cpu       = 512
  api_memory    = 1024
  api_min_count = 1
  api_max_count = 2

  web_cpu       = 256
  web_memory    = 512
  web_min_count = 1
  web_max_count = 2

  log_retention_days      = 14
  flow_log_retention_days = 14
  alarm_email             = var.alarm_email
}
