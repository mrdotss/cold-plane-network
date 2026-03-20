import { z } from "zod";

export const createReportSchema = z.object({
  fileName: z.string().min(1),
  reportType: z.enum(["report"]),
  region: z.string().default(""),
  totalMonthly: z.number().min(0).default(0),
  totalAnnual: z.number().min(0).default(0),
  serviceCount: z.number().int().min(0).default(0),
  metadata: z.string().max(1024).default("{}"),
});

export const recommendRequestSchema = z.object({
  pricingContext: z.string().min(1).max(50000),
  userDescription: z.string().min(1).max(5000),
});

export const autofillRequestSchema = z.object({
  services: z.array(z.object({
    serviceName: z.string().min(1),
    description: z.string(),
    region: z.string().min(1),
    properties: z.record(z.string(), z.string()).default({}),
    currentPricing: z.object({
      monthly: z.string(),
      upfront: z.string(),
      twelve_months: z.string(),
    }).optional(),
  })).min(1).max(100),
  inputTier: z.enum(["onDemand", "ri1Year", "ri3Year"]),
  missingTiers: z.array(z.enum(["onDemand", "ri1Year", "ri3Year"])).min(1).max(3),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type RecommendRequestInput = z.infer<typeof recommendRequestSchema>;
export type AutofillRequestInput = z.infer<typeof autofillRequestSchema>;
