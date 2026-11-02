# The media CDN: public course and page media (thumbnails, banners, page images) from
# the assets bucket, on its own host (assets.<domain>, AWS_S3_PUBLIC_BASE_URL):
#
#   https://<hostname>/public/<key>   ->   s3://<assets bucket>/public/<key>
#
# The bucket stays private: CloudFront reads it through Origin Access Control, and the
# bucket policy (storage module) admits only this distribution and only the public
# prefix, so private objects (submissions, certificates, exports) are never reachable
# here; the APIs hand those out as short-lived presigned URLs. Objects are encrypted
# with the deployment key, which lets CloudFront decrypt (kms module).
#
# Dynamic traffic does not pass through CloudFront: the load balancer (edge module) is
# the public entry point for the six services, with the regional WAF attached.
data "aws_cloudfront_cache_policy" "optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_origin_request_policy" "cors_s3" {
  name = "Managed-CORS-S3Origin"
}

data "aws_cloudfront_response_headers_policy" "cors_security" {
  name = "Managed-CORS-and-SecurityHeadersPolicy"
}

locals {
  full_name  = "${var.name_prefix}-media"
  manage_dns = var.route53_zone_id != null
  own_cert   = var.certificate_arn == null
  s3_origin  = "assets"
}

resource "aws_cloudfront_origin_access_control" "this" {
  name                              = local.full_name
  description                       = "${local.full_name}: public prefix of the assets bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ─── Certificate (us-east-1, as CloudFront requires) ────────────────────────

resource "aws_acm_certificate" "this" {
  count             = local.own_cert ? 1 : 0
  provider          = aws.us_east_1
  domain_name       = var.hostname
  validation_method = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "validation" {
  for_each = local.own_cert && local.manage_dns ? {
    for o in aws_acm_certificate.this[0].domain_validation_options : o.domain_name => o
  } : {}
  zone_id         = var.route53_zone_id
  name            = each.value.resource_record_name
  type            = each.value.resource_record_type
  records         = [each.value.resource_record_value]
  ttl             = 300
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "this" {
  count                   = local.own_cert && local.manage_dns ? 1 : 0
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.this[0].arn
  validation_record_fqdns = [for r in aws_route53_record.validation : r.fqdn]
}

locals {
  certificate_arn = local.own_cert ? (local.manage_dns ? aws_acm_certificate_validation.this[0].certificate_arn : aws_acm_certificate.this[0].arn) : var.certificate_arn
}

# ─── Distribution ────────────────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "this" {
  #checkov:skip=CKV_AWS_86:Access logging needs a log bucket the operator chooses; CloudWatch metrics are on.
  #checkov:skip=CKV_AWS_305:A media host serves objects by key only; there is no index page, and the root answers 403 from S3.
  #checkov:skip=CKV_AWS_310:Origin failover needs a second copy of the bucket; a single regional deployment has one.
  #checkov:skip=CKV_AWS_374:Geo restriction is a business decision per deployment.
  #checkov:skip=CKV2_AWS_47:Static media only (GET and HEAD from S3); nothing behind this distribution executes request input.
  #checkov:skip=CKV2_AWS_32:The managed CORS-and-security-headers policy is attached to every behavior.
  #checkov:skip=CKV_AWS_68:Static media only (GET and HEAD from S3); the dynamic services sit behind the load balancer and its regional WAF. A CLOUDFRONT-scope web ACL can still be passed in web_acl_arn.
  enabled         = true
  is_ipv6_enabled = true
  comment         = "${local.full_name}: ${var.hostname}"
  aliases         = [var.hostname]
  price_class     = var.price_class
  web_acl_id      = var.web_acl_arn
  http_version    = "http2and3"

  origin {
    origin_id                = local.s3_origin
    domain_name              = var.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.this.id
  }

  default_cache_behavior {
    target_origin_id           = local.s3_origin
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = data.aws_cloudfront_cache_policy.optimized.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.cors_s3.id
    response_headers_policy_id = data.aws_cloudfront_response_headers_policy.cors_security.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = local.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# ─── DNS ─────────────────────────────────────────────────────────────────────

resource "aws_route53_record" "host" {
  for_each = local.manage_dns ? toset(["A", "AAAA"]) : toset([])
  zone_id  = var.route53_zone_id
  name     = var.hostname
  type     = each.key
  alias {
    name                   = aws_cloudfront_distribution.this.domain_name
    zone_id                = aws_cloudfront_distribution.this.hosted_zone_id
    evaluate_target_health = false
  }
}
