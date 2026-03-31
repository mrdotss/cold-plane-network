"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { HugeiconsIcon } from "@hugeicons/react";
import { Calendar03Icon } from "@hugeicons/core-free-icons";
import type { ScheduleFrequency } from "@/lib/cfm/types";

interface ScheduleConfigProps {
  accountId: string;
}

const DAYS_OF_WEEK = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, "0")}:00 UTC`,
}));

export function ScheduleConfig({ accountId }: ScheduleConfigProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSchedule, setHasSchedule] = useState(false);

  // Form state
  const [frequency, setFrequency] = useState<ScheduleFrequency>("weekly");
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hour, setHour] = useState(6);
  const [enabled, setEnabled] = useState(true);

  // Fetch existing schedule
  useEffect(() => {
    if (!open) return;

    async function fetchSchedule() {
      setFetching(true);
      try {
        const res = await fetch(
          `/api/cfm/accounts/${accountId}/schedule`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (data.schedule) {
          setHasSchedule(true);
          setFrequency(data.schedule.frequency);
          setDayOfWeek(data.schedule.dayOfWeek ?? 1);
          setDayOfMonth(data.schedule.dayOfMonth ?? 1);
          setHour(data.schedule.hour ?? 6);
          setEnabled(data.schedule.enabled ?? true);
        }
      } catch {
        // Ignore — form defaults are fine
      } finally {
        setFetching(false);
      }
    }
    fetchSchedule();
  }, [accountId, open]);

  const handleSave = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        frequency,
        hour,
        enabled,
      };
      if (frequency === "weekly") body.dayOfWeek = dayOfWeek;
      if (frequency === "monthly") body.dayOfMonth = dayOfMonth;

      const res = await fetch(
        `/api/cfm/accounts/${accountId}/schedule`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save schedule");
      }

      setHasSchedule(true);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }, [accountId, frequency, dayOfWeek, dayOfMonth, hour, enabled]);

  const handleDelete = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/cfm/accounts/${accountId}/schedule`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 404) {
        throw new Error("Failed to remove schedule");
      }
      setHasSchedule(false);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <HugeiconsIcon
            icon={Calendar03Icon}
            data-icon="inline-start"
            strokeWidth={2}
          />
          Schedule
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        {fetching ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Loading schedule...
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Auto-Scan Schedule</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {enabled ? "Enabled" : "Disabled"}
                </span>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>
            </div>

            {/* Frequency */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Frequency
              </label>
              <Select
                value={frequency}
                onValueChange={(v) => setFrequency(v as ScheduleFrequency)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Day of week (weekly only) */}
            {frequency === "weekly" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Day of Week
                </label>
                <Select
                  value={String(dayOfWeek)}
                  onValueChange={(v) => setDayOfWeek(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day, idx) => (
                      <SelectItem key={idx} value={String(idx)}>
                        {day}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Day of month (monthly only) */}
            {frequency === "monthly" && (
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Day of Month
                </label>
                <Select
                  value={String(dayOfMonth)}
                  onValueChange={(v) => setDayOfMonth(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map(
                      (day) => (
                        <SelectItem key={day} value={String(day)}>
                          {day}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Hour */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">
                Time (UTC)
              </label>
              <Select
                value={String(hour)}
                onValueChange={(v) => setHour(Number(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h.value} value={String(h.value)}>
                      {h.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <div className="flex gap-2 justify-end pt-1">
              {hasSchedule && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-destructive"
                  disabled={loading}
                  onClick={handleDelete}
                >
                  Remove
                </Button>
              )}
              <Button
                size="sm"
                className="text-xs"
                disabled={loading}
                onClick={handleSave}
              >
                {loading
                  ? "Saving..."
                  : hasSchedule
                    ? "Update"
                    : "Enable Schedule"}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
