/**
 * Relationship Engine — Pure function module.
 * Extracts relationships between Azure resources using ARM ID hierarchy,
 * property references, name heuristics, and RG co-location.
 * NO database imports, NO side effects.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type RelationType =
  | "contains"
  | "network"
  | "storage"
  | "security"
  | "gateway"
  | "monitoring";

export type ConfidenceLevel = "Definite" | "High" | "Medium" | "Low";

export type ExtractionMethod =
  | "arm_hierarchy"
  | "property_ref"
  | "name_heuristic"
  | "rg_heuristic";

export interface ParsedArmId {
  subscriptionId: string;
  resourceGroup: string;
  provider: string;
  resourceType: string;
  resourceName: string;
  childSegments: Array<{ type: string; name: string }>;
  fullType: string;
}

export interface AzureResourceInput {
  id: string;
  name: string;
  type: string;
  location: string | null;
  resourceGroup: string | null;
  armId: string | null;
  raw: string;
}

export interface AzureResourceRelationship {
  sourceResourceId: string;
  targetResourceId: string;
  relationType: RelationType;
  confidence: ConfidenceLevel;
  method: ExtractionMethod;
}

export interface RelationshipResult {
  relationships: AzureResourceRelationship[];
  stats: {
    total: number;
    byType: Record<string, number>;
    byMethod: Record<string, number>;
    byConfidence: Record<string, number>;
  };
}

// ── Confidence ordering (higher index = higher confidence) ─────────────────

const CONFIDENCE_ORDER: Record<ConfidenceLevel, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Definite: 3,
};

// ── ARM ID Parser ──────────────────────────────────────────────────────────

export function parseArmId(armId: string): ParsedArmId | null {
  const segments = armId.split("/");

  // Minimum 9 segments: ["", "subscriptions", sub, "resourceGroups", rg, "providers", ns, type, name]
  if (segments.length < 9) return null;

  // Validate keywords at expected positions (case-insensitive)
  if (segments[1]?.toLowerCase() !== "subscriptions") return null;
  if (segments[3]?.toLowerCase() !== "resourcegroups") return null;
  if (segments[5]?.toLowerCase() !== "providers") return null;

  const subscriptionId = segments[2];
  const resourceGroup = segments[4];
  const provider = segments[6];
  const resourceType = segments[7];
  const resourceName = segments[8];

  // Extract child segments from indices 9+10, 11+12, etc.
  const childSegments: Array<{ type: string; name: string }> = [];
  for (let i = 9; i + 1 < segments.length; i += 2) {
    childSegments.push({ type: segments[i], name: segments[i + 1] });
  }

  const fullType = `${provider}/${resourceType}`.toLowerCase();

  return {
    subscriptionId,
    resourceGroup,
    provider,
    resourceType,
    resourceName,
    childSegments,
    fullType,
  };
}

// ── Relation type helper ───────────────────────────────────────────────────

const AZURE_TYPE_VM = "microsoft.compute/virtualmachines";
const AZURE_TYPE_NIC = "microsoft.network/networkinterfaces";
const AZURE_TYPE_DISK = "microsoft.compute/disks";
const AZURE_TYPE_PUBLIC_IP = "microsoft.network/publicipaddresses";
const AZURE_TYPE_NSG = "microsoft.network/networksecuritygroups";
const AZURE_TYPE_VNET = "microsoft.network/virtualnetworks";
const AZURE_TYPE_SUBNET = "microsoft.network/virtualnetworks/subnets";
const AZURE_TYPE_SCHEDULE = "microsoft.devtestlab/schedules";
const AZURE_TYPE_VPN_GATEWAY = "microsoft.network/virtualnetworkgateways";
const AZURE_TYPE_LOCAL_NET_GATEWAY = "microsoft.network/localnetworkgateways";
const AZURE_TYPE_CONNECTION = "microsoft.network/connections";
const AZURE_TYPE_LOAD_BALANCER = "microsoft.network/loadbalancers";
const AZURE_TYPE_APP_GATEWAY = "microsoft.network/applicationgateways";
const AZURE_TYPE_BASTION = "microsoft.network/bastionhosts";
const AZURE_TYPE_NETWORK_WATCHER = "microsoft.network/networkwatchers";

function inferRelationType(
  sourceType: string,
  targetType: string,
): RelationType {
  const src = sourceType.toLowerCase();
  const tgt = targetType.toLowerCase();

  if (src === AZURE_TYPE_VM && tgt === AZURE_TYPE_NIC) return "network";
  if (src === AZURE_TYPE_VM && tgt === AZURE_TYPE_DISK) return "storage";
  if (src === AZURE_TYPE_NIC && tgt === AZURE_TYPE_PUBLIC_IP) return "network";
  if (src === AZURE_TYPE_NIC && tgt === AZURE_TYPE_NSG) return "security";
  if (src === AZURE_TYPE_NIC && tgt === AZURE_TYPE_SUBNET) return "network";
  if (src === AZURE_TYPE_VNET && tgt === AZURE_TYPE_SUBNET) return "contains";

  // Default for property references — network is a safe fallback
  return "network";
}

// ── ARM Hierarchy extraction ───────────────────────────────────────────────

function extractArmHierarchy(
  resources: AzureResourceInput[],
  armIdLookup: Map<string, AzureResourceInput>,
): AzureResourceRelationship[] {
  const edges: AzureResourceRelationship[] = [];

  for (const resource of resources) {
    if (!resource.armId) continue;

    const parsed = parseArmId(resource.armId);
    if (!parsed || parsed.childSegments.length === 0) continue;

    // Build parent ARM path by removing the last child segment pair
    const segments = resource.armId.split("/");
    // Remove last 2 segments (child type + child name)
    const parentSegments = segments.slice(0, segments.length - 2);
    const parentArmId = parentSegments.join("/");

    const parent = armIdLookup.get(parentArmId.toLowerCase());
    if (parent && parent.id !== resource.id) {
      edges.push({
        sourceResourceId: parent.id,
        targetResourceId: resource.id,
        relationType: "contains",
        confidence: "Definite",
        method: "arm_hierarchy",
      });
    }
  }

  return edges;
}

// ── Property Reference extraction ──────────────────────────────────────────

function collectArmIdStrings(obj: unknown): string[] {
  const results: string[] = [];

  if (typeof obj === "string") {
    if (obj.startsWith("/subscriptions/")) {
      results.push(obj);
    }
    return results;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      results.push(...collectArmIdStrings(item));
    }
    return results;
  }

  if (obj !== null && typeof obj === "object") {
    for (const value of Object.values(obj as Record<string, unknown>)) {
      results.push(...collectArmIdStrings(value));
    }
  }

  return results;
}

function extractPropertyReferences(
  resources: AzureResourceInput[],
  armIdLookup: Map<string, AzureResourceInput>,
): AzureResourceRelationship[] {
  const edges: AzureResourceRelationship[] = [];

  for (const resource of resources) {
    let rawObj: Record<string, unknown>;
    try {
      rawObj = JSON.parse(resource.raw);
    } catch {
      continue;
    }

    const properties = rawObj.properties;
    if (!properties || typeof properties !== "object") continue;

    const armIds = collectArmIdStrings(properties);

    for (const refArmId of armIds) {
      const target = armIdLookup.get(refArmId.toLowerCase());
      if (!target || target.id === resource.id) continue;

      edges.push({
        sourceResourceId: resource.id,
        targetResourceId: target.id,
        relationType: inferRelationType(resource.type, target.type),
        confidence: "Definite",
        method: "property_ref",
      });
    }
  }

  return edges;
}

// ── Name Heuristic helpers ──────────────────────────────────────────────────

function assignConfidence(
  source: AzureResourceInput,
  target: AzureResourceInput,
): ConfidenceLevel {
  const sameRG =
    source.resourceGroup != null &&
    target.resourceGroup != null &&
    source.resourceGroup.toLowerCase() === target.resourceGroup.toLowerCase();
  const sameLoc =
    source.location != null &&
    target.location != null &&
    source.location.toLowerCase() === target.location.toLowerCase();
  return sameRG && sameLoc ? "High" : "Medium";
}

function sameRG(a: AzureResourceInput, b: AzureResourceInput): boolean {
  return (
    a.resourceGroup != null &&
    b.resourceGroup != null &&
    a.resourceGroup.toLowerCase() === b.resourceGroup.toLowerCase()
  );
}

function sameLoc(a: AzureResourceInput, b: AzureResourceInput): boolean {
  return (
    a.location != null &&
    b.location != null &&
    a.location.toLowerCase() === b.location.toLowerCase()
  );
}

/** Strip non-alphanumeric characters and lowercase */
function stripSpecial(s: string): string {
  return s.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/** Compute common prefix length between two strings (case-insensitive) */
function commonPrefixLength(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  let i = 0;
  while (i < la.length && i < lb.length && la[i] === lb[i]) i++;
  return i;
}

/** Score a candidate for ranking when multiple matches exist */
function scoreCandidate(
  source: AzureResourceInput,
  candidate: AzureResourceInput,
  prefixMatchLen: number,
): number {
  let score = 0;
  if (sameRG(source, candidate)) score += 3;
  if (sameLoc(source, candidate)) score += 2;
  score += prefixMatchLen;
  return score;
}

/** Pick the best candidate from a list using score-based ranking */
function pickBestCandidate(
  source: AzureResourceInput,
  candidates: Array<{ resource: AzureResourceInput; prefixLen: number }>,
): AzureResourceInput | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0].resource;

  let best = candidates[0];
  let bestScore = scoreCandidate(source, best.resource, best.prefixLen);

  for (let i = 1; i < candidates.length; i++) {
    const s = scoreCandidate(source, candidates[i].resource, candidates[i].prefixLen);
    if (
      s > bestScore ||
      (s === bestScore && candidates[i].resource.id < best.resource.id)
    ) {
      best = candidates[i];
      bestScore = s;
    }
  }

  return best.resource;
}

