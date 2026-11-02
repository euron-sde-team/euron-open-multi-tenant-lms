# ─────────────────────────────────────────────────────────────────────────────
# One complete deployment of the three-tier LMS: network, data, cache, keys, mail, the
# assets bucket with its media CDN, and six ECS Fargate services behind one load
# balancer, routed by host:
#
#   https://console.<domain>       console       operator console (Next.js server)
#   https://api-console.<domain>   console-api   operator plane API
#   https://admin.<domain>         admin         tenant admin (Next.js server)
#   https://api-admin.<domain>     admin-api     tenant admin API
#   https://api.<domain>           learner-api   learner API (tenant from X-Tenant-Host)
#   https://<domain>, https://<tenant>.<domain>, tenants' custom domains
#                                  web           the storefronts (SSR tenant theming)
#   https://assets.<domain>        media CDN     public media from the assets bucket
#
# Each API task runs a node cluster; background jobs (BullMQ on ElastiCache) run inside
# the API tasks, so there is no separate worker service. A one-off task definition on
# the console-api image applies the SQL migrations (make aws-migrate; aws-deploy runs
# it before rolling the services) and runs the operator bootstrap.
#
# NEXT_PUBLIC_* values are compiled into the Next.js images, so scripts/aws-deploy.sh
# builds each one from the `frontends` output of this module.
#
# envs/aws-dev and envs/aws-prod call this module with different sizes and safety
# switches; everything else is identical by construction.
# ─────────────────────────────────────────────────────────────────────────────
data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  region     = data.aws_region.current.region
  account_id = data.aws_caller_identity.current.account_id

  hosts = {
    console     = "console.${var.domain}"
    admin       = "admin.${var.domain}"
    console_api = "api-console.${var.domain}"
    admin_api   = "api-admin.${var.domain}"
    learner_api = "api.${var.domain}"
    assets      = "assets.${var.domain}"
  }
  urls = { for k, h in local.hosts : k => "https://${h}" }
  # A storefront at the apex and at every <tenant>.<domain>.
  web_url = "https://${var.domain}"

  mail_domain = coalesce(var.mail_domain, var.domain)
  images      = { for r in local.repositories : r => "${module.ecr.repository_urls[r]}:${var.image_tag}" }

  repositories = ["console-api", "admin-api", "learner-api", "console", "admin", "web"]
  api_ports    = { "console-api" = 5076, "admin-api" = 5086, "learner-api" = 5096 }
  web_ports    = { console = 3600, admin = 3610, web = 3620 }

  # The RDS CA bundle baked into the API images (infra/docker/api.Dockerfile): with it,
  # PGSSLMODE=verify-full verifies the database certificate and host name.
  db_tls_environment = {
    PGSSLMODE           = "verify-full"
    NODE_EXTRA_CA_CERTS = "/app/certs/rds-global-bundle.pem"
  }

  # Per Next.js app: the browser API base and the public URL (aws-deploy.sh builds with these).
  frontends = {
    console = { url = local.urls.console, api_base_url = "${local.urls.console_api}/api/v1" }
    admin   = { url = local.urls.admin, api_base_url = "${local.urls.admin_api}/api/v1" }
    web     = { url = local.web_url, api_base_url = "${local.urls.learner_api}/api/v1" }
  }
}

# ─── Foundation ──────────────────────────────────────────────────────────────

module "network" {
  source                     = "../network"
  name_prefix                = var.name_prefix
  cidr_block                 = var.vpc_cidr
  az_count                   = var.az_count
  single_nat_gateway         = var.single_nat_gateway
  enable_interface_endpoints = var.enable_interface_endpoints
  flow_log_retention_days    = var.flow_log_retention_days
  logs_kms_key_arn           = module.kms.key_arn
}

module "kms" {
  source                   = "../kms"
  name_prefix              = var.name_prefix
  deletion_window_in_days  = var.kms_deletion_window_days
  admin_principal_arns     = var.kms_admin_principal_arns
  allow_cloudfront_decrypt = true
}

module "secrets" {
  source                     = "../secrets"
  name_prefix                = var.name_prefix
  kms_key_arn                = module.kms.key_arn
  recovery_window_in_days    = var.secret_recovery_window_days
  jwt_secret                 = var.jwt_secret
  credentials_encryption_key = var.credentials_encryption_key
  internal_api_key           = var.internal_api_key
  provider_secrets           = var.provider_secrets
}

