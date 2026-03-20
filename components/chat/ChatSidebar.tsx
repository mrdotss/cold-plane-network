"use client";

import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  Delete02Icon,
  MessageMultiple01Icon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { formatRelativeDate } from "@/lib/chat/format-date";
import type { ChatConversation } from "@/lib/chat/types";

interface ChatSidebarProps {
  chats: ChatConversation[];
  activeChatId?: string;
  onSelect: (chatId: string) => void;
  onDelete: (chatId: string) => void;
  onNewChat: () => void;
  onRename?: (chatId: string, newTitle: string) => void;
}

export function ChatSidebar({
  chats,
  activeChatId,
  onSelect,
  onDelete,
  onNewChat,
  onRename,
}: ChatSidebarProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the rename input when editing starts
  useEffect(() => {
    if (editingId) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [editingId]);

  const handleStartRename = (chat: ChatConversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(chat.id);
    setEditValue(chat.title);
  };

  const handleSaveRename = () => {
    if (editingId && editValue.trim() && onRename) {
      onRename(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditValue("");
  };

  return (
    <div className="flex h-full flex-col border-r">
      <div className="flex items-center justify-between border-b p-2">
        <span className="text-xs font-medium">Conversations</span>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onNewChat}
          aria-label="New chat"
        >
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {chats.length === 0 ? (
          <p className="text-muted-foreground p-3 text-center text-xs">
            No conversations yet
          </p>
        ) : (
          <ul className="space-y-0.5 p-1" role="listbox" aria-label="Chat history">
            {chats.map((chat) => (
              <li key={chat.id} role="option" aria-selected={chat.id === activeChatId}>
                <div
                  className={cn(
                    "group flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                    chat.id === activeChatId
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                  onClick={() => onSelect(chat.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(chat.id);
                    }
                  }}
                  tabIndex={0}
                >
                  <HugeiconsIcon
                    icon={MessageMultiple01Icon}
                    strokeWidth={2}
                    className="size-3.5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    {/* Fix 4: Inline rename input */}
                    {editingId === chat.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Enter") handleSaveRename();
                          if (e.key === "Escape") handleCancelRename();
                        }}
                        onBlur={handleSaveRename}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-background w-full rounded border px-1 py-0.5 text-xs font-medium outline-none focus:ring-1 focus:ring-primary"
                      />
                    ) : (
                      <p className="truncate text-xs font-medium">{chat.title}</p>
                    )}
                    <p className="text-muted-foreground text-[10px]">
                      {formatRelativeDate(chat.updatedAt)}
                    </p>
                  </div>

                  {/* Action buttons: Rename + Delete */}
                  {editingId !== chat.id && (
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100">
                      {/* Rename button */}
                      {onRename && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={(e) => handleStartRename(chat, e)}
                          aria-label={`Rename ${chat.title}`}
                        >
                          <HugeiconsIcon
                            icon={PencilEdit01Icon}
                            strokeWidth={2}
                            className="size-3"
                          />
                        </Button>
                      )}

                      {/* Delete with confirmation */}
                      <AlertDialog
                        open={deletingId === chat.id}
                        onOpenChange={(open) =>
                          setDeletingId(open ? chat.id : null)
                        }
                      >
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeletingId(chat.id);
                            }}
                            aria-label={`Delete ${chat.title}`}
                          >
                            <HugeiconsIcon
                              icon={Delete02Icon}
                              strokeWidth={2}
                              className="size-3"
                            />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent size="sm">
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Delete conversation?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this conversation and
                              all its messages.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              variant="destructive"
                              onClick={() => {
                                onDelete(chat.id);
                                setDeletingId(null);
                              }}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
