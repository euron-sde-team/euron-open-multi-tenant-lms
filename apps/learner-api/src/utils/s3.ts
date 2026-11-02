/**
 * S3 utility for generating pre-signed GET URLs and streaming content.
 * Used to serve private S3 objects (e.g. book EPUBs) to the browser.
 */

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";

import { createS3Client } from "./s3-client";
const s3Client = createS3Client();

export { s3Client };

/**
 * Parse a direct S3 URL into bucket and key.
 * Supports: https://{bucket}.s3.{region}.amazonaws.com/{key}
 * Returns null if the URL is not a recognised S3 URL.
 */
export function parseS3Url(url: string): { bucket: string; key: string } | null {
  try {
    const parsed = new URL(url);
    // Pattern: {bucket}.s3.{region}.amazonaws.com
    const match = parsed.hostname.match(/^(.+)\.s3\.[a-z0-9-]+\.amazonaws\.com$/);
    if (match) {
      return { bucket: match[1], key: decodeURIComponent(parsed.pathname.slice(1)) };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Generate a pre-signed GET URL for an S3 object.
 * @param bucket S3 bucket name
 * @param key    S3 object key
 * @param expiresIn Seconds until the URL expires (default 1 hour)
 */
export async function getPresignedGetUrl(
  bucket: string,
  key: string,
  expiresIn = 3600
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/**
 * If `url` is a direct S3 URL, return a pre-signed GET URL.
 * Otherwise return the original URL unchanged.
 */
export async function toPresignedUrl(url: string | null | undefined): Promise<string | null> {
  if (!url?.trim()) return null;
  const parsed = parseS3Url(url);
  if (!parsed) return url; // Not an S3 URL, return as-is
  return getPresignedGetUrl(parsed.bucket, parsed.key);
}

/**
 * Get an S3 object as a readable stream.
 * Used for secure streaming of book content without exposing S3 URLs.
 */
export async function getS3ObjectStream(
  bucket: string,
  key: string
): Promise<{ stream: Readable; contentLength: number | undefined; contentType: string | undefined }> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error("No body in S3 response");
  }

  // The body is a Readable stream in Node.js
  const stream = response.Body as Readable;

  return {
    stream,
    contentLength: response.ContentLength,
    contentType: response.ContentType,
  };
}

/**
 * Get an S3 object as a Buffer.
 * Used for secure delivery of book content as ArrayBuffer.
 */
export async function getS3ObjectBuffer(bucket: string, key: string): Promise<Buffer> {
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(command);

  if (!response.Body) {
    throw new Error("No body in S3 response");
  }

  // Convert stream to buffer
  const chunks: Buffer[] = [];
  for await (const chunk of response.Body as Readable) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}
