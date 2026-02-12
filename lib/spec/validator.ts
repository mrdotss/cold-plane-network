import type { ParsedSpec, SpecDiagnostic } from "./schema";
import { RESOURCE_TYPES } from "./schema";

/**
 * Perform semantic validation on a parsed spec.
 * Returns a list of diagnostics (errors, warnings, info).
 * Does not throw.
 */
export function validateSpec(parsed: ParsedSpec): SpecDiagnostic[] {
  const diagnostics: SpecDiagnostic[] = [];
  const { resources } = parsed;

  if (resources.length === 0) {
    return diagnostics;
  }

  const nameSet = new Set<string>();
  const nameTypeSet = new Set<string>();
  const allNames = new Set(resources.map((r) => r.name));

  for (const resource of resources) {
    // Check for duplicate names
    const nameKey = resource.name.toLowerCase();
    if (nameSet.has(nameKey)) {
      diagnostics.push({
        severity: "error",
        message: `Duplicate resource name: "${resource.name}"`,
        nodeId: `${resource.type}:${resource.name}`,
      });
    }
    nameSet.add(nameKey);

    // Track type:name combos for canonical ID uniqueness
    const typeNameKey = `${resource.type}:${resource.name}`.toLowerCase();
    if (nameTypeSet.has(typeNameKey)) {
      diagnostics.push({
        severity: "error",
        message: `Duplicate canonical ID: "${resource.type}:${resource.name}"`,
        nodeId: `${resource.type}:${resource.name}`,
      });
    }
    nameTypeSet.add(typeNameKey);

    // Check resource type validity
    if (
      !RESOURCE_TYPES.includes(
        resource.type.toLowerCase() as (typeof RESOURCE_TYPES)[number]
      )
    ) {
      diagnostics.push({
        severity: "warning",
        message: `Unknown resource type: "${resource.type}"`,
        nodeId: `${resource.type}:${resource.name}`,
      });
    }

    // Check resolvable dependsOn references
    if (resource.dependsOn) {
      for (const dep of resource.dependsOn) {
        if (!allNames.has(dep)) {
          diagnostics.push({
            severity: "warning",
            message: `Unresolved dependsOn reference: "${dep}" in resource "${resource.name}"`,
            nodeId: `${resource.type}:${resource.name}`,
          });
        }
      }
    }

    // Check resolvable connectTo references
    if (resource.connectTo) {
      for (const conn of resource.connectTo) {
        if (!allNames.has(conn)) {
          diagnostics.push({
            severity: "warning",
            message: `Unresolved connectTo reference: "${conn}" in resource "${resource.name}"`,
            nodeId: `${resource.type}:${resource.name}`,
          });
        }
      }
    }

    // Check parent reference is valid
    if (resource.parent && !allNames.has(resource.parent)) {
      diagnostics.push({
        severity: "error",
        message: `Unresolved parent reference: "${resource.parent}" in resource "${resource.name}"`,
        nodeId: `${resource.type}:${resource.name}`,
      });
    }
  }

  return diagnostics;
}
