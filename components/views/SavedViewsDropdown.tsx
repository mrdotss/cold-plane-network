"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  MoreVerticalCircle01Icon,
  PencilEdit01Icon,
  Delete02Icon,
  Loading03Icon,
  Tick02Icon,
  Cancel01Icon,
} from "@hugeicons/core-free-icons";
import type { SavedView } from "@/lib/views/types";

interface SavedViewsDropdownProps {
  feature: "cfm" | "csp";
  onApplyView: (view: SavedView) => void;
}

export function SavedViewsDropdown({
  feature,
  onApplyView,
}: SavedViewsDropdownProps) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const hasFetched = useRef(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  const fetchViews = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/views?feature=${feature}`);
      if (res.ok) {
        const data = await res.json();
        setViews(data.views ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [feature]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        hasFetched.current = true;
        fetchViews();
      } else {
        setEditingId(null);
      }
    },
    [fetchViews],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/views/${id}`, { method: "DELETE" });
        if (res.ok) {
          setViews((prev) => prev.filter((v) => v.id !== id));
        }
      } catch {
        // silently fail — user can retry
      }
    },
    [],
  );

  const startEditing = useCallback((view: SavedView) => {
    setEditingId(view.id);
    setEditName(view.name);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditName("");
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/views/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (res.ok) {
        setViews((prev) =>
          prev.map((v) =>
            v.id === editingId ? { ...v, name: editName.trim() } : v,
          ),
        );
        setEditingId(null);
        setEditName("");
      }
    } finally {
      setSaving(false);
    }
  }, [editingId, editName]);

  // Focus the edit input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
    }
  }, [editingId]);

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <HugeiconsIcon icon={ArrowDown01Icon} data-icon="inline-start" strokeWidth={2} />
          Saved Views
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Saved Views</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {loading ? (
          <div className="flex items-center justify-center py-4">
            <HugeiconsIcon
              icon={Loading03Icon}
              strokeWidth={2}
              className="size-4 animate-spin text-muted-foreground"
            />
            <span className="ml-2 text-sm text-muted-foreground">Loading…</span>
          </div>
        ) : views.length === 0 ? (
          <div className="py-4 text-center text-sm text-muted-foreground">
            No saved views
          </div>
        ) : (
          <DropdownMenuGroup>
            {views.map((view) => (
              <div key={view.id} className="relative">
                {editingId === view.id ? (
                  <div className="flex items-center gap-1 px-1.5 py-1">
                    <Input
                      ref={editInputRef}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") saveEdit();
                        if (e.key === "Escape") cancelEditing();
                      }}
                      className="h-7 text-sm"
                      disabled={saving}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        saveEdit();
                      }}
                      disabled={saving || !editName.trim()}
                      aria-label="Confirm rename"
                    >
                      <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      onClick={(e) => {
                        e.preventDefault();
                        cancelEditing();
                      }}
                      aria-label="Cancel rename"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <DropdownMenuItem
                      className="flex-1 cursor-pointer"
                      onSelect={() => onApplyView(view)}
                    >
                      <span className="truncate">{view.name}</span>
                    </DropdownMenuItem>

                    {/* Kebab menu — nested dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="inline-flex size-7 shrink-0 items-center justify-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          aria-label={`Options for ${view.name}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <HugeiconsIcon
                            icon={MoreVerticalCircle01Icon}
                            strokeWidth={2}
                            className="size-4 text-muted-foreground"
                          />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-36">
                        <DropdownMenuItem
                          onSelect={() => startEditing(view)}
                        >
                          <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => handleDelete(view.id)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