// ── Name Heuristic extraction ──────────────────────────────────────────────

export function extractNameHeuristics(
  resources: AzureResourceInput[],
): AzureResourceRelationship[] {
  const edges: AzureResourceRelationship[] = [];

  // Sort resources for determinism
  const sorted = [...resources].sort((a, b) => a.id.localeCompare(b.id));

  // Build type-indexed lookups
  const byType = new Map<string, AzureResourceInput[]>();
  for (const r of sorted) {
    const t = r.type.toLowerCase();
    const list = byType.get(t);
    if (list) list.push(r);
    else byType.set(t, [r]);
  }

  const vms = byType.get(AZURE_TYPE_VM) ?? [];
  const disks = byType.get(AZURE_TYPE_DISK) ?? [];
  const nics = byType.get(AZURE_TYPE_NIC) ?? [];
  const publicIps = byType.get(AZURE_TYPE_PUBLIC_IP) ?? [];
  const nsgs = byType.get(AZURE_TYPE_NSG) ?? [];
  const schedules = byType.get(AZURE_TYPE_SCHEDULE) ?? [];
  const vpnGateways = byType.get(AZURE_TYPE_VPN_GATEWAY) ?? [];
  const connections = byType.get(AZURE_TYPE_CONNECTION) ?? [];
  const localNetGateways = byType.get(AZURE_TYPE_LOCAL_NET_GATEWAY) ?? [];

  // ── VM-based heuristics ──────────────────────────────────────────────

  for (const vm of vms) {
    const vmName = vm.name;
    const vmNameLower = vmName.toLowerCase();
    const vmNameStripped = stripSpecial(vmName);

    // 1. VM → Disk: disk name starts with {VMName}_OsDisk_ or {VMName}_DataDisk_
    const diskCandidates: Array<{ resource: AzureResourceInput; prefixLen: number }> = [];
    for (const disk of disks) {
      const diskNameLower = disk.name.toLowerCase();
      if (
        diskNameLower.startsWith(`${vmNameLower}_osdisk_`) ||
        diskNameLower.startsWith(`${vmNameLower}_datadisk_`)
      ) {
        diskCandidates.push({ resource: disk, prefixLen: vmName.length });
      }
    }
    for (const c of diskCandidates) {
      edges.push({
        sourceResourceId: vm.id,
        targetResourceId: c.resource.id,
        relationType: "storage",
        confidence: assignConfidence(vm, c.resource),
        method: "name_heuristic",
      });
    }

    // 2. VM → NIC: NIC name starts with {vmname stripped} + numeric suffix, same RG
    const nicCandidates: Array<{ resource: AzureResourceInput; prefixLen: number }> = [];
    for (const nic of nics) {
      if (!sameRG(vm, nic)) continue;
      const nicStripped = stripSpecial(nic.name);
      if (
        nicStripped.startsWith(vmNameStripped) &&
        nicStripped.length > vmNameStripped.length
      ) {
        const suffix = nicStripped.slice(vmNameStripped.length);
        if (/^\d+$/.test(suffix)) {
          nicCandidates.push({ resource: nic, prefixLen: vmNameStripped.length });
        }
      }
    }
    const bestNic = pickBestCandidate(vm, nicCandidates);
    if (bestNic) {
      edges.push({
        sourceResourceId: vm.id,
        targetResourceId: bestNic.id,
        relationType: "network",
        confidence: assignConfidence(vm, bestNic),
        method: "name_heuristic",
      });
    }

    // 3. VM → Public IP: name matches {VMName}-ip, same RG
    const pipCandidates: Array<{ resource: AzureResourceInput; prefixLen: number }> = [];
    for (const pip of publicIps) {
      if (!sameRG(vm, pip)) continue;
      if (pip.name.toLowerCase() === `${vmNameLower}-ip`) {
        pipCandidates.push({ resource: pip, prefixLen: vmName.length });
      }
    }
    const bestPip = pickBestCandidate(vm, pipCandidates);
    if (bestPip) {
      edges.push({
        sourceResourceId: vm.id,
        targetResourceId: bestPip.id,
        relationType: "network",
        confidence: assignConfidence(vm, bestPip),
        method: "name_heuristic",
      });
    }

    // 4. VM → NSG: name matches {VMName}-nsg, same RG
    const nsgCandidates: Array<{ resource: AzureResourceInput; prefixLen: number }> = [];
    for (const nsg of nsgs) {
      if (!sameRG(vm, nsg)) continue;
      if (nsg.name.toLowerCase() === `${vmNameLower}-nsg`) {
        nsgCandidates.push({ resource: nsg, prefixLen: vmName.length });
      }
    }
    const bestNsg = pickBestCandidate(vm, nsgCandidates);
    if (bestNsg) {
      edges.push({
        sourceResourceId: vm.id,
        targetResourceId: bestNsg.id,
        relationType: "security",
        confidence: assignConfidence(vm, bestNsg),
        method: "name_heuristic",
      });
    }

    // 5. VM → Schedule: name matches shutdown-computevm-{VMName}, same RG
    const schedCandidates: Array<{ resource: AzureResourceInput; prefixLen: number }> = [];
    for (const sched of schedules) {
      if (!sameRG(vm, sched)) continue;
      if (sched.name.toLowerCase() === `shutdown-computevm-${vmNameLower}`) {
        schedCandidates.push({ resource: sched, prefixLen: vmName.length });
      }
    }
    const bestSched = pickBestCandidate(vm, schedCandidates);
    if (bestSched) {
      edges.push({
        sourceResourceId: vm.id,
        targetResourceId: bestSched.id,
        relationType: "monitoring",
        confidence: assignConfidence(vm, bestSched),
        method: "name_heuristic",
      });
    }
  }

  // ── NIC → NSG: name prefix matching ─────────────────────────────────

  for (const nic of nics) {
    const nicStripped = stripSpecial(nic.name);
    // Extract NIC prefix: strip trailing digits
    const nicPrefix = nicStripped.replace(/\d+$/, "");
    if (nicPrefix.length === 0) continue;

    const nsgCandidates: Array<{ resource: AzureResourceInput; prefixLen: number }> = [];
    for (const nsg of nsgs) {
      if (!sameRG(nic, nsg)) continue;
      const nsgNameLower = nsg.name.toLowerCase();
      // NSG prefix: part before "-nsg"
      const nsgSuffix = "-nsg";
      if (!nsgNameLower.endsWith(nsgSuffix)) continue;
      const nsgPrefix = stripSpecial(nsgNameLower.slice(0, -nsgSuffix.length));
      if (nsgPrefix.length === 0) continue;

      if (nicPrefix === nsgPrefix) {
        nsgCandidates.push({ resource: nsg, prefixLen: commonPrefixLength(nicPrefix, nsgPrefix) });
      }
    }
    const bestNsg = pickBestCandidate(nic, nsgCandidates);
    if (bestNsg) {
      edges.push({
        sourceResourceId: nic.id,
        targetResourceId: bestNsg.id,
        relationType: "security",
        confidence: assignConfidence(nic, bestNsg),
        method: "name_heuristic",
      });
    }
  }

  // ── VPN Gateway → Public IP: name matches {VPNGatewayName}-ip ───────

  for (const gw of vpnGateways) {
    const gwNameLower = gw.name.toLowerCase();
    const pipCandidates: Array<{ resource: AzureResourceInput; prefixLen: number }> = [];
    for (const pip of publicIps) {
      if (!sameRG(gw, pip)) continue;
      if (pip.name.toLowerCase() === `${gwNameLower}-ip`) {
        pipCandidates.push({ resource: pip, prefixLen: gw.name.length });
      }
    }
    const bestPip = pickBestCandidate(gw, pipCandidates);
    if (bestPip) {
      edges.push({
        sourceResourceId: gw.id,
        targetResourceId: bestPip.id,
        relationType: "network",
        confidence: assignConfidence(gw, bestPip),
        method: "name_heuristic",
      });
    }
  }

  // ── Connection → VPN Gateway / Local Network Gateway (same RG) ──────

  for (const conn of connections) {
    // Connection → VPN Gateway: same RG
    const vpnCandidates: Array<{ resource: AzureResourceInput; prefixLen: number }> = [];
    for (const gw of vpnGateways) {
      if (!sameRG(conn, gw)) continue;
      vpnCandidates.push({
        resource: gw,
        prefixLen: commonPrefixLength(conn.name, gw.name),
      });
    }
    const bestVpn = pickBestCandidate(conn, vpnCandidates);
    if (bestVpn) {
      edges.push({
        sourceResourceId: conn.id,
        targetResourceId: bestVpn.id,
        relationType: "gateway",
        confidence: assignConfidence(conn, bestVpn),
        method: "name_heuristic",
      });
    }

    // Connection → Local Network Gateway: same RG
    const lngCandidates: Array<{ resource: AzureResourceInput; prefixLen: number }> = [];
    for (const lng of localNetGateways) {
      if (!sameRG(conn, lng)) continue;
      lngCandidates.push({
        resource: lng,
        prefixLen: commonPrefixLength(conn.name, lng.name),
      });
    }
    const bestLng = pickBestCandidate(conn, lngCandidates);
    if (bestLng) {
      edges.push({
        sourceResourceId: conn.id,
        targetResourceId: bestLng.id,
        relationType: "gateway",
        confidence: assignConfidence(conn, bestLng),
        method: "name_heuristic",
      });
    }
  }

  return edges;
}

