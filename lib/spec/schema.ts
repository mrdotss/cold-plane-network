/**
 * Spec schema types for the Cold Network Plane DSL.
 *
 * The spec format is YAML-based. Each resource is declared as a keyed block
 * under a top-level `resources` array:
 *
 * ```yaml
 * resources:
 *   - name: production
 *     type: vpc
 *     properties:
 *       cidr: "10.0.0.0/16"
 *       region: us-east-1
 *     children:
 *       - name: web-tier
 *         type: subnet
 *         properties:
 *           cidr: "10.0.1.0/24"
 *   - name: firewall-1
 *     type: firewall
 *     properties:
 *       vendor: mikrotik
 *     dependsOn:
 *       - production
 *     connectTo:
 *       - web-tier
 * ```
 */

/** Valid resource types recognized by the spec engine. */
export const RESOURCE_TYPES = [
  "vpc",
  "subnet",
  "router",
  "firewall",
  "switch",
  "server",
  "loadbalancer",
  "gateway",
  "dns",
  "vpn",
  "nat",
  "peering",
  "endpoint",
  "securitygroup",
  "routetable",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

/** A single network/cloud resource parsed from the spec. */
export interface SpecResource {
  /** Unique name within the spec. */
  name: string;
  /** Resource type (must be one of RESOURCE_TYPES). */
  type: string;
  /** Optional parent resource name (set when nested via `children`). */
  parent?: string;
  /** Arbitrary key-value properties for the resource. */
  properties: Record<string, unknown>;
  /** Explicit dependency references by resource name. */
  dependsOn?: string[];
  /** Explicit connection references by resource name. */
  connectTo?: string[];
}

/** Diagnostic produced during parsing or validation. */
export interface SpecDiagnostic {
  /** Severity level. */
  severity: "error" | "warning" | "info";
  /** Human-readable message. */
  message: string;
  /** Source line number (1-based), if available. */
  line?: number;
  /** Source column number (1-based), if available. */
  column?: number;
  /** Associated node ID (canonical format), if applicable. */
  nodeId?: string;
}

/** Result of parsing a raw spec text. */
export interface ParsedSpec {
  /** Flat list of all resources (children are flattened with `parent` set). */
  resources: SpecResource[];
  /** Diagnostics produced during parsing (syntax errors, etc.). */
  errors: SpecDiagnostic[];
}
