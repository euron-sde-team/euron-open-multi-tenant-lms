variable "name_prefix" {
  description = "Prefix for every resource name."
  type        = string
}

variable "vpc_id" {
  description = "VPC for the load balancer."
  type        = string
}

variable "public_subnet_ids" {
  description = "Public subnets, one per AZ."
  type        = list(string)
}

variable "certificate_names" {
  description = "Names the load balancer certificate covers, primary first: [\"lms.example.com\", \"*.lms.example.com\"]."
  type        = list(string)
  validation {
    condition     = length(var.certificate_names) > 0
    error_message = "certificate_names needs at least one name."
  }
}

variable "dns_names" {
  description = "Alias records pointing at the load balancer when the zone is in Route53: { apex = \"lms.example.com\", wildcard = \"*.lms.example.com\" }."
  type        = map(string)
  default     = {}
}

variable "route53_zone_id" {
  description = "Hosted zone for the names. When set, the certificate is validated and the records are created automatically."
  type        = string
  default     = null
}

variable "certificate_arn" {
  description = "Existing ACM certificate covering certificate_names. Null requests a new one."
  type        = string
  default     = null
}

variable "extra_certificate_arns" {
  description = "Additional ACM certificates on the HTTPS listener, for tenants' custom domains."
  type        = list(string)
  default     = []
}

variable "access_logs_bucket" {
  description = "Bucket for ALB access logs. Null disables them."
  type        = string
  default     = null
}

variable "idle_timeout" {
  description = "Seconds a connection may stay idle (no bytes either way) before the load balancer closes it."
  type        = number
  default     = 120
  validation {
    condition     = var.idle_timeout >= 60 && var.idle_timeout <= 4000
    error_message = "idle_timeout must be between 60 and 4000 seconds."
  }
}

variable "deletion_protection" {
  description = "Protect the load balancer from deletion."
  type        = bool
  default     = false
}
