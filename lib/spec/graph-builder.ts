import type { GraphIR, GraphNode, GraphEdge } from "@/lib/contracts/graph-ir";
import type { ParsedSpec, SpecDiagnostic } from "./schema";

/**
 * Sanitize a string for use in canonical IDs.
 * Lowercase, alphanumeric + hyphens + colons only.
 */
function sanitizeId(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9:-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Build a canonical node ID: `{type}:{name}`
 */
function nodeId(type: string, name: string): string {
  return `${sanitizeId(type)}:${sanitizeId(name)}`;
}

/**
 * Build a canonical edge ID: `{source}:{target}:{relationType}`
 */
function edgeId(
  source: string,
  target: string,
  relationType: GraphEdge["relationType"]
): string {
  return `${source}:${target}:${relationType}`;
}

/* ──────────────────────────────────────────────────────────────── */
/* Type-aware inference rules                                       */
/* ──────────────────────────────────────────────────────────────── */

/**
 * Known "likely communicates" pairs with a reason string.
 * These are directional: source → target.
 * The inference engine checks both directions.
 */
const INFERENCE_RULES: Array<{
  from: string;
  to: string;
  reason: string;
}> = [
  // Compute → Database
  { from: "ec2",        to: "rds",          reason: "compute accesses database" },
  { from: "ec2",        to: "dynamodb",     reason: "compute accesses database" },
  { from: "ec2",        to: "elasticache",  reason: "compute accesses cache" },
  { from: "ec2",        to: "aurora",       reason: "compute accesses database" },
  { from: "lambda",     to: "dynamodb",     reason: "function accesses table" },
  { from: "lambda",     to: "rds",          reason: "function accesses database" },
  { from: "lambda",     to: "aurora",       reason: "function accesses database" },
  { from: "lambda",     to: "elasticache",  reason: "function accesses cache" },
  { from: "ecs",        to: "rds",          reason: "container accesses database" },
  { from: "ecs",        to: "dynamodb",     reason: "container accesses table" },
  { from: "ecs",        to: "aurora",       reason: "container accesses database" },
  { from: "fargate",    to: "rds",          reason: "container accesses database" },
  { from: "fargate",    to: "dynamodb",     reason: "container accesses table" },
  { from: "fargate",    to: "aurora",       reason: "container accesses database" },

  // Compute → Storage
  { from: "ec2",        to: "s3",           reason: "compute uses storage" },
  { from: "lambda",     to: "s3",           reason: "function uses storage" },
  { from: "ecs",        to: "s3",           reason: "container uses storage" },
  { from: "fargate",    to: "s3",           reason: "container uses storage" },
  { from: "ec2",        to: "efs",          reason: "compute mounts filesystem" },

  // Load Balancer → Compute
  { from: "alb",        to: "ec2",          reason: "load balancer routes to compute" },
  { from: "alb",        to: "ecs",          reason: "load balancer routes to container" },
  { from: "alb",        to: "fargate",      reason: "load balancer routes to container" },
  { from: "alb",        to: "lambda",       reason: "ALB invokes function" },
  { from: "nlb",        to: "ec2",          reason: "load balancer routes to compute" },
  { from: "nlb",        to: "ecs",          reason: "load balancer routes to container" },
  { from: "loadbalancer", to: "ec2",        reason: "load balancer routes to compute" },
  { from: "loadbalancer", to: "ecs",        reason: "load balancer routes to container" },
  { from: "loadbalancer", to: "fargate",    reason: "load balancer routes to container" },

  // API Gateway → Compute
  { from: "apigateway", to: "lambda",       reason: "API gateway invokes function" },
  { from: "apigateway", to: "ecs",          reason: "API gateway routes to container" },
  { from: "apigateway", to: "fargate",      reason: "API gateway routes to container" },

  // CloudFront → origin
  { from: "cloudfront", to: "s3",           reason: "CDN serves from storage" },
  { from: "cloudfront", to: "alb",          reason: "CDN routes to load balancer" },
  { from: "cloudfront", to: "apigateway",   reason: "CDN routes to API" },

  // Route53 → frontend
  { from: "route53",    to: "cloudfront",   reason: "DNS resolves to CDN" },
  { from: "route53",    to: "alb",          reason: "DNS resolves to load balancer" },

  // Messaging
  { from: "lambda",     to: "sqs",          reason: "function sends to queue" },
  { from: "sqs",        to: "lambda",       reason: "queue triggers function" },
  { from: "lambda",     to: "sns",          reason: "function publishes to topic" },
  { from: "sns",        to: "lambda",       reason: "topic triggers function" },
  { from: "sns",        to: "sqs",          reason: "topic fans out to queue" },
  { from: "eventbridge",to: "lambda",       reason: "event triggers function" },
  { from: "eventbridge",to: "sqs",          reason: "event routes to queue" },

  // Networking
  { from: "nat",        to: "subnet",       reason: "NAT gateway serves subnet" },
  { from: "gateway",    to: "vpc",          reason: "internet gateway attached to VPC" },
  { from: "securitygroup", to: "ec2",       reason: "security group attached to instance" },
  { from: "securitygroup", to: "rds",       reason: "security group attached to database" },
  { from: "securitygroup", to: "alb",       reason: "security group attached to load balancer" },

  // Security
  { from: "waf",        to: "alb",          reason: "WAF protects load balancer" },
  { from: "waf",        to: "cloudfront",   reason: "WAF protects CDN" },
  { from: "waf",        to: "apigateway",   reason: "WAF protects API" },
  { from: "kms",        to: "s3",           reason: "KMS encrypts storage" },
  { from: "kms",        to: "rds",          reason: "KMS encrypts database" },
  { from: "kms",        to: "ebs",          reason: "KMS encrypts volumes" },
];

/** Build a lookup map: "typeA→typeB" → reason */
function buildInferenceMap(): Map<string, string> {
  const map = new Map<string, string>();
  for (const rule of INFERENCE_RULES) {
    map.set(`${rule.from}→${rule.to}`, rule.reason);
  }
  return map;
}

const inferenceMap = buildInferenceMap();

/**
 * Check if two resource types have a known communication pattern.
 * Returns the inference reason or null.
 */
function getInferenceReason(typeA: string, typeB: string): string | null {
  const a = typeA.toLowerCase();
  const b = typeB.toLowerCase();
  return inferenceMap.get(`${a}→${b}`) ?? inferenceMap.get(`${b}→${a}`) ?? null;
}

/* ──────────────────────────────────────────────────────────────── */
/* Graph builder                                                    */
/* ──────────────────────────────────────────────────────────────── */

export interface BuildGraphResult {
  graphIR: GraphIR;
  diagnostics: SpecDiagnostic[];
}

/**
 * Transform a ParsedSpec into a GraphIR.
 *
 * Edge resolution priority:
 * 1. Containment — parent/child from `children` nesting
 * 2. Reference — explicit `dependsOn` and `connectTo` fields
 * 3. Inferred — type-aware heuristic connections between resources
 *
 * Emits info-level diagnostics for every inferred edge.
 */
export function buildGraphIR(parsed: ParsedSpec): BuildGraphResult {
  const diagnostics: SpecDiagnostic[] = [];
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const edgeSet = new Set<string>();

  // Track connected pairs (direction-independent) to prevent duplicate edges
  const connectedPairs = new Set<string>();

  // Map resource name → canonical node ID for reference resolution
  const nameToNodeId = new Map<string, string>();
  // Map resource name → resource type for inference
  const nameToType = new Map<string, string>();

  // Build nodes
  for (const resource of parsed.resources) {
    const id = nodeId(resource.type, resource.name);
    const parentId = resource.parent
      ? nameToNodeId.get(resource.parent) ?? undefined
      : undefined;

    nameToNodeId.set(resource.name, id);
    nameToType.set(resource.name, resource.type);

    const node: GraphNode = {
      id,
      type: resource.type,
      label: resource.name,
      meta: { ...resource.properties },
    };

    if (parentId) {
      node.groupId = parentId;
    }

    nodes.push(node);
  }

  // Helper: canonical pair key (direction-independent)
  function pairKey(a: string, b: string): string {
    return a < b ? `${a}||${b}` : `${b}||${a}`;
  }

  // Helper to add an edge if not already present
  function addEdge(
    source: string,
    target: string,
    relationType: GraphEdge["relationType"],
    meta: Record<string, unknown> = {}
  ): boolean {
    const id = edgeId(source, target, relationType);
    if (edgeSet.has(id)) return false;
    edgeSet.add(id);
    connectedPairs.add(pairKey(source, target));
    edges.push({ id, source, target, relationType, meta });
    return true;
  }

  // Helper: check if two nodes are already connected in any direction
  function hasAnyEdge(a: string, b: string): boolean {
    return connectedPairs.has(pairKey(a, b));
  }

  // 1. Containment edges — from parent/child relationships
  for (const resource of parsed.resources) {
    if (resource.parent) {
      const childId = nameToNodeId.get(resource.name);
      const parentNodeId = nameToNodeId.get(resource.parent);
      if (childId && parentNodeId) {
        addEdge(parentNodeId, childId, "containment");
      }
    }
  }

  // 2. Reference edges — from dependsOn and connectTo
  for (const resource of parsed.resources) {
    const sourceId = nameToNodeId.get(resource.name);
    if (!sourceId) continue;

    if (resource.dependsOn) {
      for (const dep of resource.dependsOn) {
        const targetId = nameToNodeId.get(dep);
        if (targetId && !hasAnyEdge(sourceId, targetId)) {
          // dependsOn: edge goes FROM dependency TO dependent (parent → child direction)
          addEdge(targetId, sourceId, "reference", { edgeKind: "dependsOn" });
        }
      }
    }

    if (resource.connectTo) {
      for (const conn of resource.connectTo) {
        const targetId = nameToNodeId.get(conn);
        if (targetId && !hasAnyEdge(sourceId, targetId)) {
          addEdge(sourceId, targetId, "reference", { edgeKind: "connectTo" });
        }
      }
    }
  }

  // 3. Inferred edges — type-aware heuristic connections
  // Check every pair of resources (not just siblings) for known communication patterns
  const allNames = [...nameToNodeId.keys()];
  for (let i = 0; i < allNames.length; i++) {
    for (let j = i + 1; j < allNames.length; j++) {
      const nameA = allNames[i];
      const nameB = allNames[j];
      const idA = nameToNodeId.get(nameA)!;
      const idB = nameToNodeId.get(nameB)!;

      // Skip if already connected by explicit edge
      if (hasAnyEdge(idA, idB)) continue;

      const typeA = nameToType.get(nameA)!;
      const typeB = nameToType.get(nameB)!;
      const reason = getInferenceReason(typeA, typeB);

      if (reason) {
        // Determine direction: check which order the rule uses
        const forwardReason = inferenceMap.get(`${typeA.toLowerCase()}→${typeB.toLowerCase()}`);
        const [source, target] = forwardReason ? [idA, idB] : [idB, idA];

        const added = addEdge(source, target, "inferred", { reason });
        if (added) {
          diagnostics.push({
            severity: "info",
            message: `Inferred: "${nameA}" → "${nameB}" (${reason})`,
            nodeId: source,
          });
        }
      }
    }
  }

  return {
    graphIR: {
      version: "1",
      nodes,
      edges,
    },
    diagnostics,
  };
}
