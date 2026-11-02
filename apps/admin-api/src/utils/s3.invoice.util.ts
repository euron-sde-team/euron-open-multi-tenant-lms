import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import config from "../config";
import { createS3Client, s3PublicUrl } from "./s3";

const s3Client = createS3Client();

export async function uploadInvoiceToS3(params: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  await s3Client.send(new PutObjectCommand({
    Bucket: config.TENANT_DETAILS_S3_BUCKET,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
  }));
  return params.key;
}

export function getInvoicePublicUrl(key: string): string {
  return s3PublicUrl(config.TENANT_DETAILS_S3_BUCKET, key);
}

export async function invoiceExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(new HeadObjectCommand({
      Bucket: config.TENANT_DETAILS_S3_BUCKET,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}
