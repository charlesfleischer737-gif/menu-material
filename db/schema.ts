import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
export const users = sqliteTable("users", {
  id: text().primaryKey(),
  email: text().notNull().unique(),
  password: text().notNull(),
  role: text().notNull().default("owner"),
  createdAt: integer("created_at").notNull(),
});
export const sessions = sqliteTable("sessions", {
  hash: text().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  expiresAt: integer("expires_at").notNull(),
});
export const invites = sqliteTable("invites", {
  hash: text().primaryKey(),
  email: text().notNull(),
  role: text().notNull().default("owner"),
  allowance: integer().notNull().default(20),
  expiresAt: integer("expires_at").notNull(),
  usedBy: text("used_by"),
  createdAt: integer("created_at").notNull(),
});
export const restaurants = sqliteTable("restaurants", {
  id: text().primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id),
  name: text().notNull(),
  cuisine: text().notNull().default(""),
  brand: text().notNull().default(""),
  style: text().notNull().default("{}"),
  timezone: text().notNull().default("America/New_York"),
  orderingUrl: text("ordering_url").notNull().default(""),
  hours: text().notNull().default("[]"),
  logoId: text("logo_id"),
  slug: text().notNull().unique(),
  currency: text().notNull().default("USD"),
  allowance: integer().notNull().default(20),
  paused: integer().notNull().default(0),
  dailyBudgetCents: integer("daily_budget_cents").notNull().default(2000),
  menuDraft: text("menu_draft").notNull().default('{"sections":[]}'),
  published: text(),
  publishedAt: integer("published_at"),
  createdAt: integer("created_at").notNull(),
});
export const billingAccounts = sqliteTable("billing_accounts", {
  restaurantId: text("restaurant_id")
    .primaryKey()
    .references(() => restaurants.id),
  customerId: text("customer_id").unique(),
  subscriptionId: text("subscription_id").unique(),
  status: text().notNull().default("free"),
  cancelAtPeriodEnd: integer("cancel_at_period_end").notNull().default(0),
  checkoutId: text("checkout_id"),
  checkoutKey: text("checkout_key"),
  leaseUntil: integer("lease_until").notNull().default(0),
  leaseToken: text("lease_token"),
  syncedAt: integer("synced_at").notNull().default(0),
});
export const billingPeriods = sqliteTable(
  "billing_periods",
  {
    id: text().primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    subscriptionId: text("subscription_id").notNull(),
    invoiceId: text("invoice_id").notNull().unique(),
    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at").notNull(),
    allowance: integer().notNull().default(100),
  },
  (t) => [
    index("idx_billing_period_restaurant").on(
      t.restaurantId,
      t.startsAt,
      t.endsAt,
    ),
  ],
);
export const dishes = sqliteTable(
  "dishes",
  {
    id: text().primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    name: text().notNull(),
    description: text().notNull(),
    category: text().notNull().default("Dishes"),
    preserve: text().notNull().default(""),
    portion: text().notNull().default(""),
    plating: text().notNull().default(""),
    setting: text().notNull().default("Natural daylight"),
    price: integer().notNull().default(0),
    available: integer().notNull().default(1),
    confirmedAt: integer("confirmed_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_dishes_restaurant").on(t.restaurantId)],
);
export const assets = sqliteTable(
  "assets",
  {
    id: text().primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    dishId: text("dish_id").references(() => dishes.id),
    kind: text().notNull(),
    key: text().notNull(),
    workingKey: text("working_key"),
    mime: text().notNull(),
    name: text().notNull(),
    approvedAt: integer("approved_at"),
    deletedAt: integer("deleted_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_assets_restaurant_dish").on(t.restaurantId, t.dishId)],
);
export const creationDrafts = sqliteTable(
  "creation_drafts",
  {
    id: text().primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    kind: text().notNull(),
    draft: text().notNull(),
    revision: integer().notNull().default(1),
    name: text().notNull().default(""),
    archivedAt: integer("archived_at"),
    favorite: integer().notNull().default(0),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [
    index("idx_creation_drafts_restaurant").on(t.restaurantId),
    index("idx_drafts_kind_archive_updated").on(
      t.restaurantId,
      t.kind,
      t.archivedAt,
      t.updatedAt,
    ),
  ],
);
export const assetEdits = sqliteTable("asset_edits", {
  assetId: text("asset_id")
    .primaryKey()
    .references(() => assets.id),
  parentId: text("parent_id")
    .notNull()
    .references(() => assets.id),
  sourceId: text("source_id").references(() => assets.id),
  edits: text().notNull(),
});
export const jobs = sqliteTable(
  "jobs",
  {
    id: text().primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    dishId: text("dish_id")
      .notNull()
      .references(() => dishes.id),
    requestKey: text("request_key").notNull(),
    creditPeriod: text("credit_period").notNull().default("free"),
    fingerprint: text().notNull(),
    prompt: text().notNull(),
    details: text().notNull(),
    inputMethod: text("input_method").notNull(),
    sourceId: text("source_id"),
    parentId: text("parent_id"),
    status: text().notNull().default("queued"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_jobs_idempotency").on(t.restaurantId, t.requestKey),
    index("idx_jobs_restaurant").on(t.restaurantId),
  ],
);
export const outputs = sqliteTable(
  "outputs",
  {
    id: text().primaryKey(),
    jobId: text("job_id")
      .notNull()
      .references(() => jobs.id),
    restaurantId: text("restaurant_id").notNull(),
    slot: integer().notNull(),
    creditPeriod: text("credit_period").notNull().default("free"),
    status: text().notNull().default("queued"),
    responseId: text("response_id"),
    assetId: text("asset_id"),
    attempts: integer().notNull().default(0),
    leaseUntil: integer("lease_until").notNull().default(0),
    leaseToken: text("lease_token"),
    nextPollAt: integer("next_poll_at").notNull().default(0),
    submittedAt: integer("submitted_at"),
    pollCount: integer("poll_count").notNull().default(0),
    error: text(),
    usage: text(),
    costEstimate: real("cost_estimate"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_outputs_slot").on(t.jobId, t.slot),
    index("idx_outputs_credit_period").on(
      t.restaurantId,
      t.creditPeriod,
      t.status,
    ),
    index("idx_outputs_restaurant_status").on(t.restaurantId, t.status),
    index("idx_outputs_poll").on(t.status, t.nextPollAt, t.leaseUntil),
    index("idx_outputs_restaurant_submitted").on(t.restaurantId, t.submittedAt),
  ],
);
export const captions = sqliteTable(
  "captions",
  {
    id: text().primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    dishId: text("dish_id")
      .notNull()
      .references(() => dishes.id),
    body: text().notNull(),
    usage: text(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_captions_restaurant").on(t.restaurantId)],
);
export const events = sqliteTable(
  "events",
  {
    id: text().primaryKey(),
    restaurantId: text("restaurant_id"),
    kind: text().notNull(),
    entityId: text("entity_id"),
    details: text().notNull().default("{}"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_events_restaurant").on(t.restaurantId)],
);
export const rateLimits = sqliteTable("rate_limits", {
  key: text().primaryKey(),
  count: integer().notNull(),
  expiresAt: integer("expires_at").notNull(),
});
export const launchRequests = sqliteTable(
  "launch_requests",
  {
    id: text().primaryKey(),
    kind: text().notNull(),
    email: text().notNull(),
    restaurant: text().notNull().default(""),
    message: text().notNull().default(""),
    status: text().notNull().default("new"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("idx_launch_request_email").on(t.kind, t.email)],
);
export const appSettings = sqliteTable("app_settings", {
  key: text().primaryKey(),
  value: text().notNull(),
});
export const aiSpend = sqliteTable(
  "ai_spend",
  {
    id: text().primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    kind: text().notNull(),
    budgetDay: text("budget_day").notNull(),
    reservedCents: integer("reserved_cents").notNull(),
    status: text().notNull().default("reserved"),
    usage: text(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_spend_day_restaurant").on(t.budgetDay, t.restaurantId)],
);
export const storageReservations = sqliteTable(
  "storage_reservations",
  {
    id: text().primaryKey(),
    restaurantId: text("restaurant_id").notNull(),
    bytes: integer().notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_storage_restaurant").on(t.restaurantId)],
);
export const promotions = sqliteTable(
  "promotions",
  {
    id: text().primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    draft: text().notNull(),
    revision: integer().notNull().default(1),
    approvedHash: text("approved_hash"),
    approvedAt: integer("approved_at"),
    published: text(),
    startsAt: integer("starts_at"),
    endsAt: integer("ends_at"),
    soldOut: integer("sold_out").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("idx_promotions_restaurant").on(t.restaurantId)],
);
export const menuImports = sqliteTable(
  "menu_imports",
  {
    id: text().primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    name: text().notNull(),
    key: text(),
    mime: text(),
    draft: text().notNull().default("[]"),
    status: text().notNull().default("draft"),
    error: text(),
    usage: text(),
    readStartedAt: integer("read_started_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_imports_restaurant").on(t.restaurantId)],
);
export const staffLinks = sqliteTable(
  "staff_links",
  {
    hash: text().primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    expiresAt: integer("expires_at").notNull(),
    revokedAt: integer("revoked_at"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("idx_staff_restaurant").on(t.restaurantId)],
);
export const batchItems = sqliteTable(
  "batch_items",
  {
    id: text().primaryKey(),
    restaurantId: text("restaurant_id")
      .notNull()
      .references(() => restaurants.id),
    batchId: text("batch_id").notNull(),
    dishId: text("dish_id")
      .notNull()
      .references(() => dishes.id),
    sourceId: text("source_id"),
    jobId: text("job_id"),
    status: text().notNull().default("queued"),
    error: text(),
    settings: text().notNull().default("{}"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("idx_batch_restaurant").on(t.restaurantId),
    uniqueIndex("idx_batch_dish").on(t.batchId, t.dishId),
  ],
);
