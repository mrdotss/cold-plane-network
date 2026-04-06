import { z } from "zod";

// ─── Saved Views Validators (Phase 5) ───────────────────────────────────────

export const createViewSchema = z.object({
  name: z.string().min(1, "Name is required"),
  feature: z.enum(["cfm", "csp"], {
    error: "Feature must be 'cfm' or 'csp'",
  }),
  filters: z.record(z.string(), z.unknown()),
  sortBy: z.string().optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
});

export const updateViewSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  sortBy: z.string().nullable().optional(),
  sortOrder: z.enum(["asc", "desc"]).nullable().optional(),
});

// ─── Type Exports ───────────────────────────────────────────────────────────

export type CreateViewInput = z.infer<typeof createViewSchema>;
export type UpdateViewInput = z.infer<typeof updateViewSchema>;
