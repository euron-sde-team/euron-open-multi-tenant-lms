output "urls" {
  description = "Public URLs: console, admin, the storefront apex, the three APIs and the media CDN."
  value       = merge(local.urls, { web = local.web_url })
}

output "frontends" {
  description = "Per Next.js app: its URL and the NEXT_PUBLIC_API_BASE_URL it is built with (scripts/aws-deploy.sh)."
  value       = local.frontends
}

output "root_domain" {
  description = "NEXT_PUBLIC_ROOT_DOMAIN / ROOT_DOMAIN: storefronts are <tenant>.<root_domain>."
  value       = var.domain
}

output "cluster_name" {
  description = "ECS cluster."
  value       = aws_ecs_cluster.this.name
}

output "services" {
  description = "ECS service names, by app."
  value = merge(
    { for k, m in module.api : k => m.service_name },
    { for k, m in module.web : k => m.service_name },
  )
}

output "ecr_repositories" {
  description = "Image repositories, by app (console-api also runs the migrate task)."
  value       = module.ecr.repository_urls
}

output "migrate_task_definition_arn" {
  description = "Task definition of the one-off migration task."
  value       = module.migrate.task_definition_arn
}

output "run_task" {
  description = "Everything `aws ecs run-task` needs for the one-off tasks (scripts/aws-run-task.sh)."
  value = {
    cluster = aws_ecs_cluster.this.name
    subnets = module.network.private_subnet_ids
    tasks = {
      migrate = { task_definition = module.migrate.task_definition_family, container = "migrate", security_groups = [module.migrate.security_group_id] }
    }
  }
}

output "assets_bucket" {
  description = "AWS_S3_BUCKET: the assets bucket (public media under public/)."
  value       = module.storage.bucket_name
}

output "media_url" {
  description = "AWS_S3_PUBLIC_BASE_URL: the media CDN in front of the public/ prefix."
  value       = module.media.url
}

output "redis_endpoint" {
  description = "Redis primary endpoint (the full REDIS_URL is in Secrets Manager)."
  value       = "${module.cache.primary_endpoint}:${module.cache.port}"
}

output "mail_configuration_set" {
  description = "SES configuration set of the platform identity."
  value       = module.email.configuration_set
}

output "mail_from" {
  description = "AWS_SES_FROM_EMAIL."
  value       = module.email.from_address
}

output "ses_queues" {
  description = "SES_EVENTS_SNS_TOPIC_ARN and SES_EVENTS_QUEUE_URL as configured on the APIs."
  value = {
    SES_EVENTS_SNS_TOPIC_ARN = module.email.events_topic_arn
    SES_EVENTS_QUEUE_URL     = module.email.events_queue_url
  }
}

output "load_balancer_dns_name" {
  description = "Load balancer DNS name: the CNAME target of <domain>, *.<domain> and tenants' custom domains."
  value       = module.edge.dns_name
}

output "certificate_validation_records" {
  description = "Load balancer and media CDN certificate records to publish by hand when the zone is not in Route53."
  value       = concat(module.edge.certificate_validation_records, module.media.certificate_validation_records)
}

output "dns_records" {
  description = "Records to publish by hand when the zone is not in Route53."
  value = [
    { type = "CNAME", name = var.domain, value = module.edge.dns_name },
    { type = "CNAME", name = "*.${var.domain}", value = module.edge.dns_name },
    { type = "CNAME", name = local.hosts.assets, value = module.media.domain_name },
  ]
}

output "mail_dns_records" {
  description = "SES DKIM and MAIL FROM records to publish by hand when the zone is not in Route53."
  value       = module.email.dns_records
}

output "alarm_topic_arn" {
  description = "SNS topic receiving every alarm."
  value       = module.observability.alarm_topic_arn
}

output "providers_secret_name" {
  description = "Secrets Manager name holding the platform provider keys, or null when none was passed."
  value       = module.secrets.providers_secret_name
}
