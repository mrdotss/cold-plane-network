"use client";

import { useState, useEffect } from "react";
import { getRelativeTime } from "@/lib/freshness/utils";

interface LastUpdatedProps {
  completedAt: string | null;
  isScanning: boolean;
}

export function LastUpdated({ completedAt, isScanning }: LastUpdatedProps) {
  const [relativeTime, setRelativeTime] = useState(() => getRelativeTime(completedAt));

  useEffect(() => {
    setRelativeTime(getRelativeTime(completedAt));
    const interval = setInterval(() => {
      setRelativeTime(getRelativeTime(completedAt));
    }, 60_000);
    return () => clearInterval(interval);
  }, [completedAt]);

  if (isScanning) {
    return <span className="text-sm text-muted-foreground animate-pulse">Scanning now...</span>;
  }

  if (completedAt === null) {
    return <span className="text-sm text-muted-foreground">No scans yet</span>;
  }

  return <span className="text-sm text-muted-foreground">Updated {relativeTime}</span>;
}
