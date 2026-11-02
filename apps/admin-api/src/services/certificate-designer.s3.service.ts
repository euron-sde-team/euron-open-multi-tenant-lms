/**
 * S3 uploads for the certificate designer, background images, signatures and
 * logos. Stored in the tenant-details bucket under a `certificates/` prefix.
 */
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { ulid } from "ulid";
import config from "../config";
import { createS3Client, s3PublicUrl } from "../utils/s3";

const s3Client = createS3Client();

const BUCKET = config.TENANT_DETAILS_S3_BUCKET;

// Raster image types only. SVG is intentionally excluded: it can carry
// executable script and these objects are publicly readable on a shared bucket,
// so a stored SVG would be a stored-XSS vector when opened directly.
const MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
};

/** Allowlist of accepted upload mime types, the single source of truth for
 *  both the multer fileFilter and the stored extension/Content-Type. */
export const ALLOWED_ASSET_MIME_TYPES = Object.keys(MIME_TO_EXT);

export async function uploadCertificateAsset(
  tenantId: string,
  file: { buffer: Buffer; mimetype: string; originalname?: string },
  kind: "background" | "signature" | "logo" = "background",
): Promise<string> {
  // Derive the extension from the validated mime type, never the client-supplied
  // filename. The route's fileFilter guarantees mimetype is in the allowlist.
  const ext = MIME_TO_EXT[file.mimetype] || "png";
  const key = `public/certificates/${tenantId}/${kind}/${ulid()}.${ext}`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }),
  );
  return s3PublicUrl(BUCKET, key);
}
