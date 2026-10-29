"use server";

import { refresh, updateTag } from "next/cache";
import { asc, eq } from "drizzle-orm";
import type { ActionState } from "@/components/admin/forms";
import { getDb, orderEvents, orderItems, orders } from "@/db";
import { logActivity } from "@/lib/admin/audit";
import { bulkInput } from "@/lib/admin/format";
import { plural, restockItems, wasRestocked, type NewEvent, type Tx } from "@/lib/admin/order-stock";
import { addressLines, isOrderStatus, isPaymentStatus, type OrderStatus, type PaymentStatus } from "@/lib/admin/orders";
import { requireAdmin, type AdminUser } from "@/lib/auth/session";
import { TAGS } from "@/lib/catalog/server";
import { announcePaidOrder } from "@/lib/discord";
import { sendShippingEmail } from "@/lib/email";
import { syncOrderPoints } from "@/lib/loyalty";

type Order = typeof orders.$inferSelect;
type OrderPatch = Partial<typeof orders.$inferInsert>;

const NOTE_MAX = 5000;
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim();
/** Multi-line text with line endings normalised. */
const text = (v: FormDataEntryValue | null) => str(v).replace(/\r\n?/g, "\n");
/** Leave a transaction early (nothing written) with a message for the form. */
const halt = (ok: boolean, message: string) => ({ halted: true as const, state: { ok, message } });

/** Lock the order row for the rest of the transaction so concurrent edits can't interleave. */
async function lockOrder(tx: Tx, orderId: number) {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1).for("update");
  return order;
}

async function addEvents(tx: Tx, orderId: number, user: AdminUser, events: NewEvent[]) {
  if (events.length) await tx.insert(orderEvents).values(events.map((e) => ({ orderId, adminId: user.id, type: e.type, message: e.message.slice(0, 500) })));
}

/** Why an order can't move from → to, or null. Everything else is left to the admin's judgement. */
function transitionError(from: OrderStatus, to: OrderStatus) {
  if (from === "cancelled" && (to === "shipped" || to === "delivered")) return `This order is cancelled — set it back to processing before marking it ${to}.`;
  return null;
}

/** Column changes that go with moving an order to `to`. */
function statusPatch(order: Order, to: OrderStatus, now: Date): OrderPatch {
  switch (to) {
    case "pending":
    case "processing":
      // Back in the queue: clear fulfilment stamps so they always describe the current state.
      return { status: to, shippedAt: null, deliveredAt: null, cancelledAt: null };
    case "shipped":
      // Stepping back from delivered (a correction) keeps the original ship date.
      return { status: to, shippedAt: order.status === "delivered" && order.shippedAt ? order.shippedAt : now, deliveredAt: null, cancelledAt: null };
    case "delivered":
      return { status: to, shippedAt: order.shippedAt ?? now, deliveredAt: now, cancelledAt: null };
    case "cancelled":
      return { status: to, cancelledAt: now };
    case "refunded":
      return { status: to, paymentStatus: "refunded" };
  }
}

function statusEvents(order: Order, to: OrderStatus): NewEvent[] {
  const events = [{ type: "status", message: `Status changed: ${order.status} → ${to}` }];
  if (to === "refunded" && order.paymentStatus !== "refunded") events.push({ type: "payment", message: `Payment changed: ${order.paymentStatus} → refunded` });
  return events;
}

/** Timeline entry for loyalty points given or taken back with an order change. */
const pointsEvent = (points: number): NewEvent => ({
  type: "payment",
  message: points > 0 ? `Customer earned ${points.toLocaleString("en-US")} loyalty points` : `${(-points).toLocaleString("en-US")} loyalty points taken back`,
});

