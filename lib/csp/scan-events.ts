import "server-only";

import type { CspScanProgressEvent } from "./types";

type Listener = (event: CspScanProgressEvent) => void;

/**
 * In-memory event bus for CSP scan progress.
 * Same singleton pattern as CFM — works because Next.js Route Handlers
 * share the same Node.js process.
 */
class CspScanEventBus {
  private listeners = new Map<string, Set<Listener>>();

  subscribe(scanId: string, listener: Listener): () => void {
    if (!this.listeners.has(scanId)) {
      this.listeners.set(scanId, new Set());
    }
    this.listeners.get(scanId)!.add(listener);

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

  emit(scanId: string, event: CspScanProgressEvent): void {
    const set = this.listeners.get(scanId);
    if (set) {
      for (const listener of set) {
        listener(event);
      }
    }
  }
}

export const cspScanEventBus = new CspScanEventBus();
