"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon, PencilEdit01Icon } from "@hugeicons/core-free-icons";

export interface AccountGroup {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
}

interface AccountGroupManagerProps {
  groups: AccountGroup[];
  onGroupsChanged: () => void;
}

const PRESET_COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16",
];

export function AccountGroupManager({
  groups,
  onGroupsChanged,
}: AccountGroupManagerProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AccountGroup | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setName("");
    setDescription("");
    setColor(PRESET_COLORS[0]);
    setEditingGroup(null);
    setError(null);
  }, []);

  const openCreate = useCallback(() => {
    resetForm();
    setDialogOpen(true);
  }, [resetForm]);

  const openEdit = useCallback((group: AccountGroup) => {
    setEditingGroup(group);
    setName(group.name);
    setDescription(group.description ?? "");
    setColor(group.color ?? PRESET_COLORS[0]);
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const body = { name: name.trim(), description: description.trim() || undefined, color };

      if (editingGroup) {
        const res = await fetch(`/api/cfm/groups/${editingGroup.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Failed" }));
          throw new Error(data.error);
        }
      } else {
        const res = await fetch("/api/cfm/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: "Failed" }));
          throw new Error(data.error);
        }
      }

      setDialogOpen(false);
      resetForm();
      onGroupsChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save group");
    } finally {
      setSaving(false);
    }
  }, [name, description, color, editingGroup, resetForm, onGroupsChanged]);

  const handleDelete = useCallback(
    async (groupId: string) => {
      try {
        const res = await fetch(`/api/cfm/groups/${groupId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete");
        onGroupsChanged();
      } catch {
        // Silently fail — group may have already been deleted
      }
    },
    [onGroupsChanged],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Groups</span>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={openCreate}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} className="size-3.5" />
        </Button>
      </div>

      {groups.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {groups.map((group) => (
            <Badge
              key={group.id}
              variant="outline"
              className="gap-1.5 pr-1"
              style={group.color ? { borderColor: group.color, color: group.color } : undefined}
            >
              {group.name}
              <button
                onClick={() => openEdit(group)}
                className="ml-0.5 rounded-sm p-0.5 hover:bg-muted"
              >
                <HugeiconsIcon icon={PencilEdit01Icon} strokeWidth={2} className="size-3" />
              </button>
              <button
                onClick={() => handleDelete(group.id)}
                className="rounded-sm p-0.5 hover:bg-destructive/10"
              >
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {editingGroup ? "Edit Group" : "Create Group"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-name">Name</Label>
              <Input
                id="group-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production"
                maxLength={100}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-desc">Description</Label>
              <Input
                id="group-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                maxLength={500}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Color</Label>
              <div className="flex gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`size-6 rounded-full border-2 ${
                      color === c ? "border-foreground" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Saving…" : editingGroup ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
