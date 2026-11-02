output "https_listener_arn" {
  description = "Shared HTTPS listener the services attach their rules to."
  value       = aws_lb_listener.https.arn
}

output "security_group_id" {
  description = "Load balancer security group."
  value       = aws_security_group.alb.id
}

output "dns_name" {
  description = "Load balancer DNS name (CNAME target for every host when the zone is not in Route53)."
  value       = aws_lb.this.dns_name
}

output "zone_id" {
  description = "Load balancer hosted zone id (for alias records)."
  value       = aws_lb.this.zone_id
}

output "arn_suffix" {
  description = "For CloudWatch metrics."
  value       = aws_lb.this.arn_suffix
}

output "certificate_validation_records" {
  description = "Records to publish by hand when the zone is not in Route53."
  value = var.certificate_arn == null ? [
    for o in aws_acm_certificate.this[0].domain_validation_options : { name = o.resource_record_name, type = o.resource_record_type, value = o.resource_record_value }
  ] : []
}

output "arn" {
  description = "Load balancer ARN (the regional WAF association)."
  value       = aws_lb.this.arn
}
