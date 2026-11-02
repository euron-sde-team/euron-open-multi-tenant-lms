import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import config from "../config";
import { createS3Client, s3PublicUrl } from "../utils/s3";

const s3Client = createS3Client();

class TenantOrgS3Service {
  private bucket = config.TENANT_DETAILS_S3_BUCKET;

  async uploadFile(
    tenantId: string,
    path: string,
    file: Buffer,
    contentType: string
  ): Promise<string> {
    const key = `public/tenants/${tenantId}/${path}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      })
    );

    return key;
  }

  async deleteFile(key: string): Promise<void> {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
  }

  async getFile(key: string): Promise<{ buffer: Buffer; contentType: string } | null> {
    try {
      const response = await s3Client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key })
      );
      const stream = response.Body;
      if (!stream) return null;
      const chunks: Uint8Array[] = [];
      for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return {
        buffer: Buffer.concat(chunks),
        contentType: response.ContentType || "image/png",
      };
    } catch {
      return null;
    }
  }

  /**
   * Upload a user-level file (not tenant-scoped).
   * Stored under `users/{userId}/{path}`.
   */
  async uploadUserFile(
    userId: string,
    path: string,
    file: Buffer,
    contentType: string
  ): Promise<string> {
    const key = `public/users/${userId}/${path}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file,
        ContentType: contentType,
      })
    );

    return key;
  }

  async getFileBuffer(key: string): Promise<Buffer | null> {
    const result = await this.getFile(key);
    return result?.buffer ?? null;
  }

  getPublicUrl(key: string): string {
    return s3PublicUrl(this.bucket, key);
  }
}

export default new TenantOrgS3Service();
