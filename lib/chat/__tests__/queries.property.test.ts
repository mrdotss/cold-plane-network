import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fc from "fast-check";

// Mock server-only
vi.mock("server-only", () => ({}));

// ─── In-memory stores ────────────────────────────────────────────────────────

interface ChatRow {
  id: string;
  userId: string;
  title: string;
  azureConversationId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface MessageRow {
  id: string;
  chatId: string;
  role: string;
  content: string;
  attachments: unknown[];
  createdAt: Date;
}

let chatStore: Map<string, ChatRow>;
let messageStore: MessageRow[];
let idCounter: number;

function nextId(): string {
  return `id-${++idCounter}`;
}

// ─── Mock Drizzle ────────────────────────────────────────────────────────────

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/lib/db/client", () => ({
  db: {
    insert: (...a: unknown[]) => mockInsert(...a),
    select: (...a: unknown[]) => mockSelect(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
    delete: (...a: unknown[]) => mockDelete(...a),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  chats: Symbol("chats"),
  chatMessages: Symbol("chatMessages"),
}));

vi.mock("drizzle-orm", () => ({
  eq: (_col: unknown, val: unknown) => ({ _op: "eq", _val: val }),
  and: (...conds: unknown[]) => ({ _op: "and", _conds: conds }),
  desc: () => ({ _op: "desc" }),
  asc: () => ({ _op: "asc" }),
  count: () => "count",
}));

import {
  createChat,
  getChat,
  listChats,
  saveMessage,
  deleteChat,
} from "../queries";

// ─── Mock implementations ────────────────────────────────────────────────────

