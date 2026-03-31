import {
  pgTable,
  uuid,
  text,
  timestamp,
  varchar,
  real,
  integer,
  jsonb,
  numeric,
  boolean,
  index,
  uniqueIndex,
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
    armId: text("arm_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_azure_resources_project").on(t.projectId),
    index("idx_azure_resources_type").on(t.type),
  ],
);

// ─── Azure Resource Relationships (Migration Advisor v2) ─────────────────────

export const azureResourceRelationships = pgTable(
  "azure_resource_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    projectId: uuid("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    sourceResourceId: uuid("source_resource_id")
      .notNull()
      .references(() => azureResources.id, { onDelete: "cascade" }),
    targetResourceId: uuid("target_resource_id")
      .notNull()
      .references(() => azureResources.id, { onDelete: "cascade" }),
    relationType: varchar("relation_type", { length: 50 }).notNull(),
    confidence: varchar("confidence", { length: 20 }).notNull(),
    method: varchar("method", { length: 30 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_rel_project").on(t.projectId),
    index("idx_rel_source").on(t.sourceResourceId),
    index("idx_rel_target").on(t.targetResourceId),
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


// ─── CFM Accounts ────────────────────────────────────────────────────────────

export const cfmAccounts = pgTable(
  "cfm_accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    accountName: text("account_name").notNull(),
    awsAccountId: varchar("aws_account_id", { length: 12 }).notNull(),
    roleArn: text("role_arn").notNull(),
    externalId: text("external_id"),
    regions: jsonb("regions").notNull().$type<string[]>(),
    services: jsonb("services").notNull().$type<string[]>(),
    lastScanAt: timestamp("last_scan_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_cfm_accounts_user").on(t.userId),
    uniqueIndex("idx_cfm_accounts_user_aws").on(t.userId, t.awsAccountId),
  ],
);

// ─── CFM Scans ───────────────────────────────────────────────────────────────

export const cfmScans = pgTable(
  "cfm_scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => cfmAccounts.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    summary: jsonb("summary"),
    azureConversationId: text("azure_conversation_id"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (t) => [
    index("idx_cfm_scans_account").on(t.accountId),
    index("idx_cfm_scans_user_created").on(t.userId, t.createdAt),
    index("idx_cfm_scans_account_completed").on(t.accountId, t.completedAt),
  ],
);

// ─── CFM Recommendations ─────────────────────────────────────────────────────

export const cfmRecommendations = pgTable(
  "cfm_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scanId: uuid("scan_id")
      .notNull()
      .references(() => cfmScans.id, { onDelete: "cascade" }),
    service: varchar("service", { length: 50 }).notNull(),
    resourceId: text("resource_id").notNull(),
    resourceName: text("resource_name"),
    priority: varchar("priority", { length: 10 }).notNull(),
    recommendation: text("recommendation").notNull(),
    currentCost: numeric("current_cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    estimatedSavings: numeric("estimated_savings", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    effort: varchar("effort", { length: 10 }).notNull(),
    metadata: jsonb("metadata").notNull().default("{}"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_cfm_rec_scan").on(t.scanId),
    index("idx_cfm_rec_scan_service").on(t.scanId, t.service),
    index("idx_cfm_rec_scan_priority").on(t.scanId, t.priority),
  ],
);

// ─── CFM Recommendation Tracking (Lifecycle) ────────────────────────────────

export const cfmRecommendationTracking = pgTable(
  "cfm_recommendation_tracking",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => cfmAccounts.id, { onDelete: "cascade" }),
    resourceId: text("resource_id").notNull(),
    service: varchar("service", { length: 50 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("open"),
    firstSeenScanId: uuid("first_seen_scan_id")
      .notNull()
      .references(() => cfmScans.id, { onDelete: "set null" }),
    lastSeenScanId: uuid("last_seen_scan_id").references(() => cfmScans.id, {
      onDelete: "set null",
    }),
    acknowledgedAt: timestamp("acknowledged_at"),
    implementedAt: timestamp("implemented_at"),
    verifiedAt: timestamp("verified_at"),
    verifiedScanId: uuid("verified_scan_id").references(() => cfmScans.id, {
      onDelete: "set null",
    }),
    notes: text("notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_cfm_tracking_account").on(t.accountId),
    index("idx_cfm_tracking_account_status").on(t.accountId, t.status),
    uniqueIndex("idx_cfm_tracking_account_resource").on(
      t.accountId,
      t.resourceId,
      t.service,
    ),
  ],
);

// ─── CFM Schedules ──────────────────────────────────────────────────────────

export const cfmSchedules = pgTable(
  "cfm_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .notNull()
      .references(() => cfmAccounts.id, { onDelete: "cascade" })
      .unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    frequency: varchar("frequency", { length: 10 }).notNull(),
    dayOfWeek: integer("day_of_week"),
    dayOfMonth: integer("day_of_month"),
    hour: integer("hour").notNull().default(6),
    enabled: boolean("enabled").notNull().default(true),
    lastRunAt: timestamp("last_run_at"),
    nextRunAt: timestamp("next_run_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("idx_cfm_schedules_account").on(t.accountId),
    index("idx_cfm_schedules_next_run").on(t.enabled, t.nextRunAt),
  ],
);
