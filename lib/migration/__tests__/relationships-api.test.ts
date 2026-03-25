import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock next/headers cookies
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "valid-token" }),
  }),
}));

// Mock session validation
vi.mock("@/lib/auth/session", () => ({
  validateSession: vi.fn().mockResolvedValue({ userId: "user-1" }),
}));

// Mock audit writer
const mockWriteAuditEvent = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/audit/writer", () => ({
  writeAuditEvent: (...args: unknown[]) => mockWriteAuditEvent(...args),
}));

// ─── Drizzle chainable mock (hoisted) ────────────────────────────────────────

const hoisted = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const insertResults: unknown[][] = [];
  const deleteCallCount = { value: 0 };

  function nextSelect(): unknown[] {
    return selectResults.shift() ?? [];
  }
  function nextInsert(): unknown[] {
    return insertResults.shift() ?? [];
  }

  function chain(resultFn: () => unknown): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    const methods = [
      "from", "where", "limit", "groupBy", "orderBy", "leftJoin",
      "offset", "values", "returning",
    ];
    for (const m of methods) {
      obj[m] = (..._args: unknown[]) => chain(resultFn);
    }
    obj.then = (
      resolve: (v: unknown) => void,
      reject?: (e: unknown) => void,
    ) => {
      try { resolve(resultFn()); } catch (e) { reject?.(e); }
    };
    return obj;
  }

  const mockDb = {
    select: (..._args: unknown[]) => chain(nextSelect),
    insert: (..._args: unknown[]) => chain(nextInsert),
    delete: (..._args: unknown[]) => {
      deleteCallCount.value++;
      return chain(() => undefined);
    },
  };

  return { selectResults, insertResults, deleteCallCount, mockDb };
});

vi.mock("@/lib/db/client", () => ({ db: hoisted.mockDb }));

