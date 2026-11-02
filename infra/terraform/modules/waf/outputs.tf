output "web_acl_arn" {
  description = "Web ACL ARN (associated with the load balancer)."
  value       = aws_wafv2_web_acl.this.arn
}
