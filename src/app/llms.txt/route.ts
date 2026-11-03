import { llmsTxt } from "@/lib/llms";

// https://llmstxt.org: a Markdown map of the store for AI answer engines (src/lib/llms.ts).
export async function GET() {
  return new Response(await llmsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