/** Best-effort shipping confirmation. Records an event only when the email actually went out. */
async function notifyShipped(orderId: number, user: AdminUser) {
  try {
    const db = getDb();
    const [[order], lines] = await Promise.all([
      db.select().from(orders).where(eq(orders.id, orderId)).limit(1),
      db
        .select({ name: orderItems.productName, option: orderItems.optionValue, qty: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))
        .orderBy(asc(orderItems.id)),
    ]);
    if (!order) return false;
    const sent = await sendShippingEmail({
      number: order.number,
      email: order.email,
      firstName: order.firstName,
      carrier: order.trackingCarrier,
      trackingNumber: order.trackingNumber,
      lines,
      shipTo: addressLines(order),
    });
    if (sent) await db.insert(orderEvents).values({ orderId, adminId: user.id, type: "email", message: `Shipping confirmation emailed to ${order.email}`.slice(0, 500) });
    return sent;
  } catch (err) {
    console.error("[orders] shipping email", err);
    return false;
  }
}

/* ───────────── status ───────────── */

/** What happened to one order; `changed` is false when nothing was written. */
type Outcome = { ok: boolean; message: string; changed: boolean };

export async function updateOrderStatus(orderId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("staff");
  const to = str(fd.get("status"));
  if (!isOrderStatus(to)) return { ok: false, message: "Choose a status.", fieldErrors: { status: "Choose a status." } };
  const { ok, message, changed } = await changeStatus(user, orderId, to, fd.get("restock") === "on");
  if (changed) refresh();
  return { ok, message };
}

/** Move one order to `to` with all its side effects (timeline, restock, shipping email). The caller refreshes the page. */
async function changeStatus(user: AdminUser, orderId: number, to: OrderStatus, restock: boolean): Promise<Outcome> {
  const result = await getDb().transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) return halt(false, "Order not found.");
    if (order.status === to) return halt(false, `This order is already ${to}.`);
    const blocked = transitionError(order.status, to);
    if (blocked) return halt(false, blocked);

    const events = statusEvents(order, to);
    let restocked = 0;
    const notes: string[] = [];
    if (to === "cancelled" && restock) {
      const r = await restockItems(tx, orderId);
      restocked = r.units;
      if (r.event) events.push(r.event);
      if (r.skipped) notes.push(r.skipped);
    }
    if (order.status === "cancelled" && (await wasRestocked(tx, orderId))) {
      notes.push("Its items were restocked when it was cancelled and haven't been deducted again — adjust Inventory if they're going out.");
    }
    await tx.update(orders).set(statusPatch(order, to, new Date())).where(eq(orders.id, orderId));
    const points = await syncOrderPoints(tx, orderId);
    if (points) events.push(pointsEvent(points));
    await addEvents(tx, orderId, user, events);
    return { halted: false as const, order, restocked, notes };
  });
  if (result.halted) return { ...result.state, changed: false };

  const { order, restocked, notes } = result;
  await logActivity(user, "update", "order", orderId, `Order ${order.number}: ${order.status} → ${to}${restocked ? `, restocked ${plural(restocked, "unit")}` : ""}`);
  if (restocked) updateTag(TAGS.catalog);
  // Customers hear about it once: no new "shipped" email when correcting a delivered order.
  const emailed = to === "shipped" && order.status !== "delivered" && (await notifyShipped(orderId, user));

  const parts = [restocked ? `Status updated — ${plural(restocked, "unit")} restocked.` : "Status updated.", ...notes];
  if (emailed) parts.push("Shipping confirmation emailed.");
  return { ok: true, message: parts.join(" "), changed: true };
}

/* ───────────── payment ───────────── */

export async function updatePayment(orderId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("staff");
  const to = str(fd.get("paymentStatus"));
  const ref = str(fd.get("paymentRef"));
  if (!isPaymentStatus(to)) return { ok: false, message: "Choose a payment status.", fieldErrors: { paymentStatus: "Choose a payment status." } };
  if (ref.length > 191) return { ok: false, message: "That reference is too long.", fieldErrors: { paymentRef: "Keep it under 191 characters." } };
  const { ok, message, changed } = await changePayment(user, orderId, to, ref, fd.get("advance") === "on");
  if (changed) refresh();
  return { ok, message };
}

