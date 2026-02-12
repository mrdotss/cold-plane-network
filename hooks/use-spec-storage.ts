"use client";

import { useEffect, useRef, useCallback } from "react";
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "cold-network-plane";
const STORE_NAME = "specs";
const CURRENT_KEY = "current";
const DB_VERSION = 1;

interface StoredSpec {
  id: string;
  content: string;
  updatedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Hook for persisting spec content to IndexedDB.
 * Returns { load, save } functions.
 */
export function useSpecStorage() {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (): Promise<string> => {
    try {
      const db = await getDB();
      const stored = await db.get(STORE_NAME, CURRENT_KEY) as StoredSpec | undefined;
      return stored?.content ?? "";
    } catch {
      // Fallback to localStorage
      return localStorage.getItem("cold-network-spec") ?? "";
    }
  }, []);

  const save = useCallback((content: string) => {
    // Debounce saves to avoid excessive writes
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        const db = await getDB();
        const entry: StoredSpec = {
          id: CURRENT_KEY,
          content,
          updatedAt: Date.now(),
        };
        await db.put(STORE_NAME, entry);
      } catch {
        // Fallback to localStorage for small specs
        if (content.length < 5000) {
          localStorage.setItem("cold-network-spec", content);
        }
      }
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  return { load, save };
}
