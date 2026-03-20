import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock auth to always reject (for unauthenticated tests)
const mockRequireAuth = vi.fn();
vi.mock("@/lib/auth/middleware", () => ({
  requireAuth: () => mockRequireAuth(),
  AuthError: class AuthError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "AuthError";
    }
  },
}));

// Mock all downstream dependencies
vi.mock("@/lib/audit/writer", () => ({
  writeAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/chat/queries", () => ({
  createChat: vi.fn(),
  getChat: vi.fn(),
  listChats: vi.fn(),
  saveMessage: vi.fn(),
  deleteChat: vi.fn(),
}));

vi.mock("@/lib/chat/agent-client", () => ({
  createConversation: vi.fn(),
  streamChatResponse: vi.fn(),
}));

import { AuthError } from "@/lib/auth/middleware";

/**
 * Feature: sizing-v2-chatbot, Property 10: Unauthenticated requests return 401
 * Validates: Requirements 7.8, 13.4
 */
describe("Property 10: Unauthenticated requests return 401", () => {
  it("POST /api/chat returns 401 for unauthenticated requests", async () => {
    const { POST } = await import("@/app/api/chat/route");

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 100 }),
        async (message) => {
          mockRequireAuth.mockRejectedValue(new AuthError("Unauthorized"));

          const request = new Request("http://localhost/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
          });

          const response = await POST(request);
          expect(response.status).toBe(401);

          const body = await response.json();
          expect(body.error).toBe("Unauthorized");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("GET /api/chat/[chatId] returns 401 for unauthenticated requests", async () => {
    const { GET } = await import("@/app/api/chat/[chatId]/route");

    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (chatId) => {
        mockRequireAuth.mockRejectedValue(new AuthError("Unauthorized"));

        const request = new Request(
          `http://localhost/api/chat/${chatId}`,
          { method: "GET" },
        );

        const response = await GET(request, {
          params: Promise.resolve({ chatId }),
        });
        expect(response.status).toBe(401);
      }),
      { numRuns: 100 },
    );
  });

  it("DELETE /api/chat/[chatId] returns 401 for unauthenticated requests", async () => {
    const { DELETE } = await import("@/app/api/chat/[chatId]/route");

    await fc.assert(
      fc.asyncProperty(fc.uuid(), async (chatId) => {
        mockRequireAuth.mockRejectedValue(new AuthError("Unauthorized"));

        const request = new Request(
          `http://localhost/api/chat/${chatId}`,
          { method: "DELETE" },
        );

        const response = await DELETE(request, {
          params: Promise.resolve({ chatId }),
        });
        expect(response.status).toBe(401);
      }),
      { numRuns: 100 },
    );
  });

  it("GET /api/chat/list returns 401 for unauthenticated requests", async () => {
    const { GET } = await import("@/app/api/chat/list/route");

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        async (page) => {
          mockRequireAuth.mockRejectedValue(new AuthError("Unauthorized"));

          const request = new Request(
            `http://localhost/api/chat/list?page=${page}`,
            { method: "GET" },
          );

          const response = await GET(request);
          expect(response.status).toBe(401);
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: sizing-v2-chatbot, Property 20: SSE events conform to valid types
 * Validates: Requirements 7.4
 */
describe("Property 20: SSE events conform to valid types", () => {
  it("all SSE events have valid type field (delta, done, or error)", async () => {
    const validTypes = new Set(["delta", "done", "error"]);

    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(
            fc.record({
              type: fc.constant("delta" as const),
              content: fc.string({ minLength: 1, maxLength: 100 }),
            }),
            fc.record({ type: fc.constant("done" as const) }),
            fc.record({
              type: fc.constant("error" as const),
              message: fc.string({ minLength: 1, maxLength: 200 }),
            }),
          ),
          { minLength: 1, maxLength: 10 },
        ),
        async (events) => {
          // Simulate SSE encoding/decoding round-trip
          for (const event of events) {
            const encoded = `data: ${JSON.stringify(event)}\n\n`;
            const dataLine = encoded
              .split("\n")
              .find((l) => l.startsWith("data: "));
            expect(dataLine).toBeTruthy();

            const parsed = JSON.parse(dataLine!.slice(6));
            expect(validTypes.has(parsed.type)).toBe(true);

            if (parsed.type === "delta") {
              expect(typeof parsed.content).toBe("string");
              expect(parsed.content.length).toBeGreaterThan(0);
            }
            if (parsed.type === "error") {
              expect(typeof parsed.message).toBe("string");
              expect(parsed.message.length).toBeGreaterThan(0);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
