import "server-only";

import { db } from "@/lib/db/client";
import { chats, chatMessages } from "@/lib/db/schema";
import { eq, and, desc, asc, count } from "drizzle-orm";
import type { ChatConversation, ChatMessage, FileRef } from "./types";

/**
 * Create a new chat conversation.
 */
export async function createChat(
  userId: string,
  azureConversationId?: string,
): Promise<ChatConversation> {
  const [chat] = await db
    .insert(chats)
    .values({
      userId,
      azureConversationId: azureConversationId ?? null,
    })
    .returning();

  return {
    id: chat.id,
    userId: chat.userId,
    title: chat.title,
    azureConversationId: chat.azureConversationId,
    createdAt: chat.createdAt,
    updatedAt: chat.updatedAt,
  };
}

/**
 * Get a chat with all messages, scoped to the authenticated user.
 * Returns null if the chat doesn't exist or isn't owned by the user.
 */
export async function getChat(
  chatId: string,
  userId: string,
): Promise<{ chat: ChatConversation; messages: ChatMessage[] } | null> {
  const [chat] = await db
    .select()
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .limit(1);

  if (!chat) return null;

  const messages = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(asc(chatMessages.createdAt));

  return {
    chat: {
      id: chat.id,
      userId: chat.userId,
      title: chat.title,
      azureConversationId: chat.azureConversationId,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
    },
    messages: messages.map((m) => ({
      id: m.id,
      chatId: m.chatId,
      role: m.role as "user" | "assistant",
      content: m.content,
      attachments: (m.attachments ?? []) as FileRef[],
      createdAt: m.createdAt,
    })),
  };
}


/**
 * List chats for a user, paginated and sorted by updatedAt descending.
 */
export async function listChats(
  userId: string,
  page: number,
  limit: number,
): Promise<{ chats: ChatConversation[]; total: number }> {
  const offset = (page - 1) * limit;

  const [rows, [{ total }]] = await Promise.all([
    db
      .select()
      .from(chats)
      .where(eq(chats.userId, userId))
      .orderBy(desc(chats.updatedAt))
      .offset(offset)
      .limit(limit),
    db
      .select({ total: count() })
      .from(chats)
      .where(eq(chats.userId, userId)),
  ]);

  return {
    chats: rows.map((c) => ({
      id: c.id,
      userId: c.userId,
      title: c.title,
      azureConversationId: c.azureConversationId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    total,
  };
}

/**
 * Save a message and explicitly update the chat's updatedAt timestamp.
 */
export async function saveMessage(
  chatId: string,
  role: "user" | "assistant",
  content: string,
  attachments?: FileRef[],
): Promise<ChatMessage> {
  const [message] = await db
    .insert(chatMessages)
    .values({
      chatId,
      role,
      content,
      attachments: attachments ?? [],
    })
    .returning();

  // Explicitly update updatedAt (Drizzle has no auto-update like Prisma's @updatedAt)
  await db
    .update(chats)
    .set({ updatedAt: new Date() })
    .where(eq(chats.id, chatId));

  return {
    id: message.id,
    chatId: message.chatId,
    role: message.role as "user" | "assistant",
    content: message.content,
    attachments: (message.attachments ?? []) as FileRef[],
    createdAt: message.createdAt,
  };
}

/**
 * Delete a chat and cascade-delete all messages, scoped to the authenticated user.
 * Returns true if the chat was found and deleted, false otherwise.
 */
export async function deleteChat(
  chatId: string,
  userId: string,
): Promise<boolean> {
  const result = await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning({ id: chats.id });

  return result.length > 0;
}
