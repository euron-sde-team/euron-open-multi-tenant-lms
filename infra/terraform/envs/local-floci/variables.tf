variable "endpoint" {
  description = "Emulator endpoint: http://localhost:4637 from the host, http://floci:4566 inside compose."
  type        = string
  default     = "http://localhost:4637"
}

variable "name_prefix" {
  description = "Must match the SES and SQS names in deploy/compose/compose.floci.yaml."
  type        = string
  default     = "open-mtlms-local"
}

variable "mail_domain" {
  description = "Sending domain registered in the emulator's SES (must match AWS_SES_FROM_EMAIL in deploy/compose/compose.floci.yaml)."
  type        = string
  default     = "lms.example.test"
}

variable "bucket_name" {
  description = "The assets bucket (AWS_S3_BUCKET in deploy/compose/compose.floci.yaml)."
  type        = string
  default     = "open-mtlms-local-assets"
}

variable "app_origins" {
  description = "Browser origins of the local console, admin and storefronts (CORS on the assets bucket)."
  type        = list(string)
  default     = ["http://localhost:3600", "http://localhost:3610", "http://*.lvh.me:3620"]
}
