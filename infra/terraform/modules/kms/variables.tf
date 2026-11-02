variable "name_prefix" {
  description = "Prefix for every resource name."
  type        = string
}

variable "deletion_window_in_days" {
  description = "Waiting period before a scheduled key deletion completes."
  type        = number
  default     = 30
}

variable "admin_principal_arns" {
  description = "IAM principals allowed to administer (not use) the key. Empty = account root only, which delegates to IAM policies."
  type        = list(string)
  default     = []
}

variable "allow_cloudfront_decrypt" {
  description = "Let CloudFront distributions of this account decrypt (the media CDN reading the assets bucket)."
  type        = bool
  default     = false
}
