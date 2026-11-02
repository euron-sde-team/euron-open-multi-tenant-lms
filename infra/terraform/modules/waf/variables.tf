variable "name_prefix" {
  description = "Prefix for every resource name."
  type        = string
}

variable "rate_limit_per_5_minutes" {
  description = "Requests per IP per 5 minutes before the WAF blocks it (payment gateway webhooks are exempt)."
  type        = number
  default     = 3000
}

variable "load_balancer_arn" {
  description = "Load balancer the web ACL is associated with."
  type        = string
}
