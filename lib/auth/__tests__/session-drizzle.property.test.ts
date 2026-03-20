import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// Mock server-only
vi.mock("server-only", () => ({}));

// In-memory session store for testing round-trip behavior
let sessionStore: Map<string, { id: string; token: string; userId: string; expiresAt: Date; createdAt: Date }>;

const mockInsert = vi.fn();
const mockSelectFrom = vi.fn();
const mockDeleteWhere = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: (...args: unknown[]) => mockInsert(...args),
    select: () => ({
      from: (...args: unknown[]) => mockSelectFrom(...args),
    }),
    delete: () => ({
      where: (...args: unknown[]) => mockDeleteWhere(...args),
    }),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  sessions: { __table: "sessions" },
}));

vi.mock("drizzle-orm", () => ({
  eq: (_col: unknown, val: unknown) => ({ _eqVal: val }),
}));

import { createSession, validateSession, destroySession } from "../session";

beforeEach(() => {
  sessionStore = new Map();
  mockInsert.mockReset();
  mockSelectFrom.mockReset();
  mockDeleteWhere.mockReset();

  // Mock insert: store the session in memory
  mockInsert.mockImplementation(() => ({
    values: (data: { token: string; userId: string; expiresAt: Date }) => {
      const id = `sess-${Math.random().toString(36).slice(2)}`;
      sessionStore.set(data.token, {
        id,
        token: data.token,
        userId: data.userId,
        expiresAt: data.expiresAt,
        createdAt: new Date(),
      });
      return Promise.resolve();
    },
  }));

  // Mock select: look up session by token from the eq() filter
  mockSelectFrom.mockImplementation(() => ({
    where: (condition: { _eqVal: string }) => ({
      limit: () => {
        const token = condition._eqVal;
        const session = sessionStore.get(token);
        return Promise.resolve(session ? [session] : []);
      },
    }),
  }));

  // Mock delete: remove session by token or id from the eq() filter
  mockDeleteWhere.mockImplementation((condition: { _eqVal: string }) => {
    const val = condition._eqVal;
    // Could be deleting by token or by id
    for (const [token, session] of sessionStore.entries()) {
      if (session.token === val || session.id === val) {
        sessionStore.delete(token);
        break;
      }
    }
    return Promise.resolve();
  });
});

/**
 * Feature: sizing-v2-chatbot, Property 1: Session create-validate round-trip
 * Validates: Requirements 2.1, 2.2
 *
 * For any valid userId, creating a session and then validating the returned
 * token SHALL return the same userId.
 */
describe("Property 1: Session create-validate round-trip", () => {
  it("createSession then validateSession returns the same userId", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (userId) => {
          const { token } = await createSession(userId);

          // Token should be a non-empty hex string
          expect(token).toBeTruthy();
          expect(token.length).toBeGreaterThanOrEqual(64); // 32 bytes = 64 hex chars

          const result = await validateSession(token);
          expect(result).not.toBeNull();
          expect(result!.userId).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("validateSession returns null for unknown tokens", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[0-9a-f]{64}$/),
        async (randomToken) => {
          const result = await validateSession(randomToken);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Feature: sizing-v2-chatbot, Property 2: Session destroy invalidates token
 * Validates: Requirements 2.4
 *
 * For any created session, destroying it and then validating the token
 * SHALL return null.
 */
describe("Property 2: Session destroy invalidates token", () => {
  it("destroySession then validateSession returns null", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        async (userId) => {
          const { token } = await createSession(userId);

          // Verify session exists
          const before = await validateSession(token);
          expect(before).not.toBeNull();

          // Destroy the session
          await destroySession(token);

          // Verify session is gone
          const after = await validateSession(token);
          expect(after).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});
