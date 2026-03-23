import type { SpecResource } from "../../schema";

/**
 * Sanitize a resource name for use as a Terraform identifier.
 */
export function terraformName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
}

/**
 * Format a value as HCL literal.
 */
export function hclValue(value: unknown): string {
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return `[${value.map(hclValue).join(", ")}]`;
  return `"${String(value)}"`;
}

/**
 * Map spec properties to HCL attribute lines.
 * Known properties become real attributes; unknown become comments.
 */
export function mapProperties(
  resource: SpecResource,
  propMap: Record<string, string>
): { mapped: string[]; unmapped: string[] } {
  const mapped: string[] = [];
  const unmapped: string[] = [];

  for (const [key, value] of Object.entries(resource.properties)) {
    const tfAttr = propMap[key.toLowerCase()];
    if (tfAttr) {
      mapped.push(`  ${tfAttr} = ${hclValue(value)}`);
    } else {
      unmapped.push(`  # ${key} = ${hclValue(value)}`);
    }
  }

  return { mapped, unmapped };
}

/**
 * Build a standard tags block.
 */
export function tagsBlock(name: string, extra?: Record<string, string>): string {
  const lines = ["  tags = {"];
  lines.push(`    Name = "${name}"`);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      lines.push(`    ${k} = "${v}"`);
    }
  }
  lines.push("  }");
  return lines.join("\n");
}

/**
 * Build a variable block.
 */
export function hclVariable(
  name: string,
  type: string,
  description: string,
  defaultValue?: string
): string {
  const lines = [`variable "${name}" {`];
  lines.push(`  description = "${description}"`);
  lines.push(`  type        = ${type}`);
  if (defaultValue !== undefined) {
    lines.push(`  default     = ${defaultValue}`);
  }
  lines.push("}");
  return lines.join("\n");
}

/**
 * Build an output block.
 */
export function hclOutput(
  name: string,
  value: string,
  description: string
): string {
  return [
    `output "${name}" {`,
    `  description = "${description}"`,
    `  value       = ${value}`,
    "}",
  ].join("\n");
}
