import { logActivity } from "@/lib/admin/audit";
import { exportCustomers, exportSubscribers } from "@/lib/admin/customers";
import { csvEscape } from "@/lib/admin/format";
import { exportOrders } from "@/lib/admin/orders";
import { getCurrentAdmin } from "@/lib/auth/session";

// CSV downloads for the Lab Console. Every cell goes through csvEscape, which also
// neutralises spreadsheet formulas. Each export is capped at EXPORT_LIMIT rows.

const dollars = (cents: number) => (cents / 100).toFixed(2);

const EXPORTS: Record<string, () => Promise<unknown[][]>> = {
  async orders() {
    const rows = await exportOrders();
    return [
      [
        "number",
        "created_at",
        "status",
        "payment_status",
        "payment_method",
        "email",
        "first_name",
        "last_name",
        "phone",
        "address1",
        "address2",
        "city",
        "region",
        "postal_code",
        "country",
        "subtotal",
        "discount",
        "discount_code",
        "shipping",
        "total",
        "tracking_carrier",
        "tracking_number",
      ],
      ...rows.map((o) => [
        o.number,
        o.createdAt,
        o.status,
        o.paymentStatus,
        o.paymentMethod,
        o.email,
        o.firstName,
        o.lastName,
        o.phone,
        o.address1,
        o.address2,
        o.city,
        o.region,
        o.postalCode,
        o.country,
        dollars(o.subtotalCents),
        dollars(o.discountCents),
        o.discountCode,
        dollars(o.shippingCents),
        dollars(o.totalCents),
        o.trackingCarrier,
        o.trackingNumber,
      ]),
    ];
  },
  async customers() {
    const rows = await exportCustomers();
    return [
      ["email", "first_name", "last_name", "phone", "country", "orders", "paid_spend", "last_order_at", "created_at"],
      ...rows.map((c) => [c.email, c.firstName, c.lastName, c.phone, c.country, c.orderCount, dollars(c.paidCents), c.lastOrderAt, c.createdAt]),
    ];
  },
  async subscribers() {
    const rows = await exportSubscribers();
    return [["email", "source", "created_at", "unsubscribed_at"], ...rows.map((s) => [s.email, s.source, s.createdAt, s.unsubscribedAt])];
  },
};

export async function GET(_req: Request, { params }: RouteContext<"/api/admin/export/[kind]">) {
  const user = await getCurrentAdmin();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const { kind } = await params;
  const build = Object.hasOwn(EXPORTS, kind) ? EXPORTS[kind] : undefined;
  if (!build) return new Response("Not found", { status: 404 });

  const table = await build();
  // BOM so Excel opens UTF-8 (names, addresses) correctly; CRLF line endings per RFC 4180.
  const csv = "\uFEFF" + table.map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
  const rows = table.length - 1;
  await logActivity(user, "export", kind, null, `Exported ${kind} CSV (${rows.toLocaleString("en-US")} row${rows === 1 ? "" : "s"})`);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${kind}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
