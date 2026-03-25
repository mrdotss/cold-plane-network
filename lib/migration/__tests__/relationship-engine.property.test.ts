import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { extractRelationships } from "@/lib/migration/relationship-engine";
import type { AzureResourceInput } from "@/lib/migration/relationship-engine";

/**
 * **Validates: Requirements 3.1, 4.1**
 *
 * Property 3: ARM hierarchy relationship extraction
 *
 * For any set of Azure resources where one resource's ARM ID is a parent prefix
 * of another resource's ARM ID (e.g., `.../virtualMachines/MyVM` is a prefix of
 * `.../virtualMachines/MyVM/extensions/MDE`), the relationship engine SHALL
 * produce a `contains` relationship from the parent to the child with `Definite`
 * confidence and `arm_hierarchy` method.
 */

// ── Arbitrary generators ───────────────────────────────────────────────────

const arbAlphanumeric = fc
  .string({ minLength: 1, maxLength: 20 })
  .map((s) => s.replace(/[^a-z0-9]/gi, "a"))
  .filter((s) => s.length >= 1);

const arbSubscriptionId = fc.uuid();

const arbResourceGroup = arbAlphanumeric;

const arbVMName = arbAlphanumeric;

const arbExtensionName = arbAlphanumeric;

// ── Helper ─────────────────────────────────────────────────────────────────

function makeResource(
  overrides: Partial<AzureResourceInput> & { name: string; type: string },
): AzureResourceInput {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: overrides.name,
    type: overrides.type,
    location: overrides.location ?? null,
    resourceGroup: overrides.resourceGroup ?? null,
    armId: overrides.armId ?? null,
    raw: overrides.raw ?? "{}",
  };
}

// ── Property 3 tests ───────────────────────────────────────────────────────