module "database" {
  source                      = "../database"
  name_prefix                 = var.name_prefix
  vpc_id                      = module.network.vpc_id
  subnet_ids                  = module.network.private_subnet_ids
  kms_key_arn                 = module.kms.key_arn
  instance_class              = var.db_instance_class
  allocated_storage           = var.db_allocated_storage
  max_allocated_storage       = var.db_max_allocated_storage
  multi_az                    = var.db_multi_az
  backup_retention_days       = var.db_backup_retention_days
  deletion_protection         = var.deletion_protection
  skip_final_snapshot         = !var.deletion_protection
  monitoring_interval         = var.db_monitoring_interval
  secret_recovery_window_days = var.secret_recovery_window_days
}

module "cache" {
  source                      = "../cache"
  name_prefix                 = var.name_prefix
  vpc_id                      = module.network.vpc_id
  subnet_ids                  = module.network.private_subnet_ids
  kms_key_arn                 = module.kms.key_arn
  node_type                   = var.cache_node_type
  node_count                  = var.cache_node_count
  snapshot_retention_days     = var.cache_snapshot_retention_days
  log_retention_days          = var.log_retention_days
  secret_recovery_window_days = var.secret_recovery_window_days
  alarm_topic_arn             = module.observability.alarm_topic_arn
}

module "email" {
  source          = "../email"
  name_prefix     = var.name_prefix
  domain          = local.mail_domain
  manage_dns      = var.route53_zone_id != null
  route53_zone_id = var.route53_zone_id
  dmarc_policy    = var.dmarc_policy
  kms_key_arn     = module.kms.key_arn
  inbound_domain  = null
}

module "storage" {
  source                      = "../storage"
  bucket_name                 = "${var.name_prefix}-assets-${local.account_id}"
  kms_key_arn                 = module.kms.key_arn
  cors_origins                = [local.urls.console, local.urls.admin, local.web_url, "https://*.${var.domain}"]
  noncurrent_version_days     = var.storage_noncurrent_version_days
  force_destroy               = !var.deletion_protection
  public_read_prefix          = "public/"
  allow_cdn_read              = true
  cloudfront_distribution_arn = module.media.distribution_arn
}

module "media" {
  source                      = "../cdn"
  providers                   = { aws = aws, aws.us_east_1 = aws.us_east_1 }
  name_prefix                 = var.name_prefix
  hostname                    = local.hosts.assets
  bucket_regional_domain_name = module.storage.bucket_regional_domain_name
  route53_zone_id             = var.route53_zone_id
  certificate_arn             = var.cdn_certificate_arn
}

module "ecr" {
  source       = "../ecr"
  name_prefix  = var.name_prefix
  repositories = local.repositories
  kms_key_arn  = module.kms.key_arn
  force_delete = !var.deletion_protection
}

# ─── Edge ────────────────────────────────────────────────────────────────────

module "edge" {
  source            = "../edge"
  name_prefix       = var.name_prefix
  vpc_id            = module.network.vpc_id
  public_subnet_ids = module.network.public_subnet_ids
  certificate_names = [var.domain, "*.${var.domain}"]
  # The wildcard covers console., admin., api*. and every tenant subdomain.
  dns_names              = { apex = var.domain, wildcard = "*.${var.domain}" }
  route53_zone_id        = var.route53_zone_id
  certificate_arn        = var.certificate_arn
  extra_certificate_arns = var.custom_domain_certificate_arns
  access_logs_bucket     = var.alb_access_logs_bucket
  deletion_protection    = var.deletion_protection
  idle_timeout           = var.alb_idle_timeout
}

module "waf" {
  count             = var.enable_waf ? 1 : 0
  source            = "../waf"
  name_prefix       = var.name_prefix
  load_balancer_arn = module.edge.arn
}

resource "aws_ecs_cluster" "this" {
  name = var.name_prefix
  setting {
    name  = "containerInsights"
    value = "enhanced"
  }
}

# ─── API environment, secrets, permissions ───────────────────────────────────

