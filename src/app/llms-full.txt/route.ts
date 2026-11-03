import { llmsFullTxt } from "@/lib/llms";

// The long form of /llms.txt: product descriptions and full guide text included (src/lib/llms.ts).
export async function GET() {
  return new Response(await llmsFullTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
