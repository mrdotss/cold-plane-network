import { describe, it, expect } from "vitest";
import { getTableName, getTableColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  users,
  sessions,
  auditEvents,
  projects,
  azureResources,
  azureResourceRelationships,
  mappingRecommendations,
  sizingReports,
  chats,
  chatMessages,
} from "../schema";

const ALL_TABLES = {
  users,
  sessions,
  auditEvents,
  projects,
  azureResources,
  azureResourceRelationships,
  mappingRecommendations,
  sizingReports,
  chats,
  chatMessages,
} as const;

describe("Drizzle schema — table definitions", () => {
  it("defines exactly 10 tables", () => {
    expect(Object.keys(ALL_TABLES)).toHaveLength(10);
  });

  it.each([
    ["users", "users"],
    ["sessions", "sessions"],
    ["auditEvents", "audit_events"],
    ["projects", "projects"],
    ["azureResources", "azure_resources"],
    ["azureResourceRelationships", "azure_resource_relationships"],
    ["mappingRecommendations", "mapping_recommendations"],
    ["sizingReports", "sizing_reports"],
    ["chats", "chat"],
    ["chatMessages", "chat_message"],
  ])("%s maps to SQL table %s", (key, expectedSqlName) => {
    const table = ALL_TABLES[key as keyof typeof ALL_TABLES];
    expect(getTableName(table)).toBe(expectedSqlName);
  });
});

describe("Drizzle schema — column definitions", () => {
  it("users has correct columns", () => {
    const cols = getTableColumns(users);
    expect(Object.keys(cols)).toEqual(["id", "username", "passwordHash", "createdAt"]);
    expect(cols.id.dataType).toBe("string"); // uuid
    expect(cols.id.notNull).toBe(true);
    expect(cols.username.notNull).toBe(true);
    expect(cols.username.isUnique).toBe(true);
    expect(cols.passwordHash.notNull).toBe(true);
    expect(cols.createdAt.notNull).toBe(true);
    expect(cols.createdAt.hasDefault).toBe(true);
  });

  it("sessions has correct columns", () => {
    const cols = getTableColumns(sessions);
    expect(Object.keys(cols)).toEqual(["id", "token", "userId", "expiresAt", "createdAt"]);
    expect(cols.token.isUnique).toBe(true);
    expect(cols.token.notNull).toBe(true);
    expect(cols.userId.notNull).toBe(true);
    expect(cols.expiresAt.notNull).toBe(true);
  });

  it("auditEvents has correct columns", () => {
    const cols = getTableColumns(auditEvents);
    expect(Object.keys(cols)).toEqual([
      "id", "userId", "eventType", "metadata", "ipAddress", "userAgent", "createdAt",
    ]);
    expect(cols.eventType.notNull).toBe(true);
    expect(cols.metadata.hasDefault).toBe(true);
    expect(cols.ipAddress.notNull).toBe(false);
    expect(cols.userAgent.notNull).toBe(false);
  });

  it("projects has correct columns including updatedAt", () => {
    const cols = getTableColumns(projects);
    expect(Object.keys(cols)).toEqual([
      "id", "name", "customerName", "notes", "createdById", "createdAt", "updatedAt",
    ]);
    expect(cols.customerName.hasDefault).toBe(true);
    expect(cols.notes.hasDefault).toBe(true);
    expect(cols.updatedAt.notNull).toBe(true);
  });

  it("azureResources has correct columns", () => {
    const cols = getTableColumns(azureResources);
    expect(Object.keys(cols)).toEqual([
      "id", "projectId", "subscriptionId", "resourceGroup", "name", "type",
      "kind", "location", "sku", "tags", "raw", "armId", "createdAt",
    ]);
    expect(cols.name.notNull).toBe(true);
    expect(cols.type.notNull).toBe(true);
    expect(cols.kind.notNull).toBe(false);
    expect(cols.tags.hasDefault).toBe(true);
    expect(cols.raw.hasDefault).toBe(true);
    expect(cols.armId.notNull).toBe(false);
  });

  it("azureResourceRelationships has correct columns", () => {
    const cols = getTableColumns(azureResourceRelationships);
    expect(Object.keys(cols)).toEqual([
      "id", "projectId", "sourceResourceId", "targetResourceId",
      "relationType", "confidence", "method", "createdAt",
    ]);
    expect(cols.relationType.notNull).toBe(true);
    expect(cols.confidence.notNull).toBe(true);
    expect(cols.method.notNull).toBe(true);
    expect(cols.createdAt.hasDefault).toBe(true);
  });

  it("mappingRecommendations has correct columns", () => {
    const cols = getTableColumns(mappingRecommendations);
    expect(Object.keys(cols)).toEqual([
      "id", "azureResourceId", "awsService", "awsCategory", "confidence",
      "rationale", "migrationNotes", "alternatives", "createdAt",
    ]);
    expect(cols.awsService.notNull).toBe(true);
    expect(cols.confidence.notNull).toBe(true);
    expect(cols.migrationNotes.hasDefault).toBe(true);
    expect(cols.alternatives.hasDefault).toBe(true);
  });

  it("sizingReports has correct columns with numeric defaults", () => {
    const cols = getTableColumns(sizingReports);
    expect(Object.keys(cols)).toEqual([
      "id", "userId", "fileName", "reportType", "region",
      "totalMonthly", "totalAnnual", "serviceCount", "metadata", "createdAt",
    ]);
    expect(cols.totalMonthly.hasDefault).toBe(true);
    expect(cols.totalAnnual.hasDefault).toBe(true);
    expect(cols.serviceCount.hasDefault).toBe(true);
    expect(cols.metadata.hasDefault).toBe(true);
  });

  it("chats has correct columns including updatedAt", () => {
    const cols = getTableColumns(chats);
    expect(Object.keys(cols)).toEqual([
      "id", "userId", "title", "azureConversationId", "createdAt", "updatedAt",
    ]);
    expect(cols.title.hasDefault).toBe(true);
    expect(cols.azureConversationId.notNull).toBe(false);
    expect(cols.updatedAt.notNull).toBe(true);
  });

  it("chatMessages has correct columns with JSONB attachments", () => {
    const cols = getTableColumns(chatMessages);
    expect(Object.keys(cols)).toEqual(["id", "chatId", "role", "content", "attachments", "createdAt"]);
    expect(cols.role.notNull).toBe(true);
    expect(cols.content.notNull).toBe(true);
    expect(cols.attachments.notNull).toBe(true);
    expect(cols.attachments.hasDefault).toBe(true);
    expect(cols.attachments.columnType).toBe("PgJsonb");
  });
});

