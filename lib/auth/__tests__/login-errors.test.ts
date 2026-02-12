import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock next/headers cookies
const mockCookieSet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    set: mockCookieSet,
    get: vi.fn(),
  }),
}));

// Mock Prisma
const mockFindUnique = vi.fn();
const mockCreate = vi.fn();
vi.mock("@/lib/db/client", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mockFindUnique(...args) },
    auditEvent: { create: (...args: unknown[]) => mockCreate(...args) },
  },
}));

// Mock password verification
const mockVerify = vi.fn();
vi.mock("@/lib/auth/password", () => ({
  verifyPassword: (...args: unknown[]) => mockVerify(...args),
}));

// Mock session creation
vi.mock("@/lib/auth/session", () => ({
  createSession: vi.fn().mockResolvedValue({
    token: "test-token",
    expiresAt: new Date(),
  }),
}));

// Mock rate limiter
vi.mock("@/lib/auth/rate-limit", () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}));

// Mock cookie module
vi.mock("@/lib/auth/cookie", () => ({
  SESSION_COOKIE_NAME: "session_token",
  SESSION_COOKIE_OPTIONS: {},
}));

/**
 * Feature: cold-plane-mvp, Property 5: Generic error message for invalid credentials
 * Validates: Requirements 2.2
 *
 * For any login attempt with an incorrect password and for any login attempt
 * with a non-existent username, the returned error message SHALL be identical
 * (generic "Invalid credentials").
 */
describe("Property 5: Generic error message for invalid credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({});
  });

  it("non-existent username and wrong password return identical error", async () => {
    // Dynamic import after mocks are set up
    const { POST } = await import(
      "@/app/api/auth/login/route"
    );

    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.string({ minLength: 8, maxLength: 30 }),
        async (username, password) => {
          // Scenario 1: non-existent username
          mockFindUnique.mockResolvedValueOnce(null);

          const req1 = new Request("http://localhost/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });

          const res1 = await POST(req1);
          const body1 = await res1.json();

          // Scenario 2: existing user, wrong password
          mockFindUnique.mockResolvedValueOnce({
            id: "user-1",
            username,
            passwordHash: "$2b$12$fakehash",
          });
          mockVerify.mockResolvedValueOnce(false);

          const req2 = new Request("http://localhost/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
          });

          const res2 = await POST(req2);
          const body2 = await res2.json();

          // Both must return 401 with identical error message
          expect(res1.status).toBe(401);
          expect(res2.status).toBe(401);
          expect(body1.error).toBe("Invalid credentials");
          expect(body2.error).toBe("Invalid credentials");
          expect(body1.error).toBe(body2.error);
        }
      ),
      { numRuns: 100 }
    );
  });
});