describe("Property 3: ARM hierarchy relationship extraction", () => {
  it("produces a contains relationship from parent VM to child extension with Definite confidence and arm_hierarchy method", () => {
    fc.assert(
      fc.property(
        arbSubscriptionId,
        arbResourceGroup,
        arbVMName,
        arbExtensionName,
        (subscriptionId, resourceGroup, vmName, extensionName) => {
          const parentArmId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Compute/virtualMachines/${vmName}`;
          const childArmId = `${parentArmId}/extensions/${extensionName}`;

          const parentId = crypto.randomUUID();
          const childId = crypto.randomUUID();

          const parent = makeResource({
            id: parentId,
            name: vmName,
            type: "microsoft.compute/virtualmachines",
            armId: parentArmId,
            resourceGroup,
          });

          const child = makeResource({
            id: childId,
            name: extensionName,
            type: "microsoft.compute/virtualmachines/extensions",
            armId: childArmId,
            resourceGroup,
          });

          const result = extractRelationships([parent, child]);

          const armHierarchyRels = result.relationships.filter(
            (r) => r.method === "arm_hierarchy",
          );

          // Must produce at least one arm_hierarchy relationship
          expect(armHierarchyRels.length).toBeGreaterThanOrEqual(1);

          // Find the specific parent→child relationship
          const parentChildRel = armHierarchyRels.find(
            (r) =>
              r.sourceResourceId === parentId &&
              r.targetResourceId === childId,
          );

          expect(parentChildRel).toBeDefined();
          expect(parentChildRel!.relationType).toBe("contains");
          expect(parentChildRel!.confidence).toBe("Definite");
          expect(parentChildRel!.method).toBe("arm_hierarchy");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("produces no arm_hierarchy relationships when no ARM ID is a prefix of another", () => {
    fc.assert(
      fc.property(
        arbSubscriptionId,
        arbResourceGroup,
        arbVMName,
        arbVMName,
        (subscriptionId, resourceGroup, vmName1, vmName2) => {
          // Ensure distinct VM names so neither ARM ID is a prefix of the other
          const name1 = `${vmName1}A`;
          const name2 = `${vmName2}B`;

          const vm1ArmId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Compute/virtualMachines/${name1}`;
          const vm2ArmId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/networkInterfaces/${name2}`;

          const vm1 = makeResource({
            id: crypto.randomUUID(),
            name: name1,
            type: "microsoft.compute/virtualmachines",
            armId: vm1ArmId,
            resourceGroup,
          });

          const vm2 = makeResource({
            id: crypto.randomUUID(),
            name: name2,
            type: "microsoft.network/networkinterfaces",
            armId: vm2ArmId,
            resourceGroup,
          });

          const result = extractRelationships([vm1, vm2]);

          const armHierarchyRels = result.relationships.filter(
            (r) => r.method === "arm_hierarchy",
          );

          expect(armHierarchyRels.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 4 tests ───────────────────────────────────────────────────────

/**
 * **Validates: Requirements 3.2, 4.2**
 *
 * Property 4: Property reference relationship extraction
 *
 * For any set of Azure resources where one resource's `properties` JSON
 * contains an ARM ID string that matches another resource's `armId`, the
 * relationship engine SHALL produce a relationship with the appropriate
 * `RelationType`, `Definite` confidence, and `property_ref` method.
 */

describe("Property 4: Property reference relationship extraction", () => {
  it("produces a property_ref relationship from VM to NIC when VM properties contain the NIC ARM ID", () => {
    fc.assert(
      fc.property(
        arbSubscriptionId,
        arbResourceGroup,
        arbAlphanumeric,
        arbAlphanumeric,
        (subscriptionId, resourceGroup, vmName, nicName) => {
          const vmArmId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Compute/virtualMachines/${vmName}`;
          const nicArmId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/networkInterfaces/${nicName}`;

          const vmId = crypto.randomUUID();
          const nicId = crypto.randomUUID();

          const vm = makeResource({
            id: vmId,
            name: vmName,
            type: "microsoft.compute/virtualmachines",
            armId: vmArmId,
            resourceGroup,
            raw: JSON.stringify({
              properties: {
                networkProfile: {
                  networkInterfaces: [{ id: nicArmId }],
                },
              },
            }),
          });

          const nic = makeResource({
            id: nicId,
            name: nicName,
            type: "microsoft.network/networkinterfaces",
            armId: nicArmId,
            resourceGroup,
          });

          const result = extractRelationships([vm, nic]);

          const propRefRels = result.relationships.filter(
            (r) => r.method === "property_ref",
          );

          // Must produce at least one property_ref relationship
          expect(propRefRels.length).toBeGreaterThanOrEqual(1);

          // Find the specific VM→NIC relationship
          const vmToNicRel = propRefRels.find(
            (r) =>
              r.sourceResourceId === vmId && r.targetResourceId === nicId,
          );

          expect(vmToNicRel).toBeDefined();
          expect(vmToNicRel!.confidence).toBe("Definite");
          expect(vmToNicRel!.method).toBe("property_ref");
          // VM → NIC should produce a "network" relation type
          expect(vmToNicRel!.relationType).toBe("network");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("produces no property_ref relationships when no properties contain ARM ID references to other resources", () => {
    fc.assert(
      fc.property(
        arbSubscriptionId,
        arbResourceGroup,
        arbAlphanumeric,
        arbAlphanumeric,
        (subscriptionId, resourceGroup, vmName, nicName) => {
          const vmArmId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Compute/virtualMachines/${vmName}`;
          const nicArmId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/networkInterfaces/${nicName}`;

          const vm = makeResource({
            id: crypto.randomUUID(),
            name: vmName,
            type: "microsoft.compute/virtualmachines",
            armId: vmArmId,
            resourceGroup,
            // properties with no ARM ID references
            raw: JSON.stringify({
              properties: {
                hardwareProfile: { vmSize: "Standard_DS1_v2" },
                osProfile: { computerName: vmName },
              },
            }),
          });

          const nic = makeResource({
            id: crypto.randomUUID(),
            name: nicName,
            type: "microsoft.network/networkinterfaces",
            armId: nicArmId,
            resourceGroup,
            // No properties at all
            raw: "{}",
          });

          const result = extractRelationships([vm, nic]);

          const propRefRels = result.relationships.filter(
            (r) => r.method === "property_ref",
          );

          expect(propRefRels.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 5 tests ───────────────────────────────────────────────────────

/**
 * **Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7**
 *
 * Property 5: Name heuristic relationship extraction
 *
 * For any VM resource and a set of related resources following Azure naming
 * conventions (Disk named `{VMName}_OsDisk_*`, NIC named `{vmname}{digits}`,
 * Public IP named `{VMName}-ip`, NSG named `{VMName}-nsg`, Schedule named
 * `shutdown-computevm-{VMName}`) in the same resource group, the relationship
 * engine SHALL produce the correct relationship type (`storage`, `network`,
 * `network`, `security`, `monitoring` respectively) for each matching pair.
 */

describe("Property 5: Name heuristic relationship extraction", () => {
  it("VM → Disk (OsDisk): produces a storage relationship with name_heuristic method", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbResourceGroup,
        fc.integer({ min: 0, max: 99 }).map((n) => String(n)),
        (vmName, resourceGroup, diskSuffix) => {
          const location = "eastus";
          const vmId = crypto.randomUUID();
          const diskId = crypto.randomUUID();
          const diskName = `${vmName}_OsDisk_${diskSuffix}`;

          const vm = makeResource({
            id: vmId,
            name: vmName,
            type: "microsoft.compute/virtualmachines",
            resourceGroup,
            location,
          });

          const disk = makeResource({
            id: diskId,
            name: diskName,
            type: "microsoft.compute/disks",
            resourceGroup,
            location,
          });

          const result = extractRelationships([vm, disk]);

          const nameHeuristicRels = result.relationships.filter(
            (r) =>
              r.method === "name_heuristic" &&
              r.sourceResourceId === vmId &&
              r.targetResourceId === diskId,
          );

          expect(nameHeuristicRels.length).toBeGreaterThanOrEqual(1);
          expect(nameHeuristicRels[0].relationType).toBe("storage");
          expect(nameHeuristicRels[0].method).toBe("name_heuristic");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("VM → Disk (DataDisk): produces a storage relationship with name_heuristic method", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbResourceGroup,
        fc.integer({ min: 0, max: 99 }).map((n) => String(n)),
        (vmName, resourceGroup, diskSuffix) => {
          const location = "eastus";
          const vmId = crypto.randomUUID();
          const diskId = crypto.randomUUID();
          const diskName = `${vmName}_DataDisk_${diskSuffix}`;

          const vm = makeResource({
            id: vmId,
            name: vmName,
            type: "microsoft.compute/virtualmachines",
            resourceGroup,
            location,
          });

          const disk = makeResource({
            id: diskId,
            name: diskName,
            type: "microsoft.compute/disks",
            resourceGroup,
            location,
          });

          const result = extractRelationships([vm, disk]);

          const nameHeuristicRels = result.relationships.filter(
            (r) =>
              r.method === "name_heuristic" &&
              r.sourceResourceId === vmId &&
              r.targetResourceId === diskId,
          );

          expect(nameHeuristicRels.length).toBeGreaterThanOrEqual(1);
          expect(nameHeuristicRels[0].relationType).toBe("storage");
          expect(nameHeuristicRels[0].method).toBe("name_heuristic");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("VM → NIC: produces a network relationship with name_heuristic method", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbResourceGroup,
        fc.integer({ min: 1, max: 999 }).map((n) => String(n)),
        (vmName, resourceGroup, nicSuffix) => {
          const location = "eastus";
          const vmId = crypto.randomUUID();
          const nicId = crypto.randomUUID();
          // NIC name: stripped VM name (lowercase, no special chars) + numeric suffix
          const strippedVmName = vmName
            .replace(/[^a-z0-9]/gi, "")
            .toLowerCase();
          const nicName = `${strippedVmName}${nicSuffix}`;

          const vm = makeResource({
            id: vmId,
            name: vmName,
            type: "microsoft.compute/virtualmachines",
            resourceGroup,
            location,
          });

          const nic = makeResource({
            id: nicId,
            name: nicName,
            type: "microsoft.network/networkinterfaces",
            resourceGroup,
            location,
          });

          const result = extractRelationships([vm, nic]);

          const nameHeuristicRels = result.relationships.filter(
            (r) =>
              r.method === "name_heuristic" &&
              r.sourceResourceId === vmId &&
              r.targetResourceId === nicId,
          );

          expect(nameHeuristicRels.length).toBeGreaterThanOrEqual(1);
          expect(nameHeuristicRels[0].relationType).toBe("network");
          expect(nameHeuristicRels[0].method).toBe("name_heuristic");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("VM → Public IP: produces a network relationship with name_heuristic method", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbResourceGroup,
        (vmName, resourceGroup) => {
          const location = "eastus";
          const vmId = crypto.randomUUID();
          const pipId = crypto.randomUUID();
          const pipName = `${vmName}-ip`;

          const vm = makeResource({
            id: vmId,
            name: vmName,
            type: "microsoft.compute/virtualmachines",
            resourceGroup,
            location,
          });

          const pip = makeResource({
            id: pipId,
            name: pipName,
            type: "microsoft.network/publicipaddresses",
            resourceGroup,
            location,
          });

          const result = extractRelationships([vm, pip]);

          const nameHeuristicRels = result.relationships.filter(
            (r) =>
              r.method === "name_heuristic" &&
              r.sourceResourceId === vmId &&
              r.targetResourceId === pipId,
          );

          expect(nameHeuristicRels.length).toBeGreaterThanOrEqual(1);
          expect(nameHeuristicRels[0].relationType).toBe("network");
          expect(nameHeuristicRels[0].method).toBe("name_heuristic");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("VM → NSG: produces a security relationship with name_heuristic method", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbResourceGroup,
        (vmName, resourceGroup) => {
          const location = "eastus";
          const vmId = crypto.randomUUID();
          const nsgId = crypto.randomUUID();
          const nsgName = `${vmName}-nsg`;

          const vm = makeResource({
            id: vmId,
            name: vmName,
            type: "microsoft.compute/virtualmachines",
            resourceGroup,
            location,
          });

          const nsg = makeResource({
            id: nsgId,
            name: nsgName,
            type: "microsoft.network/networksecuritygroups",
            resourceGroup,
            location,
          });

          const result = extractRelationships([vm, nsg]);

          const nameHeuristicRels = result.relationships.filter(
            (r) =>
              r.method === "name_heuristic" &&
              r.sourceResourceId === vmId &&
              r.targetResourceId === nsgId,
          );

          expect(nameHeuristicRels.length).toBeGreaterThanOrEqual(1);
          expect(nameHeuristicRels[0].relationType).toBe("security");
          expect(nameHeuristicRels[0].method).toBe("name_heuristic");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("VM → Schedule: produces a monitoring relationship with name_heuristic method", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbResourceGroup,
        (vmName, resourceGroup) => {
          const location = "eastus";
          const vmId = crypto.randomUUID();
          const schedId = crypto.randomUUID();
          const schedName = `shutdown-computevm-${vmName}`;

          const vm = makeResource({
            id: vmId,
            name: vmName,
            type: "microsoft.compute/virtualmachines",
            resourceGroup,
            location,
          });

          const sched = makeResource({
            id: schedId,
            name: schedName,
            type: "microsoft.devtestlab/schedules",
            resourceGroup,
            location,
          });

          const result = extractRelationships([vm, sched]);

          const nameHeuristicRels = result.relationships.filter(
            (r) =>
              r.method === "name_heuristic" &&
              r.sourceResourceId === vmId &&
              r.targetResourceId === schedId,
          );

          expect(nameHeuristicRels.length).toBeGreaterThanOrEqual(1);
          expect(nameHeuristicRels[0].relationType).toBe("monitoring");
          expect(nameHeuristicRels[0].method).toBe("name_heuristic");
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 6 tests ───────────────────────────────────────────────────────

/**
 * **Validates: Requirements 4.3, 4.4**
 *
 * Property 6: Name heuristic confidence scoring
 *
 * For any name-heuristic relationship, the relationship engine SHALL assign
 * `High` confidence when both resources share the same resource group and
 * location, and `Medium` confidence when resources do not share the same
 * resource group.
 */

describe("Property 6: Name heuristic confidence scoring", () => {
  it("assigns High confidence when VM and disk share the same RG and location", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbResourceGroup,
        fc.constantFrom("eastus", "westus", "northeurope", "southeastasia"),
        fc.integer({ min: 0, max: 99 }).map((n) => String(n)),
        (vmName, resourceGroup, location, diskSuffix) => {
          const vmId = crypto.randomUUID();
          const diskId = crypto.randomUUID();
          const diskName = `${vmName}_OsDisk_${diskSuffix}`;

          const vm = makeResource({
            id: vmId,
            name: vmName,
            type: "microsoft.compute/virtualmachines",
            resourceGroup,
            location,
          });

          const disk = makeResource({
            id: diskId,
            name: diskName,
            type: "microsoft.compute/disks",
            resourceGroup,
            location,
          });

          const result = extractRelationships([vm, disk]);

          const nameRels = result.relationships.filter(
            (r) =>
              r.method === "name_heuristic" &&
              r.sourceResourceId === vmId &&
              r.targetResourceId === diskId,
          );

          expect(nameRels.length).toBeGreaterThanOrEqual(1);
          expect(nameRels[0].confidence).toBe("High");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("assigns Medium confidence when VM and disk share the same RG but different location", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbResourceGroup,
        fc.integer({ min: 0, max: 99 }).map((n) => String(n)),
        (vmName, resourceGroup, diskSuffix) => {
          const vmId = crypto.randomUUID();
          const diskId = crypto.randomUUID();
          const diskName = `${vmName}_OsDisk_${diskSuffix}`;

          const vm = makeResource({
            id: vmId,
            name: vmName,
            type: "microsoft.compute/virtualmachines",
            resourceGroup,
            location: "eastus",
          });

          const disk = makeResource({
            id: diskId,
            name: diskName,
            type: "microsoft.compute/disks",
            resourceGroup,
            location: "westeurope",
          });

          const result = extractRelationships([vm, disk]);

          const nameRels = result.relationships.filter(
            (r) =>
              r.method === "name_heuristic" &&
              r.sourceResourceId === vmId &&
              r.targetResourceId === diskId,
          );

          expect(nameRels.length).toBeGreaterThanOrEqual(1);
          expect(nameRels[0].confidence).toBe("Medium");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("assigns Medium confidence when VM and disk have different resource groups", () => {
    fc.assert(
      fc.property(
        arbAlphanumeric,
        arbResourceGroup,
        arbResourceGroup,
        fc.constantFrom("eastus", "westus", "northeurope"),
        fc.integer({ min: 0, max: 99 }).map((n) => String(n)),
        (vmName, rg1, rg2, location, diskSuffix) => {
          // Ensure different resource groups
          const vmRG = `${rg1}A`;
          const diskRG = `${rg2}B`;
          const vmId = crypto.randomUUID();
          const diskId = crypto.randomUUID();
          const diskName = `${vmName}_OsDisk_${diskSuffix}`;

          const vm = makeResource({
            id: vmId,
            name: vmName,
            type: "microsoft.compute/virtualmachines",
            resourceGroup: vmRG,
            location,
          });

          const disk = makeResource({
            id: diskId,
            name: diskName,
            type: "microsoft.compute/disks",
            resourceGroup: diskRG,
            location,
          });

          const result = extractRelationships([vm, disk]);

          const nameRels = result.relationships.filter(
            (r) =>
              r.method === "name_heuristic" &&
              r.sourceResourceId === vmId &&
              r.targetResourceId === diskId,
          );

          expect(nameRels.length).toBeGreaterThanOrEqual(1);
          expect(nameRels[0].confidence).toBe("Medium");
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 7 tests ───────────────────────────────────────────────────────

/**
 * **Validates: Requirements 4.6**
 *
 * Property 7: Relationship deduplication uses highest confidence
 *
 * For any pair of Azure resources that would be discovered by multiple
 * extraction methods (e.g., both property_ref and name_heuristic), the
 * relationship engine SHALL output exactly one relationship edge for that
 * pair, using the highest confidence level among the methods
 * (`Definite` > `High` > `Medium` > `Low`).
 */

describe("Property 7: Relationship deduplication uses highest confidence", () => {
  it("keeps Definite confidence when a VM→NIC pair is found by both property_ref and name_heuristic", () => {
    fc.assert(
      fc.property(
        arbSubscriptionId,
        arbResourceGroup,
        arbAlphanumeric,
        fc.integer({ min: 1, max: 999 }).map((n) => String(n)),
        (subscriptionId, resourceGroup, vmName, nicSuffix) => {
          const location = "eastus";
          const vmId = crypto.randomUUID();
          const nicId = crypto.randomUUID();

          // NIC name follows the name heuristic pattern: stripped VM name + numeric suffix
          const strippedVmName = vmName
            .replace(/[^a-z0-9]/gi, "")
            .toLowerCase();
          const nicName = `${strippedVmName}${nicSuffix}`;

          const vmArmId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Compute/virtualMachines/${vmName}`;
          const nicArmId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/networkInterfaces/${nicName}`;

          // VM has NIC ARM ID in properties → triggers property_ref (Definite)
          // NIC name matches VM name pattern in same RG → triggers name_heuristic (High)
          const vm = makeResource({
            id: vmId,
            name: vmName,
            type: "microsoft.compute/virtualmachines",
            armId: vmArmId,
            resourceGroup,
            location,
            raw: JSON.stringify({
              properties: {
                networkProfile: {
                  networkInterfaces: [{ id: nicArmId }],
                },
              },
            }),
          });

          const nic = makeResource({
            id: nicId,
            name: nicName,
            type: "microsoft.network/networkinterfaces",
            armId: nicArmId,
            resourceGroup,
            location,
          });

          const result = extractRelationships([vm, nic]);

          // Count edges for this specific (source, target) pair
          const edgesForPair = result.relationships.filter(
            (r) =>
              r.sourceResourceId === vmId && r.targetResourceId === nicId,
          );

          // Deduplication: exactly one edge for the pair
          expect(edgesForPair.length).toBe(1);

          // The surviving edge should have the highest confidence: Definite (from property_ref)
          expect(edgesForPair[0].confidence).toBe("Definite");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("produces exactly one edge per (source, target) pair after deduplication", () => {
    fc.assert(
      fc.property(
        arbSubscriptionId,
        arbResourceGroup,
        arbAlphanumeric,
        fc.integer({ min: 1, max: 999 }).map((n) => String(n)),
        (subscriptionId, resourceGroup, vmName, nicSuffix) => {
          const location = "eastus";
          const vmId = crypto.randomUUID();
          const nicId = crypto.randomUUID();

          const strippedVmName = vmName
            .replace(/[^a-z0-9]/gi, "")
            .toLowerCase();
          const nicName = `${strippedVmName}${nicSuffix}`;

          const vmArmId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Compute/virtualMachines/${vmName}`;
          const nicArmId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/networkInterfaces/${nicName}`;

          const vm = makeResource({
            id: vmId,
            name: vmName,
            type: "microsoft.compute/virtualmachines",
            armId: vmArmId,
            resourceGroup,
            location,
            raw: JSON.stringify({
              properties: {
                networkProfile: {
                  networkInterfaces: [{ id: nicArmId }],
                },
              },
            }),
          });

          const nic = makeResource({
            id: nicId,
            name: nicName,
            type: "microsoft.network/networkinterfaces",
            armId: nicArmId,
            resourceGroup,
            location,
          });

          const result = extractRelationships([vm, nic]);

          // Group edges by (source, target) pair
          const pairCounts = new Map<string, number>();
          for (const rel of result.relationships) {
            const key = `${rel.sourceResourceId}::${rel.targetResourceId}`;
            pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
          }

          // Every pair should appear exactly once
          for (const [, count] of pairCounts) {
            expect(count).toBe(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 8 tests ───────────────────────────────────────────────────────

/**
 * **Validates: Requirements 3.8, 8.6**
 *
 * Property 8: Determinism of relationship engine and AWS topology builder
 *
 * For any set of Azure resources, calling `extractRelationships` twice with
 * the same input SHALL produce identical output (same relationships in the
 * same order).
 */

/** Generate a small set of Azure resources with various types */
const arbResourceSet = fc
  .record({
    subscriptionId: arbSubscriptionId,
    resourceGroup: arbResourceGroup,
    vmName: arbAlphanumeric,
    nicSuffix: fc.integer({ min: 1, max: 999 }).map((n) => String(n)),
    diskSuffix: fc.integer({ min: 0, max: 99 }).map((n) => String(n)),
    location: fc.constantFrom("eastus", "westus", "northeurope"),
  })
  .map(({ subscriptionId, resourceGroup, vmName, nicSuffix, diskSuffix, location }) => {
    const strippedVmName = vmName.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const nicName = `${strippedVmName}${nicSuffix}`;
    const diskName = `${vmName}_OsDisk_${diskSuffix}`;
    const nsgName = `${vmName}-nsg`;
    const pipName = `${vmName}-ip`;

    const vmArmId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Compute/virtualMachines/${vmName}`;
    const nicArmId = `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.Network/networkInterfaces/${nicName}`;

    return [
      makeResource({
        id: crypto.randomUUID(),
        name: vmName,
        type: "microsoft.compute/virtualmachines",
        armId: vmArmId,
        resourceGroup,
        location,
        raw: JSON.stringify({
          properties: {
            networkProfile: {
              networkInterfaces: [{ id: nicArmId }],
            },
          },
        }),
      }),
      makeResource({
        id: crypto.randomUUID(),
        name: nicName,
        type: "microsoft.network/networkinterfaces",
        armId: nicArmId,
        resourceGroup,
        location,
      }),
      makeResource({
        id: crypto.randomUUID(),
        name: diskName,
        type: "microsoft.compute/disks",
        resourceGroup,
        location,
      }),
      makeResource({
        id: crypto.randomUUID(),
        name: nsgName,
        type: "microsoft.network/networksecuritygroups",
        resourceGroup,
        location,
      }),
      makeResource({
        id: crypto.randomUUID(),
        name: pipName,
        type: "microsoft.network/publicipaddresses",
        resourceGroup,
        location,
      }),
    ];
  });

describe("Property 8: Determinism of relationship engine", () => {
  it("calling extractRelationships twice with the same input produces identical output", () => {
    fc.assert(
      fc.property(arbResourceSet, (resources) => {
        const result1 = extractRelationships(resources);
        const result2 = extractRelationships(resources);

        // Same number of relationships
        expect(result1.relationships.length).toBe(result2.relationships.length);

        // Same relationships in the same order
        for (let i = 0; i < result1.relationships.length; i++) {
          expect(result1.relationships[i]).toEqual(result2.relationships[i]);
        }

        // Same stats
        expect(result1.stats).toEqual(result2.stats);
      }),
      { numRuns: 100 },
    );
  });

  it("shuffling the input array produces the same set of relationships", () => {
    fc.assert(
      fc.property(
        arbResourceSet.chain((resources) =>
          fc.shuffledSubarray(resources, { minLength: resources.length, maxLength: resources.length })
            .map((shuffled) => ({ original: resources, shuffled })),
        ),
        ({ original, shuffled }) => {
          const result1 = extractRelationships(original);
          const result2 = extractRelationships(shuffled);

          // Same number of relationships
          expect(result1.relationships.length).toBe(result2.relationships.length);

          // Same set of relationships (order may differ due to input order)
          const toKey = (r: { sourceResourceId: string; targetResourceId: string; relationType: string; confidence: string; method: string }) =>
            `${r.sourceResourceId}::${r.targetResourceId}::${r.relationType}::${r.confidence}::${r.method}`;

          const set1 = new Set(result1.relationships.map(toKey));
          const set2 = new Set(result2.relationships.map(toKey));

          expect(set1.size).toBe(set2.size);
          for (const key of set1) {
            expect(set2.has(key)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