describe("Drizzle schema — indexes", () => {
  it("sessions has indexes on token and userId", () => {
    const config = getTableConfig(sessions);
    const indexNames = config.indexes.map((i) => i.config.name);
    expect(indexNames).toContain("idx_sessions_token");
    expect(indexNames).toContain("idx_sessions_user_id");
  });

  it("auditEvents has composite indexes", () => {
    const config = getTableConfig(auditEvents);
    const indexNames = config.indexes.map((i) => i.config.name);
    expect(indexNames).toContain("idx_audit_user_created");
    expect(indexNames).toContain("idx_audit_event_created");
  });

  it("projects has index on createdById", () => {
    const config = getTableConfig(projects);
    const indexNames = config.indexes.map((i) => i.config.name);
    expect(indexNames).toContain("idx_projects_created_by");
  });

  it("azureResources has indexes on projectId and type", () => {
    const config = getTableConfig(azureResources);
    const indexNames = config.indexes.map((i) => i.config.name);
    expect(indexNames).toContain("idx_azure_resources_project");
    expect(indexNames).toContain("idx_azure_resources_type");
  });

  it("azureResourceRelationships has indexes on projectId, source, and target", () => {
    const config = getTableConfig(azureResourceRelationships);
    const indexNames = config.indexes.map((i) => i.config.name);
    expect(indexNames).toContain("idx_rel_project");
    expect(indexNames).toContain("idx_rel_source");
    expect(indexNames).toContain("idx_rel_target");
  });

  it("mappingRecommendations has index on azureResourceId", () => {
    const config = getTableConfig(mappingRecommendations);
    const indexNames = config.indexes.map((i) => i.config.name);
    expect(indexNames).toContain("idx_mapping_rec_resource");
  });

  it("sizingReports has composite index on userId + createdAt", () => {
    const config = getTableConfig(sizingReports);
    const indexNames = config.indexes.map((i) => i.config.name);
    expect(indexNames).toContain("idx_sizing_user_created");
  });

  it("chats has indexes on userId and updatedAt", () => {
    const config = getTableConfig(chats);
    const indexNames = config.indexes.map((i) => i.config.name);
    expect(indexNames).toContain("idx_chat_user_id");
    expect(indexNames).toContain("idx_chat_updated_at");
  });

  it("chatMessages has index on chatId", () => {
    const config = getTableConfig(chatMessages);
    const indexNames = config.indexes.map((i) => i.config.name);
    expect(indexNames).toContain("idx_chat_message_chat_id");
  });
});

