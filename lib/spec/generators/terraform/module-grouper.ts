import type { SpecResource } from "../../schema";
import { getCategoryForType, getModuleName, type AwsCategory } from "../../aws-categories";

export interface ModuleGroup {
  category: AwsCategory;
  moduleName: string;
  resources: SpecResource[];
}

/** Canonical module ordering. */
const MODULE_ORDER: string[] = [
  "networking",
  "compute",
  "database",
  "storage",
  "integration",
  "security",
  "general",
];

/**
 * Group resources by AWS category into module groups.
 * Only returns modules that have at least one resource.
 * Loadbalancing is merged into networking.
 */
export function groupResourcesByModule(
  resources: SpecResource[]
): ModuleGroup[] {
  const groups = new Map<string, { category: AwsCategory; resources: SpecResource[] }>();

  for (const resource of resources) {
    const category = getCategoryForType(resource.type);
    const moduleName = getModuleName(category);

    if (!groups.has(moduleName)) {
      groups.set(moduleName, { category, resources: [] });
    }
    groups.get(moduleName)!.resources.push(resource);
  }

  // Sort by canonical order
  const sorted: ModuleGroup[] = [];
  for (const name of MODULE_ORDER) {
    const group = groups.get(name);
    if (group) {
      sorted.push({ category: group.category, moduleName: name, resources: group.resources });
    }
  }

  // Add any remaining (shouldn't happen, but safety)
  for (const [name, group] of groups) {
    if (!MODULE_ORDER.includes(name)) {
      sorted.push({ category: group.category, moduleName: name, resources: group.resources });
    }
  }

  return sorted;
}
