import yaml from "js-yaml";
import type { ParsedSpec, SpecResource, SpecDiagnostic } from "./schema";

/**
 * Raw shape expected from YAML parsing before normalization.
 */
interface RawResource {
  name?: unknown;
  type?: unknown;
  properties?: unknown;
  dependsOn?: unknown;
  connectTo?: unknown;
  children?: unknown;
}

interface RawSpec {
  resources?: unknown;
}

/**
 * Flatten nested children into a flat resource list, setting `parent` on each child.
 */
function flattenResources(
  raw: RawResource[],
  parentName: string | undefined,
  diagnostics: SpecDiagnostic[],
  lineHint?: number
): SpecResource[] {
  const result: SpecResource[] = [];

  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      diagnostics.push({
        severity: "error",
        message: "Resource entry must be an object",
        line: lineHint,
      });
      continue;
    }

    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    const type = typeof entry.type === "string" ? entry.type.trim().toLowerCase() : "";

    if (!name) {
      diagnostics.push({
        severity: "error",
        message: "Resource is missing required field: name",
        line: lineHint,
      });
      continue;
    }

    if (!type) {
      diagnostics.push({
        severity: "error",
        message: `Resource "${name}" is missing required field: type`,
        line: lineHint,
        nodeId: name,
      });
      continue;
    }

    const properties: Record<string, unknown> =
      entry.properties !== null &&
      typeof entry.properties === "object" &&
      !Array.isArray(entry.properties)
        ? (entry.properties as Record<string, unknown>)
        : {};

    const dependsOn = normalizeStringArray(entry.dependsOn);
    const connectTo = normalizeStringArray(entry.connectTo);

    const resource: SpecResource = {
      name,
      type,
      properties,
    };

    if (parentName) {
      resource.parent = parentName;
    }
    if (dependsOn.length > 0) {
      resource.dependsOn = dependsOn;
    }
    if (connectTo.length > 0) {
      resource.connectTo = connectTo;
    }

    result.push(resource);

    // Recurse into children
    if (Array.isArray(entry.children)) {
      const children = flattenResources(
        entry.children as RawResource[],
        name,
        diagnostics,
        lineHint
      );
      result.push(...children);
    }
  }

  return result;
}

/**
 * Normalize a field that should be a string array.
 */
function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

/**
 * Parse raw spec text (YAML format) into a ParsedSpec.
 * Never throws — all errors are captured as diagnostics.
 */
export function parseSpec(rawText: string): ParsedSpec {
  const diagnostics: SpecDiagnostic[] = [];

  if (!rawText || rawText.trim().length === 0) {
    return { resources: [], errors: [] };
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(rawText);
  } catch (err: unknown) {
    const yamlErr = err as { mark?: { line?: number; column?: number }; message?: string };
    diagnostics.push({
      severity: "error",
      message: `YAML syntax error: ${yamlErr.message ?? "Unknown parse error"}`,
      line: yamlErr.mark?.line != null ? yamlErr.mark.line + 1 : undefined,
      column: yamlErr.mark?.column != null ? yamlErr.mark.column + 1 : undefined,
    });
    return { resources: [], errors: diagnostics };
  }

  if (parsed === null || parsed === undefined) {
    return { resources: [], errors: [] };
  }

  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    diagnostics.push({
      severity: "error",
      message: "Spec must be a YAML mapping with a top-level 'resources' key",
    });
    return { resources: [], errors: diagnostics };
  }

  const spec = parsed as RawSpec;

  if (!spec.resources) {
    diagnostics.push({
      severity: "warning",
      message: "Spec has no 'resources' key — nothing to parse",
    });
    return { resources: [], errors: diagnostics };
  }

  if (!Array.isArray(spec.resources)) {
    diagnostics.push({
      severity: "error",
      message: "'resources' must be an array",
    });
    return { resources: [], errors: diagnostics };
  }

  const resources = flattenResources(
    spec.resources as RawResource[],
    undefined,
    diagnostics
  );

  return { resources, errors: diagnostics };
}
