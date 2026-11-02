output "bucket_name" {
  description = "AWS_S3_BUCKET."
  value       = aws_s3_bucket.this.id
}

output "bucket_arn" {
  description = "Bucket ARN."
  value       = aws_s3_bucket.this.arn
}

output "access_policy_json" {
  description = "IAM policy granting an API read, write and delete on the bucket's objects."
  value       = data.aws_iam_policy_document.access.json
}

output "bucket_regional_domain_name" {
  description = "Regional endpoint host (the media CDN origin)."
  value       = aws_s3_bucket.this.bucket_regional_domain_name
}
