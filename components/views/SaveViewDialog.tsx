"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  FloppyDiskIcon,
  Loading03Icon,
} from "@hugeicons/core-free-icons";

interface SaveViewDialogProps {
  feature: "cfm" | "csp";
  filters: Record<string, unknown>;
  sortBy?: string | null;
  sortOrder?: "asc" | "desc" | null;
  onSaved?: () => void;
}

export function SaveViewDialog({
  feature,
  filters,
  sortBy,
  sortOrder,
  onSaved,
}: SaveViewDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setName("");
    setError(null);
    setSaving(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (!next) resetState();
    },
    [resetState],
  );

  const handleSave = useCallback(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          feature,
          filters,
          ...(sortBy != null && { sortBy }),
          ...(sortOrder != null && { sortOrder }),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to save view" }));
        throw new Error(body.error ?? "Failed to save view");
      }

      setOpen(false);
      resetState();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save view");
    } finally {
      setSaving(false);
    }
  }, [name, feature, filters, sortBy, sortOrder, onSaved, resetState]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HugeiconsIcon icon={FloppyDiskIcon} data-icon="inline-start" strokeWidth={2} />
          Save View
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save Current View</DialogTitle>
          <DialogDescription>
            Save the current filter and sort settings as a named view for quick access later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="view-name">View Name</Label>
          <Input
            id="view-name"
            placeholder="e.g. Critical EC2 findings"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !saving) handleSave();
            }}
            disabled={saving}
            autoFocus
          />
          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? (
              <>
                <HugeiconsIcon icon={Loading03Icon} className="animate-spin" data-icon="inline-start" strokeWidth={2} />
                Saving…
              </>
            ) : (
              "Save View"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
