import { S3Client } from "@aws-sdk/client-s3";
import config from "../config";

/**
 * One S3 client factory for every upload path. AWS_ENDPOINT_URL points the SDK
 * at an S3-compatible emulator (Floci locally); AWS_S3_FORCE_PATH_STYLE
 * switches to path-style addressing.
 */
export function createS3Client(endpoint: string = config.AWS_ENDPOINT_URL): S3Client {
  return new S3Client({
    region: config.AWS_REGION,
    ...(endpoint ? { endpoint } : {}),
    forcePathStyle: config.AWS_S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: config.AWS_S3_ACCESS_KEY || "",
      secretAccessKey: config.AWS_S3_SECRET_KEY || "",
    },
  });
}

/**
 * Client for presigned URLs a BROWSER uses: signed against
 * AWS_S3_PUBLIC_ENDPOINT when set (the host the browser can reach), else the
 * regular endpoint.
 */
export function createPresignS3Client(): S3Client {
  return createS3Client(config.AWS_S3_PUBLIC_ENDPOINT || config.AWS_ENDPOINT_URL);
}

/** Key prefix for publicly readable media (logos, thumbnails, page images). */
export const PUBLIC_KEY_PREFIX = "public/";

/** Prefixes a key with `public/` (idempotent). */
export function publicKey(key: string): string {
  const k = key.replace(/^\//, "");
  return k.startsWith(PUBLIC_KEY_PREFIX) ? k : `${PUBLIC_KEY_PREFIX}${k}`;
}

/** Public base URL for a bucket (no trailing slash). */
export function s3BucketBaseUrl(bucket: string): string {
  if (config.S3_PUBLIC_BASE_URL && bucket === config.AWS_S3_BUCKET) return config.S3_PUBLIC_BASE_URL;
  const endpoint = config.AWS_S3_PUBLIC_ENDPOINT || config.AWS_ENDPOINT_URL;
  if (endpoint) return `${endpoint}/${bucket}`;
  return `https://${bucket}.s3.${config.AWS_REGION}.amazonaws.com`;
}

/** Public URL of an object. */
export function s3PublicUrl(bucket: string, key: string): string {
  return `${s3BucketBaseUrl(bucket)}/${key.replace(/^\//, "")}`;
}
