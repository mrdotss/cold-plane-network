/**
 * AWS service category taxonomy.
 *
 * Single source of truth used by:
 * - Topology icons (color mapping)
 * - Terraform module grouping (folder assignment)
 * - SpecForm dropdown (grouped selector)
 */

export const AWS_CATEGORIES = {
  networking: {
    label: "Networking & Content Delivery",
    color: "purple",
    types: [
      "vpc",
      "subnet",
      "routetable",
      "securitygroup",
      "nat",
      "gateway",
      "vpn",
      "peering",
      "endpoint",
      "transitgateway",
      "cloudfront",
      "apigateway",
      "route53",
    ],
  },
  compute: {
    label: "Compute",
    color: "orange",
    types: ["ec2", "lambda", "ecs", "fargate", "autoscaling"],
  },
  database: {
    label: "Database",
    color: "blue",
    types: ["rds", "dynamodb", "elasticache", "aurora"],
  },
  storage: {
    label: "Storage",
    color: "green",
    types: ["s3", "efs", "ebs"],
  },
  loadbalancing: {
    label: "Load Balancing",
    color: "purple",
    types: ["alb", "nlb", "loadbalancer"],
  },
  integration: {
    label: "Application Integration",
    color: "pink",
    types: ["sqs", "sns", "eventbridge"],
  },
  security: {
    label: "Security & Identity",
    color: "red",
    types: ["iam-role", "waf", "kms"],
  },
  general: {
    label: "General",
    color: "neutral",
    types: ["server", "router", "firewall", "switch", "dns"],
  },
} as const;

export type AwsCategory = keyof typeof AWS_CATEGORIES;

/** Reverse-lookup: resource type → category key. */
const TYPE_TO_CATEGORY: Record<string, AwsCategory> = {};
for (const [category, def] of Object.entries(AWS_CATEGORIES)) {
  for (const t of def.types) {
    TYPE_TO_CATEGORY[t] = category as AwsCategory;
  }
}

/**
 * Get the AWS category for a resource type.
 * Returns "general" for unknown types.
 */
export function getCategoryForType(type: string): AwsCategory {
  return TYPE_TO_CATEGORY[type.toLowerCase()] ?? "general";
}

/**
 * Get all resource types grouped by category.
 * Useful for building grouped dropdowns.
 */
export function getGroupedResourceTypes(): Record<
  AwsCategory,
  { label: string; types: readonly string[] }
> {
  const grouped = {} as Record<
    AwsCategory,
    { label: string; types: readonly string[] }
  >;
  for (const [key, def] of Object.entries(AWS_CATEGORIES)) {
    grouped[key as AwsCategory] = { label: def.label, types: def.types };
  }
  return grouped;
}

/**
 * Get the Terraform module folder name for a category.
 * Loadbalancing is merged into networking.
 */
export function getModuleName(category: AwsCategory): string {
  if (category === "loadbalancing") return "networking";
  return category;
}
