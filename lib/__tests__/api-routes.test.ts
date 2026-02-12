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

// Must use vi.hoisted so the mock object is available when vi.mock factory runs
const mockPrisma = vi.hoisted(() => ({
  project: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  azureResource: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    create: vi.fn(),
  },
  mappingRecommendation: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
}));

vi.mock("@/lib/db/client", () => ({
  prisma: mockPrisma,
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
  (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1" });
});

describe("Project routes", () => {
  it("GET /api/projects returns user projects", async () => {
    mockPrisma.project.findMany.mockResolvedValue([
      { id: "p1", name: "Test", createdById: "user-1", _count: { resources: 3 } },
    ]);

    const res = await getProjects();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
    expect(mockPrisma.project.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { createdById: "user-1" } })
    );
  });

  it("POST /api/projects creates a project", async () => {
    mockPrisma.project.create.mockResolvedValue({
      id: "p1", name: "New Project", customerName: "", notes: "", createdById: "user-1",
    });

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
    mockPrisma.project.findFirst.mockResolvedValue({ id: "p1", name: "Test", createdById: "user-1" });
    mockPrisma.project.delete.mockResolvedValue({});

    const res = await deleteProject(makeRequest(), makeParams("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.deleted).toBe(true);
  });

  it("DELETE returns 404 for non-owned project", async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const res = await deleteProject(makeRequest(), makeParams("p999"));
    expect(res.status).toBe(404);
  });
});

describe("Resource routes", () => {
  it("GET returns resources for owned project", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "p1", createdById: "user-1" });
    mockPrisma.azureResource.findMany.mockResolvedValue([
      { id: "r1", name: "vm-1", type: "microsoft.compute/virtualmachines" },
    ]);

    const res = await getResources(makeRequest(), makeParams("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
  });

  it("POST imports JSON resources", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "p1", createdById: "user-1" });
    mockPrisma.azureResource.createMany.mockResolvedValue({ count: 2 });

    const res = await importResources(
      makeRequest({
        mode: "json",
        data: [
          { name: "vm-1", type: "microsoft.compute/virtualmachines" },
          { name: "storage-1", type: "microsoft.storage/storageaccounts" },
        ],
      }),
      makeParams("p1")
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.count).toBe(2);
  });

  it("POST rejects invalid JSON import", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "p1", createdById: "user-1" });

    const res = await importResources(
      makeRequest({ mode: "json", data: "not-an-array" }),
      makeParams("p1")
    );
    expect(res.status).toBe(400);
  });

  it("POST imports manual resource", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "p1", createdById: "user-1" });
    mockPrisma.azureResource.create.mockResolvedValue({
      id: "r1", name: "vm-1", type: "microsoft.compute/virtualmachines",
    });

    const res = await importResources(
      makeRequest({
        mode: "manual",
        name: "vm-1",
        type: "microsoft.compute/virtualmachines",
      }),
      makeParams("p1")
    );
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.data.name).toBe("vm-1");
  });

  it("returns 404 for non-owned project", async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const res = await getResources(makeRequest(), makeParams("p999"));
    expect(res.status).toBe(404);
  });
});

describe("Mapping routes", () => {
  it("GET returns resources with recommendations", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "p1", createdById: "user-1" });
    mockPrisma.azureResource.findMany.mockResolvedValue([
      {
        id: "r1", name: "vm-1", type: "microsoft.compute/virtualmachines",
        recommendations: [{ awsService: "Amazon EC2", confidence: "High" }],
      },
    ]);

    const res = await getMappings(makeRequest(), makeParams("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toHaveLength(1);
  });

  it("POST runs mapping engine", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "p1", createdById: "user-1" });
    mockPrisma.azureResource.findMany.mockResolvedValue([
      { id: "r1", name: "vm-1", type: "microsoft.compute/virtualmachines", kind: null, sku: null },
    ]);
    mockPrisma.mappingRecommendation.deleteMany.mockResolvedValue({});
    mockPrisma.mappingRecommendation.createMany.mockResolvedValue({ count: 1 });

    const res = await runMapping(makeRequest(), makeParams("p1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.mappedCount).toBe(1);
    expect(mockPrisma.mappingRecommendation.createMany).toHaveBeenCalled();
  });

  it("POST returns 400 when no resources", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({ id: "p1", createdById: "user-1" });
    mockPrisma.azureResource.findMany.mockResolvedValue([]);

    const res = await runMapping(makeRequest(), makeParams("p1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-owned project", async () => {
    mockPrisma.project.findFirst.mockResolvedValue(null);

    const res = await getMappings(makeRequest(), makeParams("p999"));
    expect(res.status).toBe(404);
  });
});
