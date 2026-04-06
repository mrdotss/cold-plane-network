"use client";

import { useState, useEffect, useCallback } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Note01Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AnnotationBadge } from "./AnnotationBadge";
import type { AnnotationTargetType } from "@/lib/annotations/types";

const MAX_CONTENT_LENGTH = 500;

interface AnnotationPopoverProps {
  targetType: AnnotationTargetType;
  targetId: string;
  existingAnnotation?: { id: string; content: string };
  onSaved?: () => void;
}

export function AnnotationPopover({
  targetType,
  targetId,
  existingAnnotation,
  onSaved,
}: AnnotationPopoverProps) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState(existingAnnotation?.content ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteCount, setNoteCount] = useState(0);
  const [latestContent, setLatestContent] = useState<string | undefined>();

  const isEdit = !!existingAnnotation;
  const trimmed = content.trim();
  const canSave = trimmed.length > 0 && trimmed.length <= MAX_CONTENT_LENGTH && !saving;

  const fetchAnnotations = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/annotations?targetType=${targetType}&targetId=${targetId}`,
      );
      if (res.ok) {
        const data = await res.json();
        const list: { content: string }[] = data.annotations ?? [];
        setNoteCount(list.length);
        setLatestContent(list[0]?.content);
      }
    } catch {
      /* silent — badge just won't show */
    }
  }, [targetType, targetId]);

  useEffect(() => {
    fetchAnnotations();
  }, [fetchAnnotations]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setContent(existingAnnotation?.content ?? "");
      setError(null);
    }
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);

    try {
      const url = isEdit
        ? `/api/annotations/${existingAnnotation.id}`
        : "/api/annotations";
      const method = isEdit ? "PUT" : "POST";
      const body = isEdit
        ? { content: trimmed }
        : { targetType, targetId, content: trimmed };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save annotation");
      }

      setOpen(false);
      await fetchAnnotations();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-0.5">
      <AnnotationBadge count={noteCount} latestContent={latestContent} />
      <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={isEdit ? "Edit note" : "Add note"}
        >
          <HugeiconsIcon icon={Note01Icon} strokeWidth={2} className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={8} className="w-72">
        <div className="flex flex-col gap-2">
          <Textarea
            placeholder="Add a note…"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={MAX_CONTENT_LENGTH}
            rows={3}
            className="min-h-20 resize-none text-sm"
            disabled={saving}
            aria-label="Annotation content"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              {content.length}/{MAX_CONTENT_LENGTH}
            </span>
            {error && (
              <span className="text-xs text-destructive truncate max-w-[140px]">
                {error}
              </span>
            )}
          </div>
          <Button size="sm" onClick={handleSave} disabled={!canSave} className="w-full">
            {saving ? (
              <>
                <HugeiconsIcon icon={Loading03Icon} strokeWidth={2} className="size-3.5 animate-spin" />
                Saving…
              </>
            ) : isEdit ? "Update" : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
    </span>
  );
}