// ── RG Co-location extraction ──────────────────────────────────────────────

/** Compatible type pairs for RG co-location heuristic */
const RG_COMPATIBLE_PAIRS: Array<{
  typeA: string;
  typeB: string;
  relationType: RelationType;
}> = [
  { typeA: AZURE_TYPE_NIC, typeB: AZURE_TYPE_NSG, relationType: "security" },
  { typeA: AZURE_TYPE_VPN_GATEWAY, typeB: AZURE_TYPE_PUBLIC_IP, relationType: "network" },
  { typeA: AZURE_TYPE_VNET, typeB: AZURE_TYPE_NETWORK_WATCHER, relationType: "monitoring" },
  { typeA: AZURE_TYPE_LOAD_BALANCER, typeB: AZURE_TYPE_PUBLIC_IP, relationType: "network" },
  { typeA: AZURE_TYPE_APP_GATEWAY, typeB: AZURE_TYPE_PUBLIC_IP, relationType: "network" },
  { typeA: AZURE_TYPE_BASTION, typeB: AZURE_TYPE_PUBLIC_IP, relationType: "network" },
];

export function extractRGCoLocation(
  resources: AzureResourceInput[],
  existingEdges: Set<string>,
): AzureResourceRelationship[] {
  const edges: AzureResourceRelationship[] = [];

  // Sort for determinism
  const sorted = [...resources].sort((a, b) => a.id.localeCompare(b.id));

  // Group resources by RG (lowercased)
  const byRG = new Map<string, AzureResourceInput[]>();
  for (const r of sorted) {
    if (!r.resourceGroup) continue;
    const rgKey = r.resourceGroup.toLowerCase();
    const list = byRG.get(rgKey);
    if (list) list.push(r);
    else byRG.set(rgKey, [r]);
  }

  for (const rgResources of byRG.values()) {
    // Build type-indexed lookup within this RG
    const rgByType = new Map<string, AzureResourceInput[]>();
    for (const r of rgResources) {
      const t = r.type.toLowerCase();
      const list = rgByType.get(t);
      if (list) list.push(r);
      else rgByType.set(t, [r]);
    }

    for (const pair of RG_COMPATIBLE_PAIRS) {
      const listA = rgByType.get(pair.typeA) ?? [];
      const listB = rgByType.get(pair.typeB) ?? [];

      for (const a of listA) {
        for (const b of listB) {
          if (a.id === b.id) continue;
          const edgeKey = `${a.id}::${b.id}`;
          const reverseKey = `${b.id}::${a.id}`;
          if (existingEdges.has(edgeKey) || existingEdges.has(reverseKey)) continue;

          edges.push({
            sourceResourceId: a.id,
            targetResourceId: b.id,
            relationType: pair.relationType,
            confidence: "Low",
            method: "rg_heuristic",
          });

          // Mark as existing to avoid duplicates within RG co-location
          existingEdges.add(edgeKey);
        }
      }
    }
  }

  return edges;
}

