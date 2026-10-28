import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

// Upload storage. "local" writes to disk (VPS / Node hosting) and is served by
// /media/[...key]. "s3" targets any S3-compatible bucket (needed on serverless).

export const LOCAL_DIR = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR ?? "storage/uploads");

const usingS3 = () => process.env.STORAGE_DRIVER === "s3";

export function newKey(prefix: string, ext: string) {
  const d = new Date();
  return `${prefix}/${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${randomBytes(10).toString("hex")}.${ext}`;
}

async function s3() {
  const { S3Client, PutObjectCommand, DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  const bucket = process.env.S3_BUCKET;
  const publicUrl = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
  if (!bucket || !publicUrl) throw new Error("S3_BUCKET and S3_PUBLIC_URL must be set when STORAGE_DRIVER=s3.");
  const client = new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" },
  });
  return { client, bucket, publicUrl, PutObjectCommand, DeleteObjectCommand };
}

/** Store a file and return its public URL. */
export async function putObject(key: string, body: Buffer, contentType: string) {
  if (usingS3()) {
    const { client, bucket, publicUrl, PutObjectCommand } = await s3();
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
    return `${publicUrl}/${key}`;
  }
  const file = path.join(LOCAL_DIR, key);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body);
  return `/media/${key}`;
}

export async function deleteObject(key: string) {
  try {
    if (usingS3()) {
      const { client, bucket, DeleteObjectCommand } = await s3();
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return;
    }
    const file = path.resolve(LOCAL_DIR, key);
    if (file.startsWith(LOCAL_DIR + path.sep)) await fs.rm(file, { force: true });
  } catch (err) {
    console.error("[storage] delete failed", key, err);
  }
}