locals {
  # Database connection, shared by the APIs and the migrate task. The password comes
  # from <prefix>/database as an ECS secret.
  db_environment = merge(local.db_tls_environment, {
    PG_DATABASE_HOST = module.database.address
    PG_DATABASE_PORT = tostring(module.database.port)
    PG_DATABASE_USER = module.database.master_username
    PG_DATABASE      = module.database.database_name
  })

  # Everything except secrets, the same for the three APIs (each adds its PORT).
  api_environment = merge(local.db_environment, {
    NODE_ENV                 = "production"
    TZ                       = "UTC"
    LOG_LEVEL                = var.log_level
    BRAND_NAME               = var.product_name
    ROOT_DOMAIN              = var.domain
    CONSOLE_URL              = local.urls.console
    ADMIN_URL                = local.urls.admin
    WEB_URL                  = local.web_url
    CONSOLE_API_PUBLIC_URL   = local.urls.console_api
    ADMIN_API_PUBLIC_URL     = local.urls.admin_api
    LEARNER_API_PUBLIC_URL   = local.urls.learner_api
    CONSOLE_API_INTERNAL_URL = local.urls.console_api
    ADMIN_API_INTERNAL_URL   = local.urls.admin_api
    LEARNER_API_INTERNAL_URL = local.urls.learner_api
    CORS_ORIGINS             = "${local.urls.console},${local.urls.admin}"
    # One proxy hop in front of the APIs: the load balancer.
    TRUST_PROXY            = "1"
    PG_POOL_MAX            = tostring(var.db_pool_max)
    AWS_REGION             = local.region
    AWS_S3_BUCKET          = module.storage.bucket_name
    AWS_S3_PUBLIC_BASE_URL = module.media.url
    LOCAL_STORAGE_DIR      = "/tmp/local-storage"
    AWS_SES_REGION         = local.region
    AWS_SES_FROM_EMAIL     = module.email.from_address
    AWS_SES_FROM_NAME      = var.product_name
    SES_EVENTS_QUEUE_URL   = module.email.events_queue_url
    STRIPE_API_BASE        = "https://api.stripe.com"
    RAZORPAY_API_BASE      = "https://api.razorpay.com"
    EVS_API_URL            = var.evs_api_url
    AI_PROVIDER            = var.ai_provider
    AI_BASE_URL            = var.ai_base_url
    AI_TEXT_MODEL          = var.ai_text_model
    AI_IMAGE_MODEL         = var.ai_image_model
  }, var.api_extra_environment)

  # JWT_SECRET, CREDENTIALS_ENCRYPTION_KEY, INTERNAL_API_KEY, provider keys,
  # PG_DATABASE_PASSWORD, REDIS_URL.
  api_secrets = concat(module.secrets.secret_refs, module.database.secret_refs, module.cache.secret_refs, var.api_extra_secrets)

  # The migrate task needs the database and nothing else.
  migrate_environment = merge(local.db_environment, {
    NODE_ENV = "production"
    TZ       = "UTC"
  })

  api_health_path = "/api/v1/health"

  ses_identity_arn      = "arn:aws:ses:${local.region}:${local.account_id}:identity/*"
  ses_configuration_arn = "arn:aws:ses:${local.region}:${local.account_id}:configuration-set/*"

  # Host rules, in listener priority order: the dedicated hosts first, the storefront
  # catch-all last.
  api_routes = {
    "console-api" = { hosts = [local.hosts.console_api], priority = 120 }
    "admin-api"   = { hosts = [local.hosts.admin_api], priority = 130 }
    "learner-api" = { hosts = [local.hosts.learner_api], priority = 140 }
  }
  web_routes = {
    console = { hosts = [local.hosts.console], paths = [], priority = 100 }
    admin   = { hosts = [local.hosts.admin], paths = [], priority = 110 }
    web     = { hosts = [], paths = ["/*"], priority = 900 }
  }
}

# What the APIs do at runtime: objects in the assets bucket, mail through SES (the
# platform identity plus per-tenant sending domains, each with its configuration set),
# and the SES events queue. Nothing else; the injected secrets are read by the
# execution role, not this one.
data "aws_iam_policy_document" "api" {
  source_policy_documents = [module.storage.access_policy_json]

  statement {
    sid       = "SendMail"
    actions   = ["ses:SendEmail", "ses:SendRawEmail"]
    resources = [local.ses_identity_arn, local.ses_configuration_arn]
  }
  statement {
    sid = "TenantSendingDomains"
    actions = [
      "ses:CreateEmailIdentity", "ses:DeleteEmailIdentity", "ses:GetEmailIdentity",
      "ses:PutEmailIdentityMailFromAttributes", "ses:TagResource",
    ]
    resources = [local.ses_identity_arn, local.ses_configuration_arn]
  }
  statement {
    sid       = "TenantConfigurationSets"
    actions   = ["ses:CreateConfigurationSet", "ses:CreateConfigurationSetEventDestination", "ses:GetConfigurationSet"]
    resources = [local.ses_configuration_arn]
  }
  statement {
    sid       = "SesQueues"
    actions   = ["sqs:ReceiveMessage", "sqs:DeleteMessage", "sqs:ChangeMessageVisibility", "sqs:GetQueueAttributes"]
    resources = module.email.queue_arns
  }
}

# ─── Services ────────────────────────────────────────────────────────────────

