// ─── Annotations Types (Phase 5) ─────────────────────────────────────────────

/**
 * Valid target entity types that can receive annotations.
 * Validates: Requirement 7.1
 */
export type AnnotationTargetType =
  | "cfm_scan"
  | "csp_scan"
  | "cfm_recommendation"
  | "csp_finding";

/**
 * Full annotation record as stored in the database.
 * Validates: Requirements 7.1, 8.1, 8.2
 */
export interface Annotation {
  id: string;
  userId: string;
  targetType: AnnotationTargetType;
  targetId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/** Request payload for creating a new annotation. */
export interface CreateAnnotationRequest {
  targetType: AnnotationTargetType;
  targetId: string;
  content: string; // validated: 1–500 chars
}

/** Request payload for updating an existing annotation. */
export interface UpdateAnnotationRequest {
  content: string; // validated: 1–500 chars
}
