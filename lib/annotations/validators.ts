import { z } from "zod";

// ─── Annotations Validators (Phase 5) ───────────────────────────────────────

export const createAnnotationSchema = z.object({
  targetType: z.enum(
    ["cfm_scan", "csp_scan", "cfm_recommendation", "csp_finding"],
    { error: "Invalid target type" },
  ),
  targetId: z.string().uuid("Target ID must be a valid UUID"),
  content: z
    .string()
    .min(1, "Content is required")
    .max(500, "Content must be 500 characters or less"),
});

export const updateAnnotationSchema = z.object({
  content: z
    .string()
    .min(1, "Content is required")
    .max(500, "Content must be 500 characters or less"),
});

// ─── Type Exports ───────────────────────────────────────────────────────────

export type CreateAnnotationInput = z.infer<typeof createAnnotationSchema>;
export type UpdateAnnotationInput = z.infer<typeof updateAnnotationSchema>;
