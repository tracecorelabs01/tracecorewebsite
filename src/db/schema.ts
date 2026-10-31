// Database schema (MySQL 5.7+/8.x and MariaDB 10.4+). Money is stored in
// integer cents. Generate migrations with `npm run db:generate`.

import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  customType,
  date,
  datetime,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  tinyint,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/** JSON stored portably: MySQL returns parsed JSON, MariaDB returns text — both are handled. */
const jsonCol = <T>(name: string) =>
  customType<{ data: T; driverData: string }>({
    dataType: () => "json",
    toDriver: (value) => JSON.stringify(value),
    fromDriver: (value) => (typeof value === "string" ? (JSON.parse(value) as T) : (value as T)),
  })(name);

const id = () => int("id").primaryKey().autoincrement();
const createdAt = () => timestamp("created_at").notNull().default(sql`CURRENT_TIMESTAMP`);
const updatedAt = () => timestamp("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`).onUpdateNow();

/* ───────────── Staff & auth ───────────── */

export const adminUsers = mysqlTable(
  "admin_users",
  {
    id: id(),
    email: varchar("email", { length: 191 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    passwordHash: varchar("password_hash", { length: 255 }).notNull(),
    role: mysqlEnum("role", ["owner", "admin", "staff"]).notNull().default("staff"),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: datetime("last_login_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("admin_users_email_uq").on(t.email)],
);

export const adminSessions = mysqlTable(
  "admin_sessions",
  {
    // SHA-256 of the session token; the raw token only ever lives in the cookie.
    id: char("id", { length: 64 }).primaryKey(),
    userId: int("user_id")
      .notNull()
      .references(() => adminUsers.id, { onDelete: "cascade" }),
    expiresAt: datetime("expires_at").notNull(),
    ip: varchar("ip", { length: 64 }),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: createdAt(),
  },
  (t) => [index("admin_sessions_user_idx").on(t.userId)],
);

export const loginAttempts = mysqlTable(
  "login_attempts",
  {
    id: id(),
    email: varchar("email", { length: 191 }),
    ip: varchar("ip", { length: 64 }),
    success: boolean("success").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("login_attempts_ip_idx").on(t.ip, t.createdAt), index("login_attempts_email_idx").on(t.email, t.createdAt)],
);

/* ───────────── Catalogue ───────────── */

export const categories = mysqlTable(
  "categories",
  {
    id: id(),
    slug: varchar("slug", { length: 80 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    blurb: varchar("blurb", { length: 255 }).notNull().default(""),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("categories_slug_uq").on(t.slug)],
);

export type Spec = { label: string; value: string };

export const products = mysqlTable(
  "products",
  {
    id: id(),
    slug: varchar("slug", { length: 120 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    tagline: varchar("tagline", { length: 255 }).notNull().default(""),
    categoryId: int("category_id").references(() => categories.id, { onDelete: "set null" }),
    status: mysqlEnum("status", ["active", "draft", "archived"]).notNull().default("draft"),
    priceCents: int("price_cents").notNull(),
    compareAtCents: int("compare_at_cents"),
    badge: varchar("badge", { length: 40 }),
    featured: boolean("featured").notNull().default(false),
    sortOrder: int("sort_order").notNull().default(0),
    trackInventory: boolean("track_inventory").notNull().default(true),
    stockQty: int("stock_qty").notNull().default(0),
    lowStockThreshold: int("low_stock_threshold").notNull().default(5),
    allowBackorder: boolean("allow_backorder").notNull().default(false),
    summary: text("summary"),
    highlights: jsonCol<string[]>("highlights"),
    specs: jsonCol<Spec[]>("specs"),
    inTheBox: jsonCol<string[]>("in_the_box"),
    optionName: varchar("option_name", { length: 60 }),
    optionValues: jsonCol<string[]>("option_values"),
    artKey: varchar("art_key", { length: 40 }),
    seoTitle: varchar("seo_title", { length: 160 }),
    seoDescription: varchar("seo_description", { length: 320 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("products_slug_uq").on(t.slug),
    index("products_status_idx").on(t.status),
    index("products_category_idx").on(t.categoryId),
  ],
);

/** File bytes as a MEDIUMBLOB (up to 16 MB). */
const mediumBlob = customType<{ data: Buffer; driverData: Buffer }>({ dataType: () => "mediumblob" });

/**
 * Uploaded files (product images), served by /media/[...key]. They live in the database, not on disk, because
 * the host builds every deploy into a fresh folder: files written next to the app were lost on the next push.
 */
export const media = mysqlTable("media", {
  key: varchar("key", { length: 191 }).primaryKey(),
  contentType: varchar("content_type", { length: 64 }).notNull(),
  data: mediumBlob("data").notNull(),
  createdAt: createdAt(),
});

export const productImages = mysqlTable(
  "product_images",
  {
    id: id(),
    productId: int("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: varchar("url", { length: 500 }).notNull(),
    storageKey: varchar("storage_key", { length: 255 }),
    alt: varchar("alt", { length: 255 }).notNull().default(""),
    width: int("width"),
    height: int("height"),
    sortOrder: int("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("product_images_product_idx").on(t.productId, t.sortOrder)],
);

/* ───────────── Customers & orders ───────────── */

export const customers = mysqlTable(
  "customers",
  {
    id: id(),
    email: varchar("email", { length: 191 }).notNull(),
    firstName: varchar("first_name", { length: 80 }).notNull().default(""),
    lastName: varchar("last_name", { length: 80 }).notNull().default(""),
    phone: varchar("phone", { length: 40 }),
    country: varchar("country", { length: 80 }),
    ordersCount: int("orders_count").notNull().default(0),
    totalSpentCents: int("total_spent_cents").notNull().default(0),
    lastOrderAt: datetime("last_order_at"),
    notes: text("notes"),
    // Account: opens when the customer asks for one (at checkout, or by signing in with Discord or Google) or
    // staff open one; null for guests. No password: customers sign in with a code emailed to them (login_codes).
    accountCreatedAt: datetime("account_created_at"),
    lastLoginAt: datetime("last_login_at"),
    // Signed in with Discord or Google. A linked Discord account also lets the bot show the customer their own orders.
    discordId: varchar("discord_id", { length: 32 }),
    discordUsername: varchar("discord_username", { length: 64 }),
    googleId: varchar("google_id", { length: 64 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("customers_email_uq").on(t.email), uniqueIndex("customers_discord_uq").on(t.discordId), uniqueIndex("customers_google_uq").on(t.googleId)],
);

/** The sign-in code last emailed to a customer: one per customer, works once, for 10 minutes. Stored only as a hash. */
export const loginCodes = mysqlTable("login_codes", {
  customerId: int("customer_id")
    .primaryKey()
    .references(() => customers.id, { onDelete: "cascade" }),
  codeHash: char("code_hash", { length: 64 }).notNull(),
  expiresAt: datetime("expires_at").notNull(),
  createdAt: createdAt(),
});

/** "Set your password" links, emailed to staff. Single use, and stored only as a hash. */
export const passwordResets = mysqlTable(
  "password_resets",
  {
    // SHA-256 of the token; the raw token only ever lives in the emailed link.
    id: char("id", { length: 64 }).primaryKey(),
    kind: mysqlEnum("kind", ["customer", "admin"]).notNull(),
    subjectId: int("subject_id").notNull(),
    expiresAt: datetime("expires_at").notNull(),
    usedAt: datetime("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("password_resets_subject_idx").on(t.kind, t.subjectId)],
);

/** An account's saved shipping addresses: kept from orders it places, managed on /account/details, offered at checkout. */
export const customerAddresses = mysqlTable(
  "customer_addresses",
  {
    id: id(),
    customerId: int("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    address1: varchar("address1", { length: 191 }).notNull(),
    address2: varchar("address2", { length: 191 }),
    city: varchar("city", { length: 120 }).notNull(),
    region: varchar("region", { length: 120 }),
    postalCode: varchar("postal_code", { length: 40 }).notNull(),
    country: varchar("country", { length: 80 }).notNull(),
    // The one checkout picks first. Each account with addresses has exactly one.
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("customer_addresses_customer_idx").on(t.customerId)],
);

export const customerSessions = mysqlTable(
  "customer_sessions",
  {
    // SHA-256 of the session token; the raw token only ever lives in the cookie.
    id: char("id", { length: 64 }).primaryKey(),
    customerId: int("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    // "orders": a guest who proved their email with a code on /track. It shows their orders, nothing else.
    scope: mysqlEnum("scope", ["account", "orders"]).notNull().default("account"),
    expiresAt: datetime("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("customer_sessions_customer_idx").on(t.customerId)],
);

export const ORDER_STATUSES = ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"] as const;
export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded", "failed"] as const;

export const orders = mysqlTable(
  "orders",
  {
    id: id(),
    number: varchar("number", { length: 20 }).notNull(),
    customerId: int("customer_id").references(() => customers.id, { onDelete: "set null" }),
    status: mysqlEnum("status", ORDER_STATUSES).notNull().default("pending"),
    paymentStatus: mysqlEnum("payment_status", PAYMENT_STATUSES).notNull().default("unpaid"),
    paymentMethod: varchar("payment_method", { length: 30 }).notNull(),
    paymentRef: varchar("payment_ref", { length: 191 }),
    // Razorpay order this order is paid through (card checkout); payments and webhooks are matched on it.
    razorpayOrderId: varchar("razorpay_order_id", { length: 40 }),
    email: varchar("email", { length: 191 }).notNull(),
    phone: varchar("phone", { length: 40 }),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    address1: varchar("address1", { length: 191 }).notNull(),
    address2: varchar("address2", { length: 191 }),
    city: varchar("city", { length: 120 }).notNull(),
    region: varchar("region", { length: 120 }),
    postalCode: varchar("postal_code", { length: 40 }).notNull(),
    country: varchar("country", { length: 80 }).notNull(),
    subtotalCents: int("subtotal_cents").notNull(),
    shippingCents: int("shipping_cents").notNull().default(0),
    discountCents: int("discount_cents").notNull().default(0),
    totalCents: int("total_cents").notNull(),
    currency: char("currency", { length: 3 }).notNull().default("USD"),
    discountCode: varchar("discount_code", { length: 40 }),
    customerNote: text("customer_note"),
    internalNote: text("internal_note"),
    trackingCarrier: varchar("tracking_carrier", { length: 60 }),
    trackingNumber: varchar("tracking_number", { length: 120 }),
    paidAt: datetime("paid_at"),
    shippedAt: datetime("shipped_at"),
    deliveredAt: datetime("delivered_at"),
    cancelledAt: datetime("cancelled_at"),
    ip: varchar("ip", { length: 64 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_number_uq").on(t.number),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
    index("orders_email_idx").on(t.email),
    index("orders_customer_idx").on(t.customerId),
    uniqueIndex("orders_razorpay_order_uq").on(t.razorpayOrderId),
  ],
);

export const orderItems = mysqlTable(
  "order_items",
  {
    id: id(),
    orderId: int("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: int("product_id").references(() => products.id, { onDelete: "set null" }),
    productSlug: varchar("product_slug", { length: 120 }).notNull(),
    productName: varchar("product_name", { length: 160 }).notNull(),
    optionValue: varchar("option_value", { length: 80 }),
    unitPriceCents: int("unit_price_cents").notNull(),
    quantity: int("quantity").notNull(),
    lineTotalCents: int("line_total_cents").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId), index("order_items_product_idx").on(t.productId)],
);

export const orderEvents = mysqlTable(
  "order_events",
  {
    id: id(),
    orderId: int("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 30 }).notNull(),
    message: varchar("message", { length: 500 }).notNull(),
    adminId: int("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const discountCodes = mysqlTable(
  "discount_codes",
  {
    id: id(),
    code: varchar("code", { length: 40 }).notNull(),
    kind: mysqlEnum("kind", ["percent", "fixed"]).notNull(),
    // percent: 1–100, fixed: cents
    value: int("value").notNull(),
    minSubtotalCents: int("min_subtotal_cents").notNull().default(0),
    maxUses: int("max_uses"),
    usedCount: int("used_count").notNull().default(0),
    startsAt: datetime("starts_at"),
    endsAt: datetime("ends_at"),
    isActive: boolean("is_active").notNull().default(true),
    /** Set on single-use codes a customer got for loyalty points; they're listed under Loyalty, not Discounts. */
    customerId: int("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    /** Only these products are discounted; null means the whole order. */
    productIds: jsonCol<number[]>("product_ids"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("discount_codes_code_uq").on(t.code)],
);

/* ───────────── Community & inbox ───────────── */

export const reviews = mysqlTable(
  "reviews",
  {
    id: id(),
    productId: int("product_id").references(() => products.id, { onDelete: "set null" }),
    name: varchar("name", { length: 80 }).notNull(),
    handle: varchar("handle", { length: 80 }),
    email: varchar("email", { length: 191 }),
    rating: tinyint("rating").notNull(),
    body: text("body").notNull(),
    status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
    source: varchar("source", { length: 40 }).notNull().default("site"),
    /** The account that wrote it (verified buyer), if any. */
    customerId: int("customer_id").references(() => customers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("reviews_status_idx").on(t.status), index("reviews_product_idx").on(t.productId)],
);

export const messages = mysqlTable(
  "messages",
  {
    id: id(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 191 }).notNull(),
    orderNumber: varchar("order_number", { length: 40 }),
    topic: varchar("topic", { length: 60 }).notNull(),
    body: text("body").notNull(),
    status: mysqlEnum("status", ["open", "closed"]).notNull().default("open"),
    ip: varchar("ip", { length: 64 }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("messages_status_idx").on(t.status, t.createdAt)],
);

export const subscribers = mysqlTable(
  "subscribers",
  {
    id: id(),
    email: varchar("email", { length: 191 }).notNull(),
    source: varchar("source", { length: 40 }).notNull().default("footer"),
    unsubscribedAt: datetime("unsubscribed_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("subscribers_email_uq").on(t.email)],
);

/* ───────────── Finance ───────────── */

/** Money the business spends, recorded in /admin/expenses. Dated by the day it was paid (no time zone). */
export const expenses = mysqlTable(
  "expenses",
  {
    id: id(),
    spentOn: date("spent_on", { mode: "string" }).notNull(),
    amountCents: int("amount_cents").notNull(),
    category: varchar("category", { length: 60 }).notNull(),
    vendor: varchar("vendor", { length: 120 }).notNull().default(""),
    description: varchar("description", { length: 500 }).notNull().default(""),
    paymentMethod: varchar("payment_method", { length: 40 }).notNull().default(""),
    reference: varchar("reference", { length: 120 }).notNull().default(""),
    createdBy: int("created_by").references(() => adminUsers.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("expenses_spent_on_idx").on(t.spentOn), index("expenses_category_idx").on(t.category)],
);

/* ───────────── Loyalty ───────────── */

/** Rewards customers can buy with points, set up in /admin/loyalty. Each redemption issues a single-use discount code. */
export const loyaltyOffers = mysqlTable("loyalty_offers", {
  id: id(),
  title: varchar("title", { length: 80 }).notNull(),
  description: varchar("description", { length: 255 }).notNull().default(""),
  pointsCost: int("points_cost").notNull(),
  kind: mysqlEnum("kind", ["percent", "fixed"]).notNull(),
  // percent: 1–100, fixed: cents
  value: int("value").notNull(),
  minSubtotalCents: int("min_subtotal_cents").notNull().default(0),
  /** Only these products are discounted by the codes it issues; null means the whole order. */
  productIds: jsonCol<number[]>("product_ids"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Every change to a customer's points. The balance is the sum; nothing is ever edited in place. */
export const loyaltyLedger = mysqlTable(
  "loyalty_ledger",
  {
    id: id(),
    customerId: int("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    points: int("points").notNull(),
    // order: earned or taken back with a paid order · redeem: spent on an offer · adjust: changed by staff
    kind: mysqlEnum("kind", ["order", "redeem", "adjust"]).notNull(),
    orderId: int("order_id").references(() => orders.id, { onDelete: "set null" }),
    discountCodeId: int("discount_code_id").references(() => discountCodes.id, { onDelete: "set null" }),
    adminId: int("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
    note: varchar("note", { length: 255 }).notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("loyalty_ledger_customer_idx").on(t.customerId), index("loyalty_ledger_order_idx").on(t.orderId)],
);

/* ───────────── Settings & audit ───────────── */

export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 80 }).primaryKey(),
  value: jsonCol<unknown>("value").notNull(),
  updatedAt: updatedAt(),
});

export const activityLog = mysqlTable(
  "activity_log",
  {
    id: id(),
    adminId: int("admin_id").references(() => adminUsers.id, { onDelete: "set null" }),
    action: varchar("action", { length: 60 }).notNull(),
    entity: varchar("entity", { length: 40 }).notNull(),
    entityId: varchar("entity_id", { length: 40 }),
    summary: varchar("summary", { length: 255 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("activity_log_created_idx").on(t.createdAt)],
);
