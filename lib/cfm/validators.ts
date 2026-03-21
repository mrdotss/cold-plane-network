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

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type StartScanInput = z.infer<typeof startScanSchema>;
export type ExportInput = z.infer<typeof exportSchema>;
