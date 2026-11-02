variable "bucket_name" {
  description = "Globally unique bucket name, e.g. \"<name_prefix>-files-<account id>\"."
  type        = string
}

variable "kms_key_arn" {
  description = "CMK that encrypts the objects."
  type        = string
}

variable "cors_origins" {
  description = "Browser origins allowed to use presigned URLs (console, admin and the storefronts)."
  type        = list(string)
  default     = []
}

variable "noncurrent_version_days" {
  description = "Days an overwritten or deleted object version is kept."
  type        = number
  default     = 30
}

variable "force_destroy" {
  description = "Allow destroying the bucket while it still holds objects (throwaway environments only)."
  type        = bool
  default     = false
}

variable "enforce_tls" {
  description = "Attach the bucket policy that refuses plain-HTTP requests (off only for an emulator that has no TLS)."
  type        = bool
  default     = true
}

variable "public_read_prefix" {
  description = "Key prefix of public media (thumbnails, page images) that the media CDN may read."
  type        = string
  default     = "public/"
}

variable "allow_cdn_read" {
  description = "Let cloudfront_distribution_arn read public_read_prefix (decided at plan time, so a bool rather than a null check on the ARN)."
  type        = bool
  default     = false
}

variable "cloudfront_distribution_arn" {
  description = "Media CDN distribution allowed to read public_read_prefix through Origin Access Control."
  type        = string
  default     = null
}