// ── Deduplication ──────────────────────────────────────────────────────────

function deduplicateEdges(
  edges: AzureResourceRelationship[],
): AzureResourceRelationship[] {
  const best = new Map<string, AzureResourceRelationship>();

  for (const edge of edges) {
    const key = `${edge.sourceResourceId}::${edge.targetResourceId}`;
    const existing = best.get(key);

    if (
      !existing ||
      CONFIDENCE_ORDER[edge.confidence] >
        CONFIDENCE_ORDER[existing.confidence]
    ) {
      best.set(key, edge);
    }
  }

  return Array.from(best.values());
}

// ── Stats computation ──────────────────────────────────────────────────────

function computeStats(relationships: AzureResourceRelationship[]): RelationshipResult["stats"] {
  const byType: Record<string, number> = {};
  const byMethod: Record<string, number> = {};
  const byConfidence: Record<string, number> = {};

  for (const rel of relationships) {
    byType[rel.relationType] = (byType[rel.relationType] ?? 0) + 1;
    byMethod[rel.method] = (byMethod[rel.method] ?? 0) + 1;
    byConfidence[rel.confidence] = (byConfidence[rel.confidence] ?? 0) + 1;
  }

  return {
    total: relationships.length,
    byType,
    byMethod,
    byConfidence,
  };
}

