# One regional WAF web ACL on the load balancer, in front of all six services:
#
#   - AWS managed common rule set and known-bad-inputs rule set
#   - a per-IP rate limit for everything except payment gateway webhooks, which arrive
#     from a few provider addresses in bursts and authenticate with signatures instead
#
# Body rules that would block legitimate LMS content only count: page layouts, course
# descriptions and certificate templates are HTML or JSON carrying HTML
# (CrossSiteScripting_BODY), page and course saves and bulk imports pass the 8 KB body
# inspection limit (SizeRestrictions_BODY), and lesson content routinely holds URLs and
# paths (GenericLFI_BODY, GenericRFI_BODY, EC2MetaDataSSRF_BODY). The APIs sanitise
# stored HTML and never open a path or fetch a URL taken from a body.
resource "aws_wafv2_web_acl" "this" {
  #checkov:skip=CKV2_AWS_31:WAF logging needs a Firehose or bucket the operator chooses; sampled requests and metrics are on.
  name  = "${var.name_prefix}-edge"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "common"
    priority = 1
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
        dynamic "rule_action_override" {
          for_each = ["SizeRestrictions_BODY", "CrossSiteScripting_BODY", "GenericLFI_BODY", "GenericRFI_BODY", "EC2MetaDataSSRF_BODY"]
          content {
            name = rule_action_override.value
            action_to_use {
              count {}
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-common"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "known-bad-inputs"
    priority = 2
    override_action {
      none {}
    }
    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "rate-limit"
    priority = 3
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit              = var.rate_limit_per_5_minutes
        aggregate_key_type = "IP"
        scope_down_statement {
          not_statement {
            statement {
              regex_match_statement {
                regex_string = "^/api/v1/(webhook|webhooks)(/|$)"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "NONE"
                }
              }
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.name_prefix}-rate"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.name_prefix}-edge"
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_association" "this" {
  resource_arn = var.load_balancer_arn
  web_acl_arn  = aws_wafv2_web_acl.this.arn
}
