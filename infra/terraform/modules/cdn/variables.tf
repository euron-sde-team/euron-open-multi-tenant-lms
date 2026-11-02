variable "name_prefix" {
  description = "Prefix for every resource name."
  type        = string
}

variable "hostname" {
  description = "Public host of the media CDN, e.g. \"assets.lms.example.com\"."
  type        = string
}

variable "bucket_regional_domain_name" {
  description = "Regional endpoint of the assets bucket (storage module output)."
  type        = string
}

variable "route53_zone_id" {
  description = "Hosted zone for the host. When set, the certificate is validated and the alias records are created automatically."
  type        = string
  default     = null
}

variable "certificate_arn" {
  description = "Existing ACM certificate in us-east-1 covering the host. Null requests a new one (validated automatically with route53_zone_id, otherwise publish the records from the outputs)."
  type        = string
  default     = null
}

variable "web_acl_arn" {
  description = "Optional WAF web ACL (CLOUDFRONT scope, created in us-east-1). Null attaches none."
  type        = string
  default     = null
}

variable "price_class" {
  description = "CloudFront price class."
  type        = string
  default     = "PriceClass_100"
}