// ── Main entry point ───────────────────────────────────────────────────────

export function extractRelationships(
  resources: AzureResourceInput[],
): RelationshipResult {
  // Build armId → resource lookup map for O(1) lookups (case-insensitive)
  const armIdLookup = new Map<string, AzureResourceInput>();
  for (const r of resources) {
    if (r.armId) {
      armIdLookup.set(r.armId.toLowerCase(), r);
    }
  }

  // 1. ARM Hierarchy
  const armEdges = extractArmHierarchy(resources, armIdLookup);

  // 2. Property References
  const propEdges = extractPropertyReferences(resources, armIdLookup);

  // 3. Name Heuristics (stub — Task 4)
  const nameEdges = extractNameHeuristics(resources);

  // 4. Collect existing edge keys for RG co-location dedup
  const allPreRG = [...armEdges, ...propEdges, ...nameEdges];
  const existingEdgeKeys = new Set<string>(
    allPreRG.map((e) => `${e.sourceResourceId}::${e.targetResourceId}`),
  );

  // 5. RG Co-location (stub — Task 4)
  const rgEdges = extractRGCoLocation(resources, existingEdgeKeys);

  // Combine all edges and deduplicate
  const allEdges = [...allPreRG, ...rgEdges];
  const relationships = deduplicateEdges(allEdges);

  return {
    relationships,
    stats: computeStats(relationships),
  };
}
