/**
 * Client-safe Zod schemas for CFM forms.
 * Duplicated from lib/cfm/validators.ts (which has "server-only" guard).
 */
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

export const connectionDetailsSchema = z.object({
  accountName: z.string().min(1, "Account name is required").max(100),
  awsAccountId: awsAccountIdSchema,
  roleArn: roleArnSchema,
  externalId: z.string().max(256).optional(),
});

export const analysisScopeSchema = z.object({
  regions: z.array(z.string()).min(1, "Select at least one region"),
  services: z.array(z.string()).min(1, "Select at least one service"),
});

export type ConnectionDetailsInput = z.infer<typeof connectionDetailsSchema>;
export type AnalysisScopeInput = z.infer<typeof analysisScopeSchema>;
