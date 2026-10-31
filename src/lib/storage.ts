import "server-only";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { eq, isNotNull } from "drizzle-orm";
import { getDb, media, productImages } from "@/db";

// Upload storage. By default files go in the database (`media` table) and are served by /media/[...key]: the
// host builds every deploy into a fresh folder, so files written to disk vanished on the next push.
// STORAGE_DRIVER=s3 uses any S3-compatible bucket instead, for a large catalogue or a CDN.

const usingS3 = () => process.env.STORAGE_DRIVER === "s3";

export const storageDriver = () => (usingS3() ? "s3" : "database");

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
  await getDb().insert(media).values({ key, contentType, data: body });
  return `/media/${key}`;
}

export async function deleteObject(key: string) {
  try {
    if (usingS3()) {
      const { client, bucket, DeleteObjectCommand } = await s3();
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return;
    }
    await getDb().delete(media).where(eq(media.key, key));
  } catch (err) {
    console.error("[storage] delete failed", key, err);
  }
}

/** A stored file, for /media/[...key]. */
export async function getObject(key: string) {
  const [row] = await getDb().select({ contentType: media.contentType, data: media.data }).from(media).where(eq(media.key, key)).limit(1);
  return row ?? null;
}

/**
 * Moves images uploaded before the database storage into it, from wherever they're still on disk: this build's
 * storage/uploads folder, or the same folder in earlier builds that the host kept next to it. Runs at startup.
 * ponytail: one-off recovery; remove once the logs stop reporting imports.
 */
export async function importDiskUploads() {
  if (usingS3()) return;
  const db = getDb();
  const [images, stored] = await Promise.all([
    db.select({ key: productImages.storageKey }).from(productImages).where(isNotNull(productImages.storageKey)),
    db.select({ key: media.key }).from(media),
  ]);
  const have = new Set(stored.map((s) => s.key));
  const missing = [...new Set(images.map((i) => i.key!))].filter((k) => !have.has(k) && /^[\w/-]+\.webp$/.test(k));
  if (!missing.length) return;

  // The app runs from <builds>/<build>/<app>; look in <builds>/*/<app>/storage/uploads as well as our own.
  const cwd = process.cwd();
  const builds = path.resolve(cwd, "../..");
  const app = path.basename(cwd);
  const siblings = await fs.readdir(builds).catch(() => [] as string[]);
  const roots = [path.join(cwd, "storage/uploads"), ...siblings.map((b) => path.join(builds, b, app, "storage/uploads"))];

  let found = 0;
  for (const key of missing) {
    for (const root of roots) {
      const data = await fs.readFile(path.join(root, key)).catch(() => null);
      if (!data) continue;
      await db.insert(media).values({ key, contentType: "image/webp", data }).onDuplicateKeyUpdate({ set: { key } });
      found++;
      break;
    }
  }
  console.log(`[storage] ${missing.length} image(s) had no stored file; recovered ${found} from disk.${found < missing.length ? " Re-upload the rest in Products." : ""}`);
}
