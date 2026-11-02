import { PutObjectCommand } from "@aws-sdk/client-s3";
import config from "../config";

import { createS3Client } from "./s3-client";
const s3Client = createS3Client();

const TENANT_DETAILS_BUCKET = config.TENANT_DETAILS_S3_BUCKET;

export async function uploadInvoiceToS3(params: {
  key: string;
  body: Buffer;
}): Promise<string> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: TENANT_DETAILS_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: "application/pdf",
    })
  );
  return `${config.TENANT_DETAILS_BASE_URL}/${params.key}`;
}
