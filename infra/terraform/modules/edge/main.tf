# The public entry point: one Application Load Balancer for all six services, routed by
# host (the service module adds one listener rule per service):
#
#   console.<domain>        operator console        api-console.<domain>  console-api
#   admin.<domain>          tenant admin            api-admin.<domain>    admin-api
#   api.<domain>            learner-api (tenant from X-Tenant-Host or Origin)
#   <domain>, *.<domain>,   web, the tenant storefronts (the lowest-priority rule
#   custom domains          matches any host)
#
# TLS: one certificate for <domain> and *.<domain> (DNS-validated when the zone is in
# Route53), plus any number of extra certificates for tenants' custom domains
# (extra_certificate_arns, attached to the same listener; the ALB picks one by SNI).
#
# idle_timeout bounds how long a connection may go without a byte in either direction
# (AI authoring calls and CSV exports can take a while).
locals {
  manage_dns = var.route53_zone_id != null
  # ACM returns one validation record per name; *.<domain> and <domain> share it, so
  # only names whose wildcard twin is absent get their own record resource.
  validation_names = [
    for n in var.certificate_names : n
    if !(startswith(n, "*.") && contains(var.certificate_names, trimprefix(n, "*.")))
  ]
}

# ─── Certificate ─────────────────────────────────────────────────────────────

resource "aws_acm_certificate" "this" {
  count                     = var.certificate_arn == null ? 1 : 0
  domain_name               = var.certificate_names[0]
  subject_alternative_names = slice(var.certificate_names, 1, length(var.certificate_names))
  validation_method         = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "validation" {
  for_each = var.certificate_arn == null && local.manage_dns ? {
    for o in aws_acm_certificate.this[0].domain_validation_options : o.domain_name => o
    if contains(local.validation_names, o.domain_name)
  } : {}
  zone_id         = var.route53_zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  count                   = var.certificate_arn == null && local.manage_dns ? 1 : 0
  certificate_arn         = aws_acm_certificate.this[0].arn
  validation_record_fqdns = [for r in aws_route53_record.validation : r.fqdn]
}

locals {
  certificate_arn = var.certificate_arn != null ? var.certificate_arn : (
    local.manage_dns ? aws_acm_certificate_validation.this[0].certificate_arn : aws_acm_certificate.this[0].arn
  )
}

# ─── Load balancer ───────────────────────────────────────────────────────────

resource "aws_security_group" "alb" {
  name        = "${var.name_prefix}-alb"
  description = "HTTPS into the load balancer"
  vpc_id      = var.vpc_id
  tags        = { Name = "${var.name_prefix}-alb" }
}

resource "aws_vpc_security_group_ingress_rule" "public" {
  #checkov:skip=CKV_AWS_260:Port 80 only answers with a 301 to HTTPS (see the http listener).
  for_each          = toset(["80", "443"])
  security_group_id = aws_security_group.alb.id
  description       = "HTTP/HTTPS from the internet (80 only redirects)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "tcp"
  from_port         = tonumber(each.key)
  to_port           = tonumber(each.key)
}

resource "aws_lb" "this" {
  #checkov:skip=CKV2_AWS_28:The regional WAF web ACL is associated by the waf module (enable_waf, on in aws-dev and aws-prod); checkov cannot follow the association across modules.
  #checkov:skip=CKV_AWS_150:Deletion protection is an input (deletion_protection); aws-prod enables it.
  name                       = "${var.name_prefix}-alb"
  load_balancer_type         = "application"
  internal                   = false
  subnets                    = var.public_subnet_ids
  security_groups            = [aws_security_group.alb.id]
  drop_invalid_header_fields = true
  idle_timeout               = var.idle_timeout
  enable_deletion_protection = var.deletion_protection

  #checkov:skip=CKV_AWS_91:Access logging is opt-in via access_logs_bucket.
  dynamic "access_logs" {
    for_each = var.access_logs_bucket == null ? [] : [1]
    content {
      bucket  = var.access_logs_bucket
      prefix  = "alb"
      enabled = true
    }
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# Requests no service rule matched get a 404; each service adds its own rule.
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = local.certificate_arn
  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "404"
    }
  }
}

# Tenants' custom domains: one ACM certificate each (or a SAN certificate), by SNI.
resource "aws_lb_listener_certificate" "extra" {
  for_each        = toset(var.extra_certificate_arns)
  listener_arn    = aws_lb_listener.https.arn
  certificate_arn = each.value
}

# ─── DNS (when the zone is in Route53) ───────────────────────────────────────

resource "aws_route53_record" "hosts" {
  for_each = local.manage_dns ? var.dns_names : {}
  zone_id  = var.route53_zone_id
  name     = each.value
  type     = "A"
  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}
