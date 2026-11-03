import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

// Checkout, the API and the admin are kept out of every crawler. Account, order tracking and partner pages stay
// crawlable because they send noindex themselves (a blocked page can't show a crawler its noindex).
const disallow = ["/checkout", "/api/", "/admin"];

// AI search and answer engines that cite and link their sources. Named so they keep access even if the default
// group is ever tightened. Training crawlers fall under "*"; to opt out of training, add a group with
// disallow "/" for GPTBot, ClaudeBot, Google-Extended, Applebot-Extended or CCBot.
const answerEngines = ["OAI-SearchBot", "ChatGPT-User", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      { userAgent: answerEngines, allow: "/", disallow },
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
