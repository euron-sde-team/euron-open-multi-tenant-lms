import { ulid } from "ulid";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import config from "../config";

/** Private bucket for lecture resources and assignment submissions. */
const getLectureResourcesBucket = (): string => config.S3_LECTURE_RESOURCES_BUCKET;

import { createS3Client } from "../utils/s3-client";
const s3Client = createS3Client();

export async function getSignedGetUrl(
  key: string,
  expiresIn = 3600
): Promise<string> {
  const bucket = getLectureResourcesBucket();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  return getSignedUrl(s3Client, command, { expiresIn });
}

/** Fetch object from S3 and return as Buffer (for streaming/proxying). */
export async function getObjectBuffer(key: string): Promise<Buffer> {
  const bucket = getLectureResourcesBucket();
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const response = await s3Client.send(command);
  const stream = response.Body;
  if (!stream) throw new Error("Empty S3 object");
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Upload a student's assignment submission of any file type to the private
 * lecture-resources bucket. The original extension is preserved in the key so the
 * grader's download keeps a sensible name and content type. Returns the S3 key.
 */
export async function uploadSubmissionPdf(
  tenantId: string,
  assignmentId: string,
  memberId: string,
  file: { buffer: Buffer; mimetype: string; originalname?: string }
): Promise<string> {
  const bucket = getLectureResourcesBucket();
  const safeExt =
    (file.originalname?.split(".").pop() ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 12) || "bin";
  const fileId = ulid();
  const key = `tenants/${tenantId}/submissions/${assignmentId}/${memberId}/${fileId}.${safeExt}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype || "application/octet-stream",
    ContentDisposition: file.originalname
      ? `attachment; filename="${file.originalname.replace(/"/g, "")}"`
      : undefined,
  });
  await s3Client.send(command);
  return key;
}

/** Best-effort content type derived from a key's file extension (for inline serving). */
export function getContentTypeForKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    txt: "text/plain",
    csv: "text/csv",
    zip: "application/zip",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  };
  return map[ext] ?? "application/octet-stream";
}

/** Upload a profile avatar to the public tenant-details bucket. Returns the public URL. */
export async function uploadProfileAvatar(
  tenantId: string,
  memberId: string,
  file: { buffer: Buffer; mimetype: string; originalname?: string }
): Promise<string> {
  const bucket = config.TENANT_DETAILS_S3_BUCKET;
  const mimeToExt: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
  };
  const ext =
    file.originalname?.split(".").pop()?.toLowerCase() ||
    mimeToExt[file.mimetype] ||
    "jpg";
  const key = `profile/${tenantId}/${memberId}/avatar_${ulid()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });
  await s3Client.send(command);

  return `${config.TENANT_DETAILS_BASE_URL}/${key}`;
}
