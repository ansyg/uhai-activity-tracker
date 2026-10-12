import "server-only";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2 (S3-compatible) for activity attachments. Uploads go
 * straight from the browser to R2 via a short-lived presigned PUT URL —
 * file bytes never pass through our own server, which matters on Vercel
 * where serverless functions have a request body size limit that a real
 * attachment would blow past.
 */

let cachedClient: S3Client | null = null;

function client(): S3Client {
  if (cachedClient) return cachedClient;
  cachedClient = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return cachedClient;
}

export function isStorageConfigured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET &&
      process.env.R2_PUBLIC_URL
  );
}

/**
 * Deliberately excludes anything a browser can render/execute (text/html,
 * image/svg+xml, xhtml, etc.) — these are served back from a public bucket
 * URL with no sandboxing, so an allowed renderable type there is a stored
 * XSS waiting for someone to click the attachment link. application/octet-stream
 * is allowed as a generic fallback because ContentDisposition: attachment
 * (set below) makes the browser download rather than interpret it regardless
 * of the claimed type, so it can't be abused the way text/html or SVG could.
 */
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
  "application/json",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/octet-stream",
]);

export function isAllowedContentType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.has(contentType.toLowerCase());
}

/** A unique, collision-proof object key under a per-activity prefix, with the original filename kept (sanitized) for readability in the bucket. */
export function attachmentKey(activityId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-150);
  return `attachments/${activityId}/${randomUUID()}-${safeName}`;
}

/** The key prefix every attachment for this activity must live under — lets routes reject a client-supplied key for a different activity (or a totally different object in the bucket). */
export function activityAttachmentPrefix(activityId: string): string {
  return `attachments/${activityId}/`;
}

export async function createUploadUrl(key: string, contentType: string, fileName: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET,
    Key: key,
    ContentType: contentType,
    // Forces a download instead of inline rendering when the object is later
    // fetched from the public bucket URL — the real backstop against a
    // mis-typed or spoofed Content-Type ever being interpreted as a page.
    ContentDisposition: `attachment; filename="${fileName.replace(/["\r\n]/g, "_")}"`,
  });
  return getSignedUrl(client(), command, { expiresIn: 300 });
}

export function publicUrlFor(key: string): string {
  return `${process.env.R2_PUBLIC_URL}/${key}`;
}

/** The reverse of publicUrlFor — needed to delete the R2 object given only the stored fileUrl. */
export function keyFromPublicUrl(url: string): string | null {
  const prefix = `${process.env.R2_PUBLIC_URL}/`;
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET, Key: key }));
}
