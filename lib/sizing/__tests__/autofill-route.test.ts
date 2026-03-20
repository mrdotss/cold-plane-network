import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock next/headers cookies
const mockCookieGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (...args: unknown[]) => mockCookieGet(...args),
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

// Mock Azure identity
vi.mock("@azure/identity", () => ({
  DefaultAzureCredential: vi.fn(),
  ClientSecretCredential: vi.fn(),
}));

// Mock agent client — callAgentSync
vi.mock("@/lib/sizing/agent-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/sizing/agent-client")>();
  return {
    ...actual,
    callAgentSync: vi.fn(),
  };
});

import { POST } from "@/app/api/sizing/autofill/route";
import { validateSession } from "@/lib/auth/session";
import { callAgentSync } from "@/lib/sizing/agent-client";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/sizing/autofill", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieGet.mockReturnValue({ value: "valid-token" });
  (validateSession as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: "user-1" });
});

describe("POST /api/sizing/autofill", () => {
  it("returns 401 when unauthenticated", async () => {
    mockCookieGet.mockReturnValue(undefined);

    const res = await POST(makeRequest({
      services: [{ serviceName: "EC2", description: "m5.xlarge", region: "US East", configurationSummary: "Linux" }],
      inputTier: "onDemand",
      missingTiers: ["ri1Year"],
    }));

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 400 for invalid body", async () => {
    const res = await POST(makeRequest({
      services: [],
      inputTier: "invalidTier",
      missingTiers: [],
    }));

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Validation failed");
  });

  it("returns 200 JSON with valid agent response", async () => {
    const agentResponse = JSON.stringify({
      services: [{
        service: "Amazon EC2",
        description: "m5.xlarge",
        region: "US East (N. Virginia)",
        ri1Year: { upfront: 500, monthly: 30 },
      }],
    });
    (callAgentSync as ReturnType<typeof vi.fn>).mockResolvedValue(agentResponse);

    const res = await POST(makeRequest({
      services: [{ serviceName: "Amazon EC2", description: "m5.xlarge", region: "US East (N. Virginia)", configurationSummary: "Linux, m5.xlarge" }],
      inputTier: "onDemand",
      missingTiers: ["ri1Year"],
    }));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.services).toHaveLength(1);
    expect(json.services[0].ri1Year.monthly).toBe(30);
  });

  it("returns 502 when agent returns invalid JSON", async () => {
    (callAgentSync as ReturnType<typeof vi.fn>).mockResolvedValue("not valid json at all");

    const res = await POST(makeRequest({
      services: [{ serviceName: "EC2", description: "m5", region: "US East", configurationSummary: "test" }],
      inputTier: "onDemand",
      missingTiers: ["ri1Year"],
    }));

    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toContain("no valid pricing data");
  });
});
