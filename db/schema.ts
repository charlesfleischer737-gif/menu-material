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
  menuDraft: text("menu_draft").notNull().default('{"sections":[]}'),
  published: text(),
  publishedAt: integer("published_at"),
  createdAt: integer("created_at").notNull(),
});
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
    status: text().notNull().default("queued"),
    responseId: text("response_id"),
    assetId: text("asset_id"),
    attempts: integer().notNull().default(0),
    leaseUntil: integer("lease_until").notNull().default(0),
    leaseToken: text("lease_token"),
    error: text(),
    usage: text(),
    costEstimate: real("cost_estimate"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    uniqueIndex("idx_outputs_slot").on(t.jobId, t.slot),
    index("idx_outputs_restaurant_status").on(t.restaurantId, t.status),
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
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("idx_batch_restaurant").on(t.restaurantId),
    uniqueIndex("idx_batch_dish").on(t.batchId, t.dishId),
  ],
);