/**
 * Set one order's payment status. `ref` replaces the payment reference; pass undefined to keep it.
 * With `advance`, a pending order marked paid moves to processing. The caller refreshes the page.
 */
async function changePayment(user: AdminUser, orderId: number, to: PaymentStatus, ref: string | undefined, advance: boolean): Promise<Outcome> {
  const result = await getDb().transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) return halt(false, "Order not found.");
    const nextRef = ref === undefined ? order.paymentRef : ref || null;
    const statusChanged = order.paymentStatus !== to;
    const refChanged = nextRef !== order.paymentRef;
    if (!statusChanged && !refChanged) return halt(true, "No changes to save.");

    const now = new Date();
    const patch: OrderPatch = { paymentStatus: to, paymentRef: nextRef };
    const events: NewEvent[] = [];
    if (statusChanged) {
      // paid_at records when money arrived: kept through a refund, cleared if it turns out it never did.
      if (to === "paid") patch.paidAt = now;
      else if (to === "unpaid" || to === "failed") patch.paidAt = null;
      events.push({ type: "payment", message: `Payment changed: ${order.paymentStatus} → ${to}${nextRef ? ` · ref ${nextRef}` : ""}` });
    } else {
      events.push({ type: "payment", message: nextRef ? `Payment reference ${order.paymentRef ? "updated" : "added"}: ${nextRef}` : "Payment reference removed" });
    }
    const moved = advance && statusChanged && to === "paid" && order.status === "pending";
    if (moved) {
      Object.assign(patch, statusPatch(order, "processing", now));
      events.push({ type: "status", message: "Status changed: pending → processing" });
    }
    await tx.update(orders).set(patch).where(eq(orders.id, orderId));
    const points = await syncOrderPoints(tx, orderId);
    if (points) events.push(pointsEvent(points));
    await addEvents(tx, orderId, user, events);
    return { halted: false as const, order, statusChanged, moved };
  });
  if (result.halted) return { ...result.state, changed: false };

  const { order, statusChanged, moved } = result;
  if (statusChanged && to === "paid") await announcePaidOrder(orderId);
  await logActivity(
    user,
    "update",
    "order",
    orderId,
    statusChanged ? `Order ${order.number}: payment ${order.paymentStatus} → ${to}${moved ? ", moved to processing" : ""}` : `Order ${order.number}: payment reference updated`,
  );
  if (moved) return { ok: true, message: "Payment marked paid — order moved to processing.", changed: true };
  return { ok: true, message: statusChanged ? "Payment updated." : "Payment reference saved.", changed: true };
}

/* ───────────── bulk edit ───────────── */

/** Apply one status or payment change to several orders, each with the same rules and side effects as doing it by hand. */
export async function bulkUpdateOrders(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("staff");
  const { ids, action } = bulkInput(fd);
  if (!ids.length) return { ok: false, message: "Select at least one order." };

  let apply: (id: number) => Promise<Outcome>;
  if (action === "status:cancelled+restock") apply = (id) => changeStatus(user, id, "cancelled", true);
  else if (action.startsWith("status:") && isOrderStatus(action.slice(7))) apply = (id) => changeStatus(user, id, action.slice(7) as OrderStatus, false);
  else if (action.startsWith("payment:") && isPaymentStatus(action.slice(8))) apply = (id) => changePayment(user, id, action.slice(8) as PaymentStatus, undefined, true);
  else return { ok: false, message: "Choose an action." };

  // One at a time: each order is its own transaction, exactly as when edited by hand.
  const outcomes: Outcome[] = [];
  for (const id of ids) outcomes.push(await apply(id));
  const changed = outcomes.filter((o) => o.changed).length;
  if (changed) refresh();

  const skipped = outcomes.filter((o) => !o.changed);
  const reasons = [...new Set(skipped.map((o) => o.message))].slice(0, 3).join(" ");
  const message = `Updated ${changed} of ${plural(ids.length, "order")}.${skipped.length ? ` Skipped ${skipped.length}: ${reasons}` : ""}`;
  return { ok: changed > 0, message };
}

