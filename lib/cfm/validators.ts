import "server-only";

import { z } from "zod";

export const awsAccountIdSchema = z
  .string()
  .regex(/^\d{12}$/, "AWS Account ID must be exactly 12 digits");

export const roleArnSchema = z
  .string()
  .regex(
    /^arn:aws:iam::\d{12}:role\/.+$/,
    "Role ARN must match arn:aws:iam::<12-digit-id>:role/<name>"
  );

export const createAccountSchema = z.object({
  accountName: z.string().min(1).max(100),
  awsAccountId: awsAccountIdSchema,
  roleArn: roleArnSchema,
  externalId: z.string().max(256).optional(),
  regions: z.array(z.string()).min(1, "Select at least one region"),
  services: z.array(z.string()).min(1, "Select at least one service"),
});

export const updateAccountSchema = z.object({
  accountName: z.string().min(1).max(100).optional(),
  roleArn: roleArnSchema.optional(),
  externalId: z.string().max(256).optional(),
  regions: z.array(z.string()).min(1).optional(),
  services: z.array(z.string()).min(1).optional(),
});

export const startScanSchema = z.object({
  accountId: z.string().uuid(),
});

export const exportSchema = z.object({
  scanId: z.string().uuid(),
  format: z.enum(["excel", "pdf"]),
});

export const scanHistoryQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const compareQuerySchema = z.object({
  from: z.string().uuid("'from' must be a valid scan ID"),
  to: z.string().uuid("'to' must be a valid scan ID"),
});

export const updateTrackingSchema = z.object({
  status: z.enum(["open", "acknowledged", "implemented", "verified"]),
  notes: z.string().max(500).optional(),
});

export const trackingQuerySchema = z.object({
  status: z
    .enum(["open", "acknowledged", "implemented", "verified"])
    .optional(),
});

export const upsertScheduleSchema = z
  .object({
    frequency: z.enum(["daily", "weekly", "monthly"]),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    dayOfMonth: z.number().int().min(1).max(28).optional(),
    hour: z.number().int().min(0).max(23).default(6),
    enabled: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.frequency === "weekly" && data.dayOfWeek === undefined)
        return false;
      if (data.frequency === "monthly" && data.dayOfMonth === undefined)
        return false;
      return true;
    },
    {
      message:
        "dayOfWeek required for weekly, dayOfMonth required for monthly",
    },
  );

// ─── Account Groups ─────────────────────────────────────────────────────────

export const createGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex color (e.g. #FF0000)")
    .optional(),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Color must be a hex color (e.g. #FF0000)")
    .optional(),
});

export const assignGroupSchema = z.object({
  groupId: z.string().uuid().nullable(),
});

// ─── Budgets ────────────────────────────────────────────────────────────────

export const createBudgetSchema = z
  .object({
    name: z.string().min(1).max(100),
    accountId: z.string().uuid().optional(),
    groupId: z.string().uuid().optional(),
    monthlyLimit: z.number().positive(),
    alertThresholdPct: z.number().int().min(1).max(100).default(80),
    enabled: z.boolean().default(true),
  })
  .refine(
    (data) =>
      (data.accountId && !data.groupId) || (!data.accountId && data.groupId),
    { message: "Exactly one of accountId or groupId must be provided" },
  );

export const updateBudgetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  monthlyLimit: z.number().positive().optional(),
  alertThresholdPct: z.number().int().min(1).max(100).optional(),
  enabled: z.boolean().optional(),
});

// ─── Cross-Account Comparison ───────────────────────────────────────────────

export const compareAccountsSchema = z.object({
  accountIds: z.string().transform((val) => val.split(",").filter(Boolean)),
});

// ─── Type Exports ───────────────────────────────────────────────────────────

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type StartScanInput = z.infer<typeof startScanSchema>;
export type ExportInput = z.infer<typeof exportSchema>;
export type ScanHistoryQueryInput = z.infer<typeof scanHistoryQuerySchema>;
export type CompareQueryInput = z.infer<typeof compareQuerySchema>;
export type UpdateTrackingInput = z.infer<typeof updateTrackingSchema>;
export type UpsertScheduleInput = z.infer<typeof upsertScheduleSchema>;
export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
