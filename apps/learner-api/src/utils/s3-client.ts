import { S3Client } from "@aws-sdk/client-s3";
import config from "../config";

/**
 * The one S3 client. Static keys only when both are set; otherwise the default
 * AWS credential chain (the ECS task role in production). AWS_ENDPOINT_URL
 * points it at Floci or another S3-compatible store locally.
 */
export function createS3Client(): S3Client {
  const hasKeys = Boolean(config.AWS_S3_ACCESS_KEY && config.AWS_S3_SECRET_KEY);
  return new S3Client({
    region: config.AWS_REGION,
    ...(config.AWS_ENDPOINT_URL ? { endpoint: config.AWS_ENDPOINT_URL } : {}),
    forcePathStyle: config.AWS_S3_FORCE_PATH_STYLE || Boolean(config.AWS_ENDPOINT_URL),
    ...(hasKeys
      ? {
          credentials: {
            accessKeyId: config.AWS_S3_ACCESS_KEY,
            secretAccessKey: config.AWS_S3_SECRET_KEY,
          },
        }
      : {}),
  });
}
