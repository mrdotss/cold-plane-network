"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  LIFECYCLE_TRANSITIONS,
  type RecommendationLifecycleStatus,
} from "@/lib/cfm/types";

interface LifecycleActionsProps {
  trackingId: string;
  currentStatus: RecommendationLifecycleStatus;
  accountId: string;
  onStatusChange: () => void;
}

const STATUS_LABELS: Record<RecommendationLifecycleStatus, string> = {
  open: "Reopen",
  acknowledged: "Acknowledge",
  implemented: "Mark Implemented",
  verified: "Verify",
};

export function LifecycleActions({
  trackingId,
  currentStatus,
  accountId,
  onStatusChange,
}: LifecycleActionsProps) {
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validTransitions = LIFECYCLE_TRANSITIONS[currentStatus];

  const handleTransition = useCallback(
    async (newStatus: RecommendationLifecycleStatus) => {
      // Show notes input for "implemented" transition
      if (newStatus === "implemented" && !showNotes) {
        setShowNotes(true);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/cfm/accounts/${accountId}/tracking/${trackingId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: newStatus,
              ...(notes ? { notes } : {}),
            }),
          },
        );

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to update status");
        }

        setNotes("");
        setShowNotes(false);
        onStatusChange();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Update failed");
      } finally {
        setLoading(false);
      }
    },
    [trackingId, accountId, notes, showNotes, onStatusChange],
  );

  if (validTransitions.length === 0) {
    return null;
  }

  // For "implemented" transition, show a popover with notes
  if (showNotes) {
    return (
      <Popover open={showNotes} onOpenChange={setShowNotes}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs h-6 px-2">
            Mark Implemented
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium">Implementation notes (optional)</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g., Resized to t3.medium on March 30"
              className="text-xs h-16 resize-none"
              maxLength={500}
            />
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
            <div className="flex gap-1.5 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-6"
                onClick={() => {
                  setShowNotes(false);
                  setNotes("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="text-xs h-6"
                disabled={loading}
                onClick={() => handleTransition("implemented")}
              >
                {loading ? "Saving..." : "Confirm"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="flex gap-1">
      {validTransitions.map((targetStatus) => (
        <Button
          key={targetStatus}
          variant="outline"
          size="sm"
          className="text-xs h-6 px-2"
          disabled={loading}
          onClick={() => handleTransition(targetStatus)}
        >
          {loading ? "..." : STATUS_LABELS[targetStatus]}
        </Button>
      ))}
      {error && (
        <span className="text-xs text-destructive self-center">{error}</span>
      )}
    </div>
  );
}
