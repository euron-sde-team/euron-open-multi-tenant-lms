import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import config from "../config";
import { createPresignS3Client, createS3Client } from "../utils/s3";

const s3Client = createS3Client();
const presignClient = createPresignS3Client();

const BUCKET = config.TENANT_DETAILS_S3_BUCKET;

function inputKey(tenantId: string, jobId: string): string {
  return `bulk-imports/${tenantId}/${jobId}-input.json`;
}

function reportKey(tenantId: string, jobId: string): string {
  return `bulk-imports/${tenantId}/${jobId}-report.csv`;
}

/** Upload the parsed rows JSON for an async job. Worker downloads this. */
export async function uploadInput(
  tenantId: string,
  jobId: string,
  body: Buffer,
): Promise<string> {
  const key = inputKey(tenantId, jobId);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: "application/json",
    }),
  );
  return key;
}

/** Download the input JSON for the worker. */
export async function downloadInput(key: string): Promise<Buffer> {
  const out = await s3Client.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
  );
  const stream = out.Body;
  if (!stream || typeof (stream as { transformToByteArray?: unknown }).transformToByteArray !== "function") {
    throw new Error("Unexpected S3 response body shape");
  }
  const bytes = await (stream as { transformToByteArray: () => Promise<Uint8Array> })
    .transformToByteArray();
  return Buffer.from(bytes);
}

/** Upload the per-row report CSV. */
export async function uploadReport(
  tenantId: string,
  jobId: string,
  body: Buffer,
): Promise<string> {
  const key = reportKey(tenantId, jobId);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: "text/csv",
    }),
  );
  return key;
}

/** Signed URL valid for 15 minutes so the admin can download the report. */
export async function getReportSignedUrl(key: string): Promise<string> {
  return getSignedUrl(
    presignClient,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 15 * 60 },
  );
}
