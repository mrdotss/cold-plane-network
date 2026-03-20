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
vi.mock("@/lib/audit/writer", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

// Mock rate-limit helpers
vi.mock("@/lib/auth/rate-limit", () => ({
  checkProjectCreationLimit: vi.fn().mockReturnValue({
    allowed: true, remaining: 19, resetAt: Date.now() + 3600000,
  }),
  checkMappingEngineLimit: vi.fn().mockReturnValue({
    allowed: true, remaining: 9, resetAt: Date.now() + 3600000,
  }),
}));

// Mock mapping engine
vi.mock("@/lib/mapping-engine", () => ({
  findMapping: vi.fn().mockReturnValue({
    awsServices: [{ service: "Amazon EC2", category: "Compute" }],
    category: "Compute",
    confidence: "High",
    rationale: "Direct equivalent",
    migrationNotes: "",
    alternatives: [],
  }),
}));

// Mock validators
vi.mock("@/lib/validators/resource", () => ({
  manualResourceSchema: {
    safeParse: vi.fn().mockReturnValue({
      success: true,
      data: { name: "vm-1", type: "microsoft.compute/virtualmachines" },
    }),
  },
  importJsonSchema: {
    safeParse: vi.fn().mockImplementation((data: unknown) => {
      if (!Array.isArray(data)) {
        return { success: false, error: { issues: [{ message: "Expected array" }] } };
      }
      return { success: true, data };
    }),
  },
}));

// Mock import-utils
vi.mock("@/lib/import-utils", () => ({
  normalizeResource: vi.fn().mockImplementation((r: Record<string, unknown>) => r),
}));

// ─── Drizzle chainable mock (hoisted) ────────────────────────────────────────

const hoisted = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const insertResults: unknown[][] = [];

  function nextSelect(): unknown[] {
    return selectResults.shift() ?? [];
  }
  function nextInsert(): unknown[] {
    return insertResults.shift() ?? [];
  }

  /**
   * Build a deeply-chainable object that resolves to `resultFn()` when awaited.
   */
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
    delete: (..._args: unknown[]) => chain(() => undefined),
  };

  return { selectResults, insertResults, mockDb };
});

vi.mock("@/lib/db/client", () => ({ db: hoisted.mockDb }));

vi.mock("@/lib/db/schema", () => ({
  projects: { id: "id", name: "name", createdById: "createdById", createdAt: "createdAt", customerName: "customerName", notes: "notes", updatedAt: "updatedAt" },
  azureResources: { id: "id", projectId: "projectId", createdAt: "createdAt", type: "type", name: "name" },
  mappingRecommendations: { id: "id", azureResourceId: "azureResourceId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  count: vi.fn(),
  inArray: vi.fn(),
}));

import { GET as getProjects, POST as createProject } from "@/app/api/projects/route";
import { DELETE as deleteProject } from "@/app/api/projects/[projectId]/route";
import { GET as getResources, POST as importResources } from "@/app/api/projects/[projectId]/resources/route";
import { GET as getMappings, POST as runMapping } from "@/app/api/projects/[projectId]/mapping/route";
import { validateSession } from "@/lib/auth/session";

function makeRequest(body?: unknown): Request {
  return new Request("http://localhost:3000/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const makeParams = (projectId: string) => ({
  params: Promise.resolve({ projectId }),
});

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.selectResults.length = 0;
  hoisted.insertResults.length = 0;
  (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1" });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Project routes", () => {
  it("GET /api/projects returns user projects", async () => {
    hoisted.selectResults.push([
      { id: "p1", name: "Test", createdById: "user-1", resourceCount: 3 },
    ]);

    const res = await getProjects();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0]._count.resources).toBe(3);
  });

  it("POST /api/projects creates a project", async () => {
    hoisted.insertResults.push([
      { id: "p1", name: "New Project", customerName: "", notes: "", createdById: "user-1" },
    ]);

    const res = await createProject(makeRequest({ name: "New Project" }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.name).toBe("New Project");
  });

  it("POST /api/projects rejects empty name", async () => {
    const res = await createProject(makeRequest({ name: "" }));
    expect(res.status).toBe(400);
  });

  it("returns 401 for unauthenticated requests", async () => {
    (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await getProjects();
    expect(res.status).toBe(401);
  });
});

describe("Project delete route", () => {
  it("DELETE deletes owned project", async () => {
    hoisted.selectResults.push([{ id: "p1", name: "Test", createdById: "user-1" }]);

    const res = await deleteProject(makeRequest(), makeParams("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.deleted).toBe(true);
  });

  it("DELETE returns 404 for non-owned project", async () => {
    hoisted.selectResults.push([]);

    const res = await deleteProject(makeRequest(), makeParams("p999"));
    expect(res.status).toBe(404);
  });
});

describe("Resource routes", () => {
  it("GET returns resources for owned project", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.selectResults.push([
      { id: "r1", name: "vm-1", type: "microsoft.compute/virtualmachines" },
    ]);

    const res = await getResources(makeRequest(), makeParams("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
  });

  it("POST imports JSON resources", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.insertResults.push([{ id: "r1" }, { id: "r2" }]);

    const res = await importResources(
      makeRequest({
        mode: "json",
        data: [
          { name: "vm-1", type: "microsoft.compute/virtualmachines" },
          { name: "storage-1", type: "microsoft.storage/storageaccounts" },
        ],
      }),
      makeParams("p1"),
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.count).toBe(2);
  });

  it("POST rejects invalid JSON import", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check

    const res = await importResources(
      makeRequest({ mode: "json", data: "not-an-array" }),
      makeParams("p1"),
    );
    expect(res.status).toBe(400);
  });

  it("POST imports manual resource", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.insertResults.push([
      { id: "r1", name: "vm-1", type: "microsoft.compute/virtualmachines" },
    ]);

    const res = await importResources(
      makeRequest({
        mode: "manual",
        name: "vm-1",
        type: "microsoft.compute/virtualmachines",
      }),
      makeParams("p1"),
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.name).toBe("vm-1");
  });

  it("returns 404 for non-owned project", async () => {
    hoisted.selectResults.push([]);

    const res = await getResources(makeRequest(), makeParams("p999"));
    expect(res.status).toBe(404);
  });
});

describe("Mapping routes", () => {
  it("GET returns resources with recommendations", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.selectResults.push([
      { id: "r1", name: "vm-1", type: "microsoft.compute/virtualmachines" },
    ]); // resources
    hoisted.selectResults.push([
      { azureResourceId: "r1", awsService: "Amazon EC2", confidence: "High" },
    ]); // recommendations

    const res = await getMappings(makeRequest(), makeParams("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(json.data[0].recommendations).toHaveLength(1);
  });

  it("POST runs mapping engine", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.selectResults.push([
      { id: "r1", name: "vm-1", type: "microsoft.compute/virtualmachines", kind: null, sku: null },
    ]); // resources

    const res = await runMapping(makeRequest(), makeParams("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.mappedCount).toBe(1);
  });

  it("POST returns 400 when no resources", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check
    hoisted.selectResults.push([]); // empty resources

    const res = await runMapping(makeRequest(), makeParams("p1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-owned project", async () => {
    hoisted.selectResults.push([]);

    const res = await getMappings(makeRequest(), makeParams("p999"));
    expect(res.status).toBe(404);
  });
});
