import "server-only";

import { z } from "zod";

export const startCspScanSchema = z.object({
  accountId: z.string().uuid(),
});

export const cspFindingsQuerySchema = z.object({
  category: z
    .enum([
      "identity_access",
      "network",
      "data_protection",
      "logging",
      "external_access",
    ])
    .optional(),
  severity: z.enum(["critical", "high", "medium", "low"]).optional(),
});

export const updateCspTrackingSchema = z.object({
  status: z.enum(["open", "acknowledged", "remediated"]),
  notes: z.string().max(500).optional(),
});

export const cspExportSchema = z.object({
  scanId: z.string().uuid(),
  format: z.enum(["excel", "pdf"]),
});

export const cspScanHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Type Exports ───────────────────────────────────────────────────────────

export type StartCspScanInput = z.infer<typeof startCspScanSchema>;
export type CspFindingsQueryInput = z.infer<typeof cspFindingsQuerySchema>;
export type UpdateCspTrackingInput = z.infer<typeof updateCspTrackingSchema>;
export type CspExportInput = z.infer<typeof cspExportSchema>;
