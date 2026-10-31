// Live store facts for the Discord bot's AI assistant (discord-bot/ai.py): every product on sale with its price and
// stock, shipping, payment methods, the setup discount and the FAQ. Same data the shop shows, refreshed the same way.
// Authenticated with BOT_API_KEY as a bearer token.

import { faqGroups } from "@/data/faq";
import { authorizedBot } from "@/lib/bot-api";
import { getCatalog, getPublicSettings } from "@/lib/catalog/server";
import { MAX_QTY, STOCK_LABEL } from "@/lib/catalog/types";
import { site } from "@/lib/site";
import { WARRANTY_MONTHS } from "@/lib/warranty";

export async function GET(req: Request) {
  if (!authorizedBot(req)) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [{ products, categories }, settings] = await Promise.all([getCatalog(), getPublicSettings()]);
  return Response.json({
    store: { name: site.name, url: site.url, currency: site.currency, supportEmail: settings.supportEmail },
    shipping: { flatFee: settings.flatShipping, freeOver: settings.freeShippingThreshold },
    // "razorpay" plus the card networks it takes, and "paypal" / "crypto" only while they're switched on.
    payments: settings.payments,
    setupDiscountPercent: settings.setupDiscountPercent,
    unpaidOrderHoldHours: settings.reservationHours,
    categories: categories.map((c) => ({ name: c.label, blurb: c.blurb })),
    products: products.map((p) => ({
      name: p.name,
      url: `${site.url}/product/${p.slug}`,
      category: p.categoryLabel,
      tagline: p.tagline,
      price: p.price,
      compareAt: p.compareAt ?? null,
      badge: p.badge ?? null,
      stock: STOCK_LABEL[p.status],
      // Most a customer can buy in one order right now, as checkout enforces it. Exact stock isn't shared.
      maxPerOrder: Math.min(MAX_QTY, p.maxQty ?? MAX_QTY),
      option: p.option ?? null,
      warrantyMonths: WARRANTY_MONTHS,
      rating: p.reviewCount ? { average: p.rating, reviews: p.reviewCount } : null,
      summary: p.summary,
      highlights: p.highlights,
      specs: p.specs,
      inTheBox: p.inTheBox,
    })),
    faq: faqGroups.flatMap((g) => g.items.map((i) => ({ topic: g.label, q: i.q, a: i.a }))),
    pages: {
      shop: `${site.url}/shop`,
      setupBuilder: `${site.url}/shop#build`,
      faq: `${site.url}/faq`,
      support: `${site.url}/support`,
      account: `${site.url}/account/login`,
      refundPolicy: `${site.url}/legal/refunds`,
    },
  });
}