/* ───────────── shipping ───────────── */

export async function updateShipping(orderId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("staff");
  const carrier = str(fd.get("trackingCarrier"));
  const trackingNumber = str(fd.get("trackingNumber"));
  const markShipped = fd.get("markShipped") === "on";
  const fieldErrors: Record<string, string> = {};
  if (carrier.length > 60) fieldErrors.trackingCarrier = "Keep it under 60 characters.";
  if (trackingNumber.length > 120) fieldErrors.trackingNumber = "Keep it under 120 characters.";
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors };

  const result = await getDb().transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) return halt(false, "Order not found.");
    const trackingChanged = (carrier || null) !== order.trackingCarrier || (trackingNumber || null) !== order.trackingNumber;
    // Already shipped or delivered: there's nothing to mark.
    const ship = markShipped && order.status !== "shipped" && order.status !== "delivered";
    const blocked = ship ? transitionError(order.status, "shipped") : null;
    if (blocked) return halt(false, blocked);
    if (!trackingChanged && !ship) return halt(true, "No changes to save.");

    const patch: OrderPatch = { trackingCarrier: carrier || null, trackingNumber: trackingNumber || null };
    const events: NewEvent[] = [];
    if (trackingChanged) {
      const label = [carrier, trackingNumber].filter(Boolean).join(" · ");
      events.push({ type: "shipping", message: label ? `Tracking ${order.trackingCarrier || order.trackingNumber ? "updated" : "added"}: ${label}` : "Tracking removed" });
    }
    if (ship) {
      Object.assign(patch, statusPatch(order, "shipped", new Date()));
      events.push(...statusEvents(order, "shipped"));
    }
    await tx.update(orders).set(patch).where(eq(orders.id, orderId));
    await addEvents(tx, orderId, user, events);
    return { halted: false as const, order, trackingChanged, ship };
  });
  if (result.halted) return result.state;

  const { order, trackingChanged, ship } = result;
  const did = [trackingChanged && "tracking updated", ship && `${order.status} → shipped`].filter(Boolean).join(", ");
  await logActivity(user, "update", "order", orderId, `Order ${order.number}: ${did}`);
  const emailed = ship && (await notifyShipped(orderId, user));
  refresh();

  const message = ship ? (trackingChanged ? "Tracking saved — order marked shipped." : "Order marked shipped.") : "Tracking saved.";
  return { ok: true, message: emailed ? `${message} Shipping confirmation emailed.` : message };
}

/* ───────────── internal note ───────────── */

export async function saveOrderNote(orderId: number, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireAdmin("staff");
  const note = text(fd.get("internalNote"));
  if (note.length > NOTE_MAX) return { ok: false, message: "That note is too long.", fieldErrors: { internalNote: `Keep it under ${NOTE_MAX.toLocaleString("en-US")} characters.` } };

  const result = await getDb().transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order) return halt(false, "Order not found.");
    if ((note || null) === order.internalNote) return halt(true, "No changes to save.");
    await tx
      .update(orders)
      .set({ internalNote: note || null })
      .where(eq(orders.id, orderId));
    const preview = note.replace(/\s+/g, " ");
    await addEvents(tx, orderId, user, [{ type: "note", message: note ? `Internal note updated: “${preview.length > 140 ? `${preview.slice(0, 140)}…` : preview}”` : "Internal note cleared" }]);
    return { halted: false as const, order };
  });
  if (result.halted) return result.state;

  await logActivity(user, "update", "order", orderId, `Order ${result.order.number}: internal note ${note ? "updated" : "cleared"}`);
  refresh();
  return { ok: true, message: note ? "Note saved." : "Note cleared." };
}
