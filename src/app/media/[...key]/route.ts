import fs from "node:fs/promises";
import path from "node:path";
import { LOCAL_DIR } from "@/lib/storage";

// Serves files uploaded with STORAGE_DRIVER=local. Keys are random and never
// reused, so responses are cached as immutable.

const TYPES: Record<string, string> = {
  webp: "image/webp",
  avif: "image/avif",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
};

export async function GET(_request: Request, { params }: RouteContext<"/media/[...key]">) {
  const { key } = await params;
  const file = path.resolve(LOCAL_DIR, ...key);
  const type = TYPES[path.extname(file).slice(1).toLowerCase()];
  if (!type || !file.startsWith(LOCAL_DIR + path.sep)) return new Response("Not found", { status: 404 });
  try {
    const data = await fs.readFile(file);
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
