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

// ─── Track insert values to verify armId persistence ─────────────────────────

const hoisted = vi.hoisted(() => {
  const selectResults: unknown[][] = [];
  const insertedValues: unknown[] = [];

  function nextSelect(): unknown[] {
    return selectResults.shift() ?? [];
  }

  function chain(resultFn: () => unknown): Record<string, unknown> {
    const obj: Record<string, unknown> = {};
    const methods = [
      "from", "where", "limit", "groupBy", "orderBy", "leftJoin",
      "offset", "returning",
    ];
    for (const m of methods) {
      obj[m] = (..._args: unknown[]) => chain(resultFn);
    }
    obj.values = (vals: unknown) => {
      if (Array.isArray(vals)) {
        insertedValues.push(...vals);
      } else {
        insertedValues.push(vals);
      }
      return chain(resultFn);
    };
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
    insert: (..._args: unknown[]) => chain(() => [{ id: "r-new" }]),
    delete: (..._args: unknown[]) => chain(() => undefined),
  };

  return { selectResults, insertedValues, mockDb };
});

vi.mock("@/lib/db/client", () => ({ db: hoisted.mockDb }));

vi.mock("@/lib/db/schema", () => ({
  projects: { id: "id", createdById: "createdById" },
  azureResources: { id: "id", projectId: "projectId", createdAt: "createdAt", type: "type", name: "name" },
  mappingRecommendations: { id: "id", azureResourceId: "azureResourceId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
}));

// Use real normalizeResource — this is the key: we want to verify the real
// normalization output (including armId) flows through to the DB insert.
// Do NOT mock import-utils here.

// Mock validators to pass through data as-is for JSON mode
vi.mock("@/lib/validators/resource", () => ({
  manualResourceSchema: {
    safeParse: vi.fn().mockImplementation((data: unknown) => ({
      success: true,
      data,
    })),
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

import { POST } from "@/app/api/projects/[projectId]/resources/route";
import { validateSession } from "@/lib/auth/session";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/projects/p1/resources", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const makeParams = (projectId: string) => ({
  params: Promise.resolve({ projectId }),
});

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.selectResults.length = 0;
  hoisted.insertedValues.length = 0;
  (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1" });
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/projects/[projectId]/resources — armId persistence", () => {
  it("persists armId when resource has a valid ARM ID", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check

    const armId = "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Compute/virtualMachines/myVM";
    const res = await POST(
      makeRequest({
        mode: "json",
        data: [
          {
            id: armId,
            name: "myVM",
            type: "Microsoft.Compute/virtualMachines",
            location: "eastus",
            resourceGroup: "rg-1",
            properties: { vmId: "abc-123" },
          },
        ],
      }),
      makeParams("p1"),
    );

    expect(res.status).toBe(201);
    expect(hoisted.insertedValues).toHaveLength(1);

    const inserted = hoisted.insertedValues[0] as Record<string, unknown>;
    expect(inserted.armId).toBe(armId);
    expect(inserted.subscriptionId).toBe("sub-1");
    expect(inserted.resourceGroup).toBe("rg-1");
    expect(inserted.projectId).toBe("p1");
  });

  it("persists armId as null for legacy resources without id field", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check

    const res = await POST(
      makeRequest({
        mode: "json",
        data: [
          {
            name: "legacyVM",
            type: "Microsoft.Compute/virtualMachines",
          },
        ],
      }),
      makeParams("p1"),
    );

    expect(res.status).toBe(201);
    expect(hoisted.insertedValues).toHaveLength(1);

    const inserted = hoisted.insertedValues[0] as Record<string, unknown>;
    expect(inserted.armId).toBeNull();
    expect(inserted.subscriptionId).toBeNull();
    expect(inserted.resourceGroup).toBeNull();
  });

  it("prefers explicit resourceGroup over ARM-extracted value", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check

    const res = await POST(
      makeRequest({
        mode: "json",
        data: [
          {
            id: "/subscriptions/sub-1/resourceGroups/arm-rg/providers/Microsoft.Compute/virtualMachines/vm1",
            name: "vm1",
            type: "Microsoft.Compute/virtualMachines",
            resourceGroup: "explicit-rg",
          },
        ],
      }),
      makeParams("p1"),
    );

    expect(res.status).toBe(201);
    const inserted = hoisted.insertedValues[0] as Record<string, unknown>;
    expect(inserted.resourceGroup).toBe("explicit-rg");
  });

  it("persists multiple resources with mixed ARM ID presence", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check

    const res = await POST(
      makeRequest({
        mode: "json",
        data: [
          {
            id: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Compute/virtualMachines/vm1",
            name: "vm1",
            type: "Microsoft.Compute/virtualMachines",
          },
          {
            name: "legacyNIC",
            type: "Microsoft.Network/networkInterfaces",
          },
        ],
      }),
      makeParams("p1"),
    );

    expect(res.status).toBe(201);
    expect(hoisted.insertedValues).toHaveLength(2);

    const first = hoisted.insertedValues[0] as Record<string, unknown>;
    const second = hoisted.insertedValues[1] as Record<string, unknown>;

    expect(first.armId).toBe(
      "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Compute/virtualMachines/vm1",
    );
    expect(second.armId).toBeNull();
  });

  it("includes properties in raw JSON field", async () => {
    hoisted.selectResults.push([{ id: "p1" }]); // ownership check

    const props = { vmId: "abc", hardwareProfile: { vmSize: "Standard_D2s_v3" } };
    await POST(
      makeRequest({
        mode: "json",
        data: [
          {
            id: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Compute/virtualMachines/vm1",
            name: "vm1",
            type: "Microsoft.Compute/virtualMachines",
            properties: props,
          },
        ],
      }),
      makeParams("p1"),
    );

    const inserted = hoisted.insertedValues[0] as Record<string, unknown>;
    const raw = JSON.parse(inserted.raw as string);
    expect(raw.properties).toEqual(props);
  });
});
