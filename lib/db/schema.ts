import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  real,
  integer,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ─── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ─── Sessions ────────────────────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    token: text("token").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_sessions_token").on(t.token),
    index("idx_sessions_user_id").on(t.userId),
  ],
);

// ─── Audit Events ────────────────────────────────────────────────────────────

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    eventType: varchar("event_type", { length: 100 }).notNull(),
    metadata: text("metadata").notNull().default("{}"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_audit_user_created").on(t.userId, t.createdAt),
    index("idx_audit_event_created").on(t.eventType, t.createdAt),
  ],
);

// ─── Projects (Migration Advisor) ────────────────────────────────────────────

export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    customerName: text("customer_name").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("idx_projects_created_by").on(t.createdById)],
);

// ─── Azure Resources (Migration Advisor) ─────────────────────────────────────

export const azureResources = pgTable(
  "azure_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id"),
    resourceGroup: text("resource_group"),
    name: text("name").notNull(),
    type: text("type").notNull(),
    kind: text("kind"),
    location: text("location"),
    sku: text("sku"),
    tags: text("tags").notNull().default("{}"),
    raw: text("raw").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_azure_resources_project").on(t.projectId),
    index("idx_azure_resources_type").on(t.type),
  ],
);

// ─── Mapping Recommendations (Migration Advisor) ─────────────────────────────

export const mappingRecommendations = pgTable(
  "mapping_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    azureResourceId: uuid("azure_resource_id")
      .notNull()
      .references(() => azureResources.id, { onDelete: "cascade" }),
    awsService: text("aws_service").notNull(),
    awsCategory: text("aws_category").notNull(),
    confidence: varchar("confidence", { length: 20 }).notNull(),
    rationale: text("rationale").notNull(),
    migrationNotes: text("migration_notes").notNull().default(""),
    alternatives: text("alternatives").notNull().default("[]"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_mapping_rec_resource").on(t.azureResourceId)],
);

// ─── Sizing Reports ──────────────────────────────────────────────────────────

export const sizingReports = pgTable(
  "sizing_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    fileName: text("file_name").notNull(),
    reportType: varchar("report_type", { length: 20 }).notNull(),
    region: text("region").notNull().default(""),
    totalMonthly: real("total_monthly").notNull().default(0),
    totalAnnual: real("total_annual").notNull().default(0),
    serviceCount: integer("service_count").notNull().default(0),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_sizing_user_created").on(t.userId, t.createdAt)],
);

// ─── Chat ────────────────────────────────────────────────────────────────────

export const chats = pgTable(
  "chat",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull().default("New Chat"),
    azureConversationId: text("azure_conversation_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_chat_user_id").on(t.userId),
    index("idx_chat_updated_at").on(t.updatedAt),
  ],
);

// Note: Unlike Prisma's @updatedAt, Drizzle requires explicit updatedAt updates.
// Every operation that modifies a chat (new message, title change) MUST explicitly
// set updatedAt = new Date() in the query.

// ─── Chat Messages ───────────────────────────────────────────────────────────

export const chatMessages = pgTable(
  "chat_message",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    content: text("content").notNull(),
    attachments: jsonb("attachments").default([]).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("idx_chat_message_chat_id").on(t.chatId)],
);