vi.mock("@/lib/db/schema", () => ({
  projects: { id: "id", createdById: "createdById" },
  azureResources: { id: "id", projectId: "projectId" },
  azureResourceRelationships: { id: "id", projectId: "projectId", sourceResourceId: "sourceResourceId", targetResourceId: "targetResourceId", relationType: "relationType", confidence: "confidence", method: "method" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
}));

// Mock the relationship engine to return predictable results
const mockExtractRelationships = vi.fn();
vi.mock("@/lib/migration/relationship-engine", () => ({
  extractRelationships: (...args: unknown[]) => mockExtractRelationships(...args),
}));

import { GET, POST } from "@/app/api/projects/[projectId]/relationships/route";
import { validateSession } from "@/lib/auth/session";

function makeRequest(): Request {
  return new Request("http://localhost:3000/api/projects/p1/relationships", {
    method: "POST",
  });
}

const makeParams = (projectId: string) => ({
  params: Promise.resolve({ projectId }),
});

// ─── Sample data ─────────────────────────────────────────────────────────────

const sampleResources = [
  {
    id: "r1",
    name: "myVM",
    type: "microsoft.compute/virtualmachines",
    location: "eastus",
    resourceGroup: "rg-1",
    armId: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Compute/virtualMachines/myVM",
    raw: "{}",
  },
  {
    id: "r2",
    name: "myVM-nic",
    type: "microsoft.network/networkinterfaces",
    location: "eastus",
    resourceGroup: "rg-1",
    armId: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Network/networkInterfaces/myVM-nic",
    raw: "{}",
  },
];

const sampleExtractionResult = {
  relationships: [
    {
      sourceResourceId: "r1",
      targetResourceId: "r2",
      relationType: "network",
      confidence: "High",
      method: "name_heuristic",
    },
  ],
  stats: {
    total: 1,
    byType: { network: 1 },
    byMethod: { name_heuristic: 1 },
    byConfidence: { High: 1 },
  },
};

const samplePersistedRows = [
  {
    id: "rel-1",
    projectId: "p1",
    sourceResourceId: "r1",
    targetResourceId: "r2",
    relationType: "network",
    confidence: "High",
    method: "name_heuristic",
    createdAt: new Date(),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.selectResults.length = 0;
  hoisted.insertResults.length = 0;
  hoisted.deleteCallCount.value = 0;
  (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1" });
  mockExtractRelationships.mockReturnValue(sampleExtractionResult);
  mockWriteAuditEvent.mockResolvedValue(undefined);
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/projects/[projectId]/relationships", () => {
  it("returns relationships with stats for owned project", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.selectResults.push(samplePersistedRows); // relationship rows

    const res = await GET(makeRequest(), makeParams("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.relationships).toHaveLength(1);
    expect(json.relationships[0].id).toBe("rel-1");
    expect(json.relationships[0].relationType).toBe("network");
    expect(json.relationships[0].confidence).toBe("High");
    expect(json.relationships[0].method).toBe("name_heuristic");
    expect(json.stats.total).toBe(1);
    expect(json.stats.byType).toEqual({ network: 1 });
    expect(json.stats.byMethod).toEqual({ name_heuristic: 1 });
    expect(json.stats.byConfidence).toEqual({ High: 1 });
  });

  it("returns empty relationships when none exist", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.selectResults.push([]); // no relationships

    const res = await GET(makeRequest(), makeParams("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.relationships).toHaveLength(0);
    expect(json.stats.total).toBe(0);
  });

  it("returns 401 for unauthenticated request", async () => {
    (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await GET(makeRequest(), makeParams("p1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-owned project", async () => {
    hoisted.selectResults.push([]); // ownership check fails

    const res = await GET(makeRequest(), makeParams("p999"));
    expect(res.status).toBe(404);
  });

  it("returns correct stats grouping for multiple relationship types", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.selectResults.push([
      { id: "rel-1", sourceResourceId: "r1", targetResourceId: "r2", relationType: "network", confidence: "High", method: "name_heuristic", createdAt: new Date() },
      { id: "rel-2", sourceResourceId: "r1", targetResourceId: "r3", relationType: "storage", confidence: "Definite", method: "property_ref", createdAt: new Date() },
      { id: "rel-3", sourceResourceId: "r2", targetResourceId: "r4", relationType: "network", confidence: "Medium", method: "name_heuristic", createdAt: new Date() },
    ]);

    const res = await GET(makeRequest(), makeParams("p1"));
    const json = await res.json();

    expect(json.stats.total).toBe(3);
    expect(json.stats.byType).toEqual({ network: 2, storage: 1 });
    expect(json.stats.byMethod).toEqual({ name_heuristic: 2, property_ref: 1 });
    expect(json.stats.byConfidence).toEqual({ High: 1, Definite: 1, Medium: 1 });
  });
});

describe("POST /api/projects/[projectId]/relationships", () => {
  it("triggers extraction, persists results, and returns relationships + stats", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.selectResults.push(sampleResources); // load resources
    hoisted.insertResults.push([]); // insert relationships
    hoisted.selectResults.push(samplePersistedRows); // fetch persisted rows

    const res = await POST(makeRequest(), makeParams("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(mockExtractRelationships).toHaveBeenCalledOnce();
    expect(json.relationships).toHaveLength(1);
    expect(json.relationships[0].relationType).toBe("network");
    expect(json.stats.total).toBe(1);
  });

  it("deletes existing relationships before re-extracting", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.selectResults.push(sampleResources); // load resources
    hoisted.insertResults.push([]); // insert relationships
    hoisted.selectResults.push(samplePersistedRows); // fetch persisted rows

    await POST(makeRequest(), makeParams("p1"));

    // delete is called once (for existing relationships)
    expect(hoisted.deleteCallCount.value).toBe(1);
  });

  it("passes correct resource shape to extractRelationships", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.selectResults.push(sampleResources); // load resources
    hoisted.insertResults.push([]); // insert relationships
    hoisted.selectResults.push([]); // fetch persisted rows

    await POST(makeRequest(), makeParams("p1"));

    const callArgs = mockExtractRelationships.mock.calls[0][0];
    expect(callArgs).toHaveLength(2);
    expect(callArgs[0]).toEqual({
      id: "r1",
      name: "myVM",
      type: "microsoft.compute/virtualmachines",
      location: "eastus",
      resourceGroup: "rg-1",
      armId: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Compute/virtualMachines/myVM",
      raw: "{}",
    });
  });

  it("logs MIGRATION_RELATIONSHIP_EXTRACT audit event with correct metadata", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.selectResults.push(sampleResources); // load resources
    hoisted.insertResults.push([]); // insert relationships
    hoisted.selectResults.push(samplePersistedRows); // fetch persisted rows

    await POST(makeRequest(), makeParams("p1"));

    expect(mockWriteAuditEvent).toHaveBeenCalledOnce();
    expect(mockWriteAuditEvent).toHaveBeenCalledWith({
      userId: "user-1",
      eventType: "MIGRATION_RELATIONSHIP_EXTRACT",
      metadata: {
        projectId: "p1",
        resourceCount: 2,
        relationshipCount: 1,
        byMethod: { name_heuristic: 1 },
      },
    });
  });

  it("returns 401 for unauthenticated request", async () => {
    (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await POST(makeRequest(), makeParams("p1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 for non-owned project", async () => {
    hoisted.selectResults.push([]); // ownership check fails

    const res = await POST(makeRequest(), makeParams("p999"));
    expect(res.status).toBe(404);
  });

  it("handles empty resource list gracefully", async () => {
    mockExtractRelationships.mockReturnValue({
      relationships: [],
      stats: { total: 0, byType: {}, byMethod: {}, byConfidence: {} },
    });

    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.selectResults.push([]); // no resources
    hoisted.selectResults.push([]); // fetch persisted rows (empty)

    const res = await POST(makeRequest(), makeParams("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.relationships).toHaveLength(0);
    expect(json.stats.total).toBe(0);
  });

  it("continues even if audit event write fails", async () => {
    mockWriteAuditEvent.mockRejectedValue(new Error("Audit DB down"));

    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.selectResults.push(sampleResources); // load resources
    hoisted.insertResults.push([]); // insert relationships
    hoisted.selectResults.push(samplePersistedRows); // fetch persisted rows

    const res = await POST(makeRequest(), makeParams("p1"));
    expect(res.status).toBe(200);
  });
});
