output "urls" {
  description = "Public URLs of console, admin, the storefront apex, the three APIs and the media CDN."
  value       = module.app.urls
}

output "frontends" {
  description = "Per Next.js app: URL and NEXT_PUBLIC_API_BASE_URL (scripts/aws-deploy.sh)."
  value       = module.app.frontends
}

output "root_domain" {
  description = "Storefronts are <tenant>.<root_domain>."
  value       = module.app.root_domain
}

output "cluster_name" {
  description = "ECS cluster."
  value       = module.app.cluster_name
}

output "services" {
  description = "ECS service names, by app."
  value       = module.app.services
}

output "ecr_repositories" {
  description = "Image repositories, by app."
  value       = module.app.ecr_repositories
}

output "migrate_task_definition_arn" {
  description = "One-off migration task definition."
  value       = module.app.migrate_task_definition_arn
}

output "run_task" {
  description = "Parameters for the one-off tasks (scripts/aws-run-task.sh)."
  value       = module.app.run_task
}

output "assets_bucket" {
  description = "AWS_S3_BUCKET."
  value       = module.app.assets_bucket
}

output "media_url" {
  description = "AWS_S3_PUBLIC_BASE_URL."
  value       = module.app.media_url
}

output "redis_endpoint" {
  description = "Redis primary endpoint."
  value       = module.app.redis_endpoint
}

output "mail_configuration_set" {
  description = "SES configuration set."
  value       = module.app.mail_configuration_set
}

output "mail_from" {
  description = "AWS_SES_FROM_EMAIL."
  value       = module.app.mail_from
}

output "ses_queues" {
  description = "SES topic and queue settings of the APIs."
  value       = module.app.ses_queues
}

output "load_balancer_dns_name" {
  description = "CNAME target of the domain, its wildcard and custom domains."
  value       = module.app.load_balancer_dns_name
}

output "certificate_validation_records" {
  description = "Publish by hand when the zone is not in Route53."
  value       = module.app.certificate_validation_records
}

output "dns_records" {
  description = "Publish by hand when the zone is not in Route53."
  value       = module.app.dns_records
}

output "mail_dns_records" {
  description = "Publish by hand when the zone is not in Route53."
  value       = module.app.mail_dns_records
}

output "providers_secret_name" {
  description = "Secret holding the platform provider keys (null when none was passed)."
  value       = module.app.providers_secret_name
}
