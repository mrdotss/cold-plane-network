// ─── Saved Views Types (Phase 5) ─────────────────────────────────────────────

/**
 * Full saved view record as stored in the database.
 * Validates: Requirements 4.1, 5.3
 */
export interface SavedView {
  id: string;
  userId: string;
  name: string;
  feature: "cfm" | "csp";
  filters: CfmFilters | CspFilters;
  sortBy: string | null;
  sortOrder: "asc" | "desc" | null;
  createdAt: string;
  updatedAt: string;
}

/** Filter shape for CFM dashboard views. */
export interface CfmFilters {
  service?: string[];
  priority?: string[];
  accountId?: string;
  minSavings?: number;
  status?: string;
}

/** Filter shape for CSP dashboard views. */
export interface CspFilters {
  severity?: string[];
  category?: string[];
  status?: string;
  accountId?: string;
}

/** Request payload for creating a new saved view. */
export interface CreateViewRequest {
  name: string;
  feature: "cfm" | "csp";
  filters: Record<string, unknown>;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/** Request payload for updating an existing saved view. */
export interface UpdateViewRequest {
  name?: string;
  filters?: Record<string, unknown>;
  sortBy?: string | null;
  sortOrder?: "asc" | "desc" | null;
}
