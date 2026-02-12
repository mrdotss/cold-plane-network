import { z } from "zod";

/** Schema for a single manually-added resource */
export const manualResourceSchema = z.object({
  name: z.string().min(1, { message: "Resource name is required" }),
  type: z.string().min(1, { message: "Resource type is required (e.g. microsoft.compute/virtualmachines)" }),
  kind: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  subscriptionId: z.string().optional().nullable(),
  resourceGroup: z.string().optional().nullable(),
  tags: z.record(z.string(), z.string()).optional().default({}),
}).loose();

/** Schema for a single resource from Azure Resource Graph JSON */
const azureResourceGraphItem = z.object({
  name: z.string(),
  type: z.string(),
  kind: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  sku: z.union([
    z.string(),
    z.object({ name: z.string() }).transform((s) => s.name),
    z.object({ tier: z.string() }).transform((s) => s.tier),
  ]).optional().nullable(),
  subscriptionId: z.string().optional().nullable(),
  resourceGroup: z.string().optional().nullable(),
  tags: z.record(z.string(), z.string()).optional().nullable(),
  id: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
}).loose();

/** Accept bare array, {value: [...]}, or {data: [...]} wrappers */
export const importJsonSchema = z.union([
  z.array(azureResourceGraphItem).min(1, { message: "JSON must contain at least one resource" }),
  z.object({ value: z.array(azureResourceGraphItem).min(1, { message: "JSON must contain at least one resource" }) }).transform((d) => d.value),
  z.object({ data: z.array(azureResourceGraphItem).min(1, { message: "JSON must contain at least one resource" }) }).transform((d) => d.data),
]);

export type ManualResourceInput = z.infer<typeof manualResourceSchema>;