module "api" {
  for_each                 = local.api_routes
  source                   = "../service"
  name_prefix              = var.name_prefix
  name                     = each.key
  image                    = local.images[each.key]
  command                  = ["node", "--enable-source-maps", "dist/index.js"]
  container_port           = local.api_ports[each.key]
  environment              = merge(local.api_environment, { PORT = tostring(local.api_ports[each.key]) })
  secrets                  = local.api_secrets
  cluster_arn              = aws_ecs_cluster.this.arn
  vpc_id                   = module.network.vpc_id
  subnet_ids               = module.network.private_subnet_ids
  listener_arn             = module.edge.https_listener_arn
  lb_security_group_id     = module.edge.security_group_id
  listener_priority        = each.value.priority
  host_headers             = each.value.hosts
  deregistration_delay     = 60
  health_check_path        = local.api_health_path
  container_health_command = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:${local.api_ports[each.key]}${local.api_health_path}').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\""]
  connect_to_database      = true
  db_security_group_id     = module.database.security_group_id
  db_port                  = module.database.port
  connect_to_cache         = true
  cache_security_group_id  = module.cache.security_group_id
  cache_port               = module.cache.port
  kms_key_arn              = module.kms.key_arn
  has_task_policy          = true
  task_policy_json         = data.aws_iam_policy_document.api.json
  cpu                      = var.api_cpu
  cpu_architecture         = var.cpu_architecture
  memory                   = var.api_memory
  min_count                = var.api_min_count
  max_count                = var.api_max_count
  log_retention_days       = var.log_retention_days
  logs_kms_key_arn         = module.kms.key_arn
}

module "web" {
  for_each             = local.web_routes
  source               = "../service"
  name_prefix          = var.name_prefix
  name                 = each.key
  image                = local.images[each.key]
  command              = ["/app/start.sh"]
  container_port       = local.web_ports[each.key]
  cluster_arn          = aws_ecs_cluster.this.arn
  vpc_id               = module.network.vpc_id
  subnet_ids           = module.network.private_subnet_ids
  listener_arn         = module.edge.https_listener_arn
  lb_security_group_id = module.edge.security_group_id
  listener_priority    = each.value.priority
  host_headers         = each.value.hosts
  path_patterns        = each.value.paths
  deregistration_delay = 30
  health_check_path    = "/"
  environment = {
    NODE_ENV    = "production"
    TZ          = "UTC"
    PORT        = tostring(local.web_ports[each.key])
    HOSTNAME    = "0.0.0.0"
    ROOT_DOMAIN = var.domain
    # Server-side rendering reaches the learner API through the load balancer.
    API_INTERNAL_BASE_URL = "${local.urls.learner_api}/api/v1"
  }
  writable_paths           = ["/app/apps/${each.key}/.next/cache"]
  container_health_command = ["CMD-SHELL", "node -e \"fetch('http://127.0.0.1:${local.web_ports[each.key]}/',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))\""]
  kms_key_arn              = module.kms.key_arn
  cpu                      = var.web_cpu
  cpu_architecture         = var.cpu_architecture
  memory                   = var.web_memory
  min_count                = var.web_min_count
  max_count                = var.web_max_count
  log_retention_days       = var.log_retention_days
  logs_kms_key_arn         = module.kms.key_arn
}

# ─── One-off task (make aws-migrate, make aws-operator) ──────────────────────

module "migrate" {
  source               = "../service"
  name_prefix          = var.name_prefix
  name                 = "migrate"
  image                = local.images["console-api"]
  command              = ["node", "db/migrate.js"]
  environment          = local.migrate_environment
  secrets              = concat(module.database.secret_refs, module.secrets.secret_refs)
  create_service       = false
  cluster_arn          = aws_ecs_cluster.this.arn
  vpc_id               = module.network.vpc_id
  subnet_ids           = module.network.private_subnet_ids
  connect_to_database  = true
  db_security_group_id = module.database.security_group_id
  db_port              = module.database.port
  kms_key_arn          = module.kms.key_arn
  cpu                  = 256
  cpu_architecture     = var.cpu_architecture
  memory               = 512
  log_retention_days   = var.log_retention_days
  logs_kms_key_arn     = module.kms.key_arn
}

# ─── Observability ───────────────────────────────────────────────────────────

module "observability" {
  source                  = "../observability"
  name_prefix             = var.name_prefix
  alarm_email             = var.alarm_email
  alb_arn_suffix          = module.edge.arn_suffix
  ecs_cluster_name        = aws_ecs_cluster.this.name
  db_instance_identifier  = module.database.instance_identifier
  jobs_log_group_name     = module.api["admin-api"].log_group_name
  dead_letter_queue_names = module.email.dead_letter_queue_names
  services = merge(
    { for k, m in module.api : k => { service_name = m.service_name, load_balanced = true, target_group_arn_suffix = m.target_group_arn_suffix } },
    { for k, m in module.web : k => { service_name = m.service_name, load_balanced = true, target_group_arn_suffix = m.target_group_arn_suffix } },
  )
}
