"use client";

import React, { useState } from "react";
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
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import type { ChatConversation } from "@/lib/chat/types";

interface ChatSidebarProps {
  chats: ChatConversation[];
  activeChatId?: string;
  onSelect: (chatId: string) => void;
  onDelete: (chatId: string) => void;
  onNewChat: () => void;
}

function formatDate(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function ChatSidebar({
  chats,
  activeChatId,
  onSelect,
  onDelete,
  onNewChat,
}: ChatSidebarProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
                    <p className="truncate text-xs font-medium">{chat.title}</p>
                    <p className="text-muted-foreground text-[10px]">
                      {formatDate(chat.updatedAt)}
                    </p>
                  </div>

                  {/* Delete with confirmation */}
                  <AlertDialog
                    open={deletingId === chat.id}
                    onOpenChange={(open) => setDeletingId(open ? chat.id : null)}
                  >
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        className="opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(chat.id);
                        }}
                        aria-label={`Delete ${chat.title}`}
                      >
                        <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent size="sm">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this conversation and all its messages.
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