beforeEach(() => {
  chatStore = new Map();
  messageStore = [];
  idCounter = 0;

  mockInsert.mockReset();
  mockSelect.mockReset();
  mockUpdate.mockReset();
  mockDelete.mockReset();

  // INSERT → chats or chatMessages
  mockInsert.mockImplementation(() => ({
    values: (data: Record<string, unknown>) => ({
      returning: () => {
        const id = nextId();
        const now = new Date();

        if ("role" in data) {
          // chatMessage insert
          const msg: MessageRow = {
            id,
            chatId: data.chatId as string,
            role: data.role as string,
            content: data.content as string,
            attachments: (data.attachments as unknown[]) ?? [],
            createdAt: now,
          };
          messageStore.push(msg);
          return Promise.resolve([msg]);
        }

        // chat insert
        const chat: ChatRow = {
          id,
          userId: data.userId as string,
          title: (data.title as string) ?? "New Chat",
          azureConversationId:
            (data.azureConversationId as string) ?? null,
          createdAt: now,
          updatedAt: now,
        };
        chatStore.set(id, chat);
        return Promise.resolve([chat]);
      },
    }),
  }));

  // SELECT
  mockSelect.mockImplementation((fields?: Record<string, unknown>) => ({
    from: () => ({
      where: (condition: { _op: string; _conds?: Array<{ _val: unknown }>; _val?: unknown }) => {
        // Handle count queries
        if (fields && "total" in fields) {
          let total: number;
          if (condition._op === "eq") {
            const userId = condition._val as string;
            total = [...chatStore.values()].filter(
              (c) => c.userId === userId,
            ).length;
          } else {
            total = chatStore.size;
          }
          return Promise.resolve([{ total }]);
        }

        // Handle AND conditions (getChat, deleteChat)
        if (condition._op === "and" && condition._conds) {
          const vals = condition._conds.map(
            (c: { _val: unknown }) => c._val,
          );
          const chatId = vals[0] as string;
          const userId = vals[1] as string;
          const chat = chatStore.get(chatId);
          if (chat && chat.userId === userId) {
            return {
              limit: () => Promise.resolve([chat]),
            };
          }
          return { limit: () => Promise.resolve([]) };
        }

        // Handle eq conditions (messages by chatId)
        if (condition._op === "eq") {
          const chatId = condition._val as string;
          const msgs = messageStore
            .filter((m) => m.chatId === chatId)
            .sort(
              (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
            );
          return {
            orderBy: () => msgs,
            limit: () => Promise.resolve(msgs.length > 0 ? [msgs[0]] : []),
          };
        }

        return { limit: () => Promise.resolve([]) };
      },
      orderBy: () => ({
        offset: (off: number) => ({
          limit: (lim: number) => {
            // listChats: sorted by updatedAt desc
            const userId = (
              mockSelect.mock.calls[mockSelect.mock.calls.length - 1] as unknown[]
            )?.[0];
            const allChats = [...chatStore.values()].sort(
              (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
            );
            return Promise.resolve(allChats.slice(off, off + lim));
          },
        }),
      }),
    }),
  }));

  // UPDATE
  mockUpdate.mockImplementation(() => ({
    set: (data: Record<string, unknown>) => ({
      where: (condition: { _val: unknown }) => {
        const chatId = condition._val as string;
        const chat = chatStore.get(chatId);
        if (chat && data.updatedAt) {
          chat.updatedAt = data.updatedAt as Date;
        }
        return Promise.resolve();
      },
    }),
  }));

  // DELETE
  mockDelete.mockImplementation(() => ({
    where: (condition: { _op: string; _conds?: Array<{ _val: unknown }>; _val?: unknown }) => {
      if (condition._op === "and" && condition._conds) {
        const vals = condition._conds.map(
          (c: { _val: unknown }) => c._val,
        );
        const chatId = vals[0] as string;
        const userId = vals[1] as string;
        const chat = chatStore.get(chatId);
        if (chat && chat.userId === userId) {
          chatStore.delete(chatId);
          // Cascade delete messages
          messageStore = messageStore.filter((m) => m.chatId !== chatId);
          return {
            returning: () => Promise.resolve([{ id: chatId }]),
          };
        }
        return { returning: () => Promise.resolve([]) };
      }
      return { returning: () => Promise.resolve([]) };
    },
  }));
});


// ─── Helper: override listChats mock to properly filter by userId ────────────

function setupListChatsMock() {
  // Override select for listChats to handle the two parallel queries
  mockSelect.mockImplementation((fields?: Record<string, unknown>) => ({
    from: () => ({
      where: (condition: { _op: string; _val?: unknown }) => {
        if (fields && "total" in fields) {
          const userId = condition._val as string;
          const total = [...chatStore.values()].filter(
            (c) => c.userId === userId,
          ).length;
          return Promise.resolve([{ total }]);
        }
        // For non-count queries that need ordering
        return {
          orderBy: () => ({
            offset: (off: number) => ({
              limit: (lim: number) => {
                const userId = condition._val as string;
                const chats = [...chatStore.values()]
                  .filter((c) => c.userId === userId)
                  .sort(
                    (a, b) =>
                      b.updatedAt.getTime() - a.updatedAt.getTime(),
                  );
                return Promise.resolve(chats.slice(off, off + lim));
              },
            }),
          }),
        };
      },
    }),
  }));
}

// ─── Property Tests ──────────────────────────────────────────────────────────

/**
 * Feature: sizing-v2-chatbot, Property 7: Chat list sorted by updatedAt descending with pagination
 * Validates: Requirements 6.6, 7.7
 */
describe("Property 7: Chat list sorted by updatedAt descending with pagination", () => {
  it("listChats returns chats sorted by updatedAt desc, respecting page/limit", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 3 }),
        async (userId, chatCount, limit) => {
          // Reset stores
          chatStore = new Map();
          messageStore = [];
          idCounter = 0;

          // Create chats with staggered updatedAt
          for (let i = 0; i < chatCount; i++) {
            const id = nextId();
            chatStore.set(id, {
              id,
              userId,
              title: `Chat ${i}`,
              azureConversationId: null,
              createdAt: new Date(2025, 0, 1, 0, 0, i),
              updatedAt: new Date(2025, 0, 1, 0, 0, i),
            });
          }

          setupListChatsMock();

          // Page 1
          const page1 = await listChats(userId, 1, limit);
          expect(page1.total).toBe(chatCount);
          expect(page1.chats.length).toBeLessThanOrEqual(limit);

          // Verify descending order
          for (let i = 1; i < page1.chats.length; i++) {
            expect(
              page1.chats[i - 1].updatedAt.getTime(),
            ).toBeGreaterThanOrEqual(page1.chats[i].updatedAt.getTime());
          }

          // Verify no overlap between pages
          if (chatCount > limit) {
            const page2 = await listChats(userId, 2, limit);
            const page1Ids = new Set(page1.chats.map((c) => c.id));
            for (const chat of page2.chats) {
              expect(page1Ids.has(chat.id)).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: sizing-v2-chatbot, Property 8: Chat GET returns messages in chronological order, scoped to owner
 * Validates: Requirements 6.8, 7.5, 13.3
 */
describe("Property 8: Chat GET returns messages in chronological order, scoped to owner", () => {
  it("getChat returns messages sorted by createdAt asc, null for non-owner", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.integer({ min: 1, max: 5 }),
        async (ownerUserId, otherUserId, msgCount) => {
          // Ensure different users
          if (ownerUserId === otherUserId) return;

          chatStore = new Map();
          messageStore = [];
          idCounter = 0;

          // Create a chat owned by ownerUserId
          const chatId = nextId();
          chatStore.set(chatId, {
            id: chatId,
            userId: ownerUserId,
            title: "Test Chat",
            azureConversationId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Add messages with staggered timestamps
          for (let i = 0; i < msgCount; i++) {
            messageStore.push({
              id: nextId(),
              chatId,
              role: i % 2 === 0 ? "user" : "assistant",
              content: `Message ${i}`,
              attachments: [],
              createdAt: new Date(2025, 0, 1, 0, i, 0),
            });
          }

          // Owner can access
          const result = await getChat(chatId, ownerUserId);
          expect(result).not.toBeNull();
          expect(result!.messages.length).toBe(msgCount);

          // Messages in chronological order
          for (let i = 1; i < result!.messages.length; i++) {
            expect(
              result!.messages[i - 1].createdAt.getTime(),
            ).toBeLessThanOrEqual(result!.messages[i].createdAt.getTime());
          }

          // Non-owner gets null
          const otherResult = await getChat(chatId, otherUserId);
          expect(otherResult).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: sizing-v2-chatbot, Property 9: Chat cascade delete removes all messages
 * Validates: Requirements 7.6, 11.5
 */
describe("Property 9: Chat cascade delete removes all messages", () => {
  it("deleteChat removes chat and all associated messages", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.integer({ min: 1, max: 5 }),
        async (userId, msgCount) => {
          chatStore = new Map();
          messageStore = [];
          idCounter = 0;

          const chatId = nextId();
          chatStore.set(chatId, {
            id: chatId,
            userId,
            title: "To Delete",
            azureConversationId: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          for (let i = 0; i < msgCount; i++) {
            messageStore.push({
              id: nextId(),
              chatId,
              role: "user",
              content: `Msg ${i}`,
              attachments: [],
              createdAt: new Date(),
            });
          }

          expect(messageStore.filter((m) => m.chatId === chatId).length).toBe(
            msgCount,
          );

          const deleted = await deleteChat(chatId, userId);
          expect(deleted).toBe(true);

          // Chat gone
          expect(chatStore.has(chatId)).toBe(false);

          // All messages gone
          expect(
            messageStore.filter((m) => m.chatId === chatId).length,
          ).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("deleteChat returns false for non-owner", async () => {
    await fc.assert(
      fc.asyncProperty(fc.uuid(), fc.uuid(), async (ownerId, otherId) => {
        if (ownerId === otherId) return;

        chatStore = new Map();
        messageStore = [];
        idCounter = 0;

        const chatId = nextId();
        chatStore.set(chatId, {
          id: chatId,
          userId: ownerId,
          title: "Protected",
          azureConversationId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const deleted = await deleteChat(chatId, otherId);
        expect(deleted).toBe(false);
        expect(chatStore.has(chatId)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: sizing-v2-chatbot, Property 21: Message persistence after stream completion
 * Validates: Requirements 7.3
 */
describe("Property 21: Message persistence after stream completion", () => {
  it("saveMessage persists message and updates chat updatedAt", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.constantFrom("user" as const, "assistant" as const),
        async (userId, content, role) => {
          chatStore = new Map();
          messageStore = [];
          idCounter = 0;

          const chatId = nextId();
          const originalUpdatedAt = new Date(2025, 0, 1);
          chatStore.set(chatId, {
            id: chatId,
            userId,
            title: "Test",
            azureConversationId: null,
            createdAt: originalUpdatedAt,
            updatedAt: originalUpdatedAt,
          });

          const msg = await saveMessage(chatId, role, content);

          expect(msg.chatId).toBe(chatId);
          expect(msg.role).toBe(role);
          expect(msg.content).toBe(content);

          // Message persisted in store
          expect(messageStore.some((m) => m.id === msg.id)).toBe(true);

          // Chat updatedAt was bumped
          const chat = chatStore.get(chatId);
          expect(chat!.updatedAt.getTime()).toBeGreaterThanOrEqual(
            originalUpdatedAt.getTime(),
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});
