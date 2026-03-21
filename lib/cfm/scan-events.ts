import "server-only";

import type { ScanProgressEvent } from "./types";

type Listener = (event: ScanProgressEvent) => void;

/**
 * In-memory event bus for scan progress.
 * Allows the SSE stream route to subscribe to events emitted by runScan.
 *
 * This is a singleton — works because Next.js Route Handlers share the same
 * Node.js process. For multi-process deployments, replace with Redis pub/sub.
 */
class ScanEventBus {
  private listeners = new Map<string, Set<Listener>>();

  /** Subscribe to progress events for a specific scan. */
  subscribe(scanId: string, listener: Listener): () => void {
    if (!this.listeners.has(scanId)) {
      this.listeners.set(scanId, new Set());
    }
    this.listeners.get(scanId)!.add(listener);

    // Return unsubscribe function
    return () => {
      const set = this.listeners.get(scanId);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(scanId);
        }
      }
    };
  }

  /** Emit a progress event to all listeners for a scan. */
  emit(scanId: string, event: ScanProgressEvent): void {
    const set = this.listeners.get(scanId);
    if (set) {
      for (const listener of set) {
        listener(event);
      }
    }
  }
}

/** Singleton scan event bus instance. */
export const scanEventBus = new ScanEventBus();