describe("Drizzle schema — foreign keys", () => {
  it("sessions references users", () => {
    const config = getTableConfig(sessions);
    expect(config.foreignKeys.length).toBeGreaterThanOrEqual(1);
    const fk = config.foreignKeys.find((f) =>
      f.reference().foreignColumns.some((c) => getTableName(c.table) === "users"),
    );
    expect(fk).toBeDefined();
  });

  it("auditEvents references users", () => {
    const config = getTableConfig(auditEvents);
    const fk = config.foreignKeys.find((f) =>
      f.reference().foreignColumns.some((c) => getTableName(c.table) === "users"),
    );
    expect(fk).toBeDefined();
  });

  it("projects references users via createdById", () => {
    const config = getTableConfig(projects);
    const fk = config.foreignKeys.find((f) =>
      f.reference().foreignColumns.some((c) => getTableName(c.table) === "users"),
    );
    expect(fk).toBeDefined();
  });

  it("azureResources references projects with cascade delete", () => {
    const config = getTableConfig(azureResources);
    const fk = config.foreignKeys.find((f) =>
      f.reference().foreignColumns.some((c) => getTableName(c.table) === "projects"),
    );
    expect(fk).toBeDefined();
    expect(fk!.onDelete).toBe("cascade");
  });

  it("mappingRecommendations references azureResources with cascade delete", () => {
    const config = getTableConfig(mappingRecommendations);
    const fk = config.foreignKeys.find((f) =>
      f.reference().foreignColumns.some((c) => getTableName(c.table) === "azure_resources"),
    );
    expect(fk).toBeDefined();
    expect(fk!.onDelete).toBe("cascade");
  });

  it("azureResourceRelationships references projects with cascade delete", () => {
    const config = getTableConfig(azureResourceRelationships);
    const fk = config.foreignKeys.find((f) =>
      f.reference().foreignColumns.some((c) => getTableName(c.table) === "projects"),
    );
    expect(fk).toBeDefined();
    expect(fk!.onDelete).toBe("cascade");
  });

  it("azureResourceRelationships references azureResources for source and target with cascade delete", () => {
    const config = getTableConfig(azureResourceRelationships);
    const azureFks = config.foreignKeys.filter((f) =>
      f.reference().foreignColumns.some((c) => getTableName(c.table) === "azure_resources"),
    );
    expect(azureFks).toHaveLength(2);
    azureFks.forEach((fk) => expect(fk.onDelete).toBe("cascade"));
  });

  it("sizingReports references users", () => {
    const config = getTableConfig(sizingReports);
    const fk = config.foreignKeys.find((f) =>
      f.reference().foreignColumns.some((c) => getTableName(c.table) === "users"),
    );
    expect(fk).toBeDefined();
  });

  it("chats references users", () => {
    const config = getTableConfig(chats);
    const fk = config.foreignKeys.find((f) =>
      f.reference().foreignColumns.some((c) => getTableName(c.table) === "users"),
    );
    expect(fk).toBeDefined();
  });

  it("chatMessages references chats with cascade delete", () => {
    const config = getTableConfig(chatMessages);
    const fk = config.foreignKeys.find((f) =>
      f.reference().foreignColumns.some((c) => getTableName(c.table) === "chat"),
    );
    expect(fk).toBeDefined();
    expect(fk!.onDelete).toBe("cascade");
  });
});

describe("Drizzle schema — UUID primary keys with defaultRandom", () => {
  it.each(Object.entries(ALL_TABLES))("%s has UUID primary key with default", (_, table) => {
    const cols = getTableColumns(table);
    expect(cols.id).toBeDefined();
    expect(cols.id.primary).toBe(true);
    expect(cols.id.hasDefault).toBe(true);
    expect(cols.id.dataType).toBe("string"); // UUID maps to string dataType
  });
});
