import { NextResponse } from "next/server";
import { requireAuth, AuthError } from "@/lib/auth/middleware";
import { writeAuditEvent } from "@/lib/audit/writer";
import { getChat, deleteChat, updateChatTitle } from "@/lib/chat/queries";

/**
 * GET /api/chat/[chatId]
 * Returns chat metadata + all messages in chronological order.
 * Owner-only: scoped to authenticated user.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { chatId } = await params;

    const result = await getChat(chatId, userId);
    if (!result) {
      return NextResponse.json(
        { error: "Chat not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({
      chat: result.chat,
      messages: result.messages,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch chat" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/chat/[chatId]
 * Updates the chat title.
 * Owner-only: scoped to authenticated user.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { chatId } = await params;
    const body = await request.json();

    const title = body?.title;
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 },
      );
    }

    const updated = await updateChatTitle(chatId, userId, title.trim());
    if (!updated) {
      return NextResponse.json(
        { error: "Chat not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update chat" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/chat/[chatId]
 * Deletes chat and cascade-deletes all messages.
 * Owner-only: scoped to authenticated user.
 * Logs CHAT_DELETED audit event.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { chatId } = await params;

    const deleted = await deleteChat(chatId, userId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Chat not found" },
        { status: 404 },
      );
    }

    // Audit: chat deleted (non-blocking)
    writeAuditEvent({
      userId,
      eventType: "CHAT_DELETED",
      metadata: { chatId },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to delete chat" },
      { status: 500 },
    );
  }
}
