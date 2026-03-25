import { describe, it, expect } from "vitest";
import {
  extractRelationships,
  parseArmId,
} from "@/lib/migration/relationship-engine";
import type { AzureResourceInput } from "@/lib/migration/relationship-engine";

/**
 * Unit tests for the relationship engine.
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 4.1, 4.2, 4.3, 4.4, 4.6
 */

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

// ── parseArmId unit tests ──────────────────────────────────────────────────

describe("parseArmId", () => {
  it("parses a valid ARM ID with no child segments", () => {
    const result = parseArmId(
      "/subscriptions/sub-123/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/MyVM",
    );

    expect(result).not.toBeNull();
    expect(result!.subscriptionId).toBe("sub-123");
    expect(result!.resourceGroup).toBe("rg-prod");
    expect(result!.provider).toBe("Microsoft.Compute");
    expect(result!.resourceType).toBe("virtualMachines");
    expect(result!.resourceName).toBe("MyVM");
    expect(result!.childSegments).toEqual([]);
    expect(result!.fullType).toBe("microsoft.compute/virtualmachines");
  });

  it("parses an ARM ID with one child segment (VM extension)", () => {
    const result = parseArmId(
      "/subscriptions/sub-456/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/MyVM/extensions/MDE.Windows",
    );

    expect(result).not.toBeNull();
    expect(result!.subscriptionId).toBe("sub-456");
    expect(result!.resourceGroup).toBe("rg-prod");
    expect(result!.resourceName).toBe("MyVM");
    expect(result!.childSegments).toEqual([
      { type: "extensions", name: "MDE.Windows" },
    ]);
  });

  it("parses an ARM ID with multiple child segments (VNet/subnet)", () => {
    const result = parseArmId(
      "/subscriptions/sub-789/resourceGroups/rg-prod/providers/Microsoft.Network/virtualNetworks/MyVNet/subnets/default/ipConfigurations/ipconfig1",
    );

    expect(result).not.toBeNull();
    expect(result!.resourceName).toBe("MyVNet");
    expect(result!.childSegments).toEqual([
      { type: "subnets", name: "default" },
      { type: "ipConfigurations", name: "ipconfig1" },
    ]);
  });

  it("rejects malformed ARM IDs with too few segments", () => {
    expect(parseArmId("/subscriptions/sub-123/resourceGroups/rg")).toBeNull();
  });

  it("rejects ARM IDs missing 'subscriptions' keyword", () => {
    expect(
      parseArmId(
        "/notSubscriptions/sub-123/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm",
      ),
    ).toBeNull();
  });

  it("rejects ARM IDs missing 'resourceGroups' keyword", () => {
    expect(
      parseArmId(
        "/subscriptions/sub-123/notResourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm",
      ),
    ).toBeNull();
  });

  it("rejects ARM IDs missing 'providers' keyword", () => {
    expect(
      parseArmId(
        "/subscriptions/sub-123/resourceGroups/rg/notProviders/Microsoft.Compute/virtualMachines/vm",
      ),
    ).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseArmId("")).toBeNull();
  });

  it("handles IDs with special characters in resource names", () => {
    const result = parseArmId(
      "/subscriptions/sub-123/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/My-VM_01.test",
    );

    expect(result).not.toBeNull();
    expect(result!.resourceName).toBe("My-VM_01.test");
  });

  it("handles case-insensitive keywords", () => {
    const result = parseArmId(
      "/Subscriptions/sub-123/ResourceGroups/rg-prod/Providers/Microsoft.Compute/virtualMachines/MyVM",
    );

    expect(result).not.toBeNull();
    expect(result!.subscriptionId).toBe("sub-123");
    expect(result!.resourceGroup).toBe("rg-prod");
  });
});


// ── extractRelationships unit tests ────────────────────────────────────────

describe("extractRelationships", () => {
  // ── 1. ARM hierarchy ───────────────────────────────────────────────────

  describe("ARM hierarchy (contains, Definite, arm_hierarchy)", () => {
    it("creates a contains relationship from parent VM to child extension", () => {
      const vm = makeResource({
        id: "vm-001",
        name: "MyVM",
        type: "microsoft.compute/virtualmachines",
        armId:
          "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/MyVM",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const ext = makeResource({
        id: "ext-001",
        name: "MDE.Windows",
        type: "microsoft.compute/virtualmachines/extensions",
        armId:
          "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/MyVM/extensions/MDE.Windows",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const result = extractRelationships([vm, ext]);

      const armEdge = result.relationships.find(
        (r) => r.method === "arm_hierarchy",
      );
      expect(armEdge).toBeDefined();
      expect(armEdge!.sourceResourceId).toBe("vm-001");
      expect(armEdge!.targetResourceId).toBe("ext-001");
      expect(armEdge!.relationType).toBe("contains");
      expect(armEdge!.confidence).toBe("Definite");
    });
  });

  // ── 2. Property reference ──────────────────────────────────────────────

  describe("Property reference (network, Definite, property_ref)", () => {
    it("creates a network relationship when VM properties contain NIC ARM ID", () => {
      const nicArmId =
        "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Network/networkInterfaces/myvm123";

      const vm = makeResource({
        id: "vm-001",
        name: "MyVM",
        type: "microsoft.compute/virtualmachines",
        armId:
          "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/MyVM",
        resourceGroup: "rg-prod",
        location: "eastus",
        raw: JSON.stringify({
          properties: {
            networkProfile: {
              networkInterfaces: [{ id: nicArmId }],
            },
          },
        }),
      });

      const nic = makeResource({
        id: "nic-001",
        name: "myvm123",
        type: "microsoft.network/networkinterfaces",
        armId: nicArmId,
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const result = extractRelationships([vm, nic]);

      const propEdge = result.relationships.find(
        (r) => r.method === "property_ref",
      );
      expect(propEdge).toBeDefined();
      expect(propEdge!.sourceResourceId).toBe("vm-001");
      expect(propEdge!.targetResourceId).toBe("nic-001");
      expect(propEdge!.relationType).toBe("network");
      expect(propEdge!.confidence).toBe("Definite");
    });
  });

  // ── 3. Name heuristic: VM → Disk ──────────────────────────────────────

  describe("Name heuristic: VM → Disk", () => {
    it("creates a storage relationship when disk is named MyVM_OsDisk_0", () => {
      const vm = makeResource({
        id: "vm-001",
        name: "MyVM",
        type: "microsoft.compute/virtualmachines",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const disk = makeResource({
        id: "disk-001",
        name: "MyVM_OsDisk_0",
        type: "microsoft.compute/disks",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const result = extractRelationships([vm, disk]);

      const nameEdge = result.relationships.find(
        (r) =>
          r.method === "name_heuristic" &&
          r.sourceResourceId === "vm-001" &&
          r.targetResourceId === "disk-001",
      );
      expect(nameEdge).toBeDefined();
      expect(nameEdge!.relationType).toBe("storage");
      expect(nameEdge!.confidence).toBe("High");
    });
  });

  // ── 4. Name heuristic: VM → NIC ──────────────────────────────────────

  describe("Name heuristic: VM → NIC", () => {
    it("creates a network relationship when NIC is named myvm123 (stripped lowercase + numeric) in same RG", () => {
      const vm = makeResource({
        id: "vm-001",
        name: "MyVM",
        type: "microsoft.compute/virtualmachines",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const nic = makeResource({
        id: "nic-001",
        name: "myvm123",
        type: "microsoft.network/networkinterfaces",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const result = extractRelationships([vm, nic]);

      const nameEdge = result.relationships.find(
        (r) =>
          r.method === "name_heuristic" &&
          r.sourceResourceId === "vm-001" &&
          r.targetResourceId === "nic-001",
      );
      expect(nameEdge).toBeDefined();
      expect(nameEdge!.relationType).toBe("network");
      expect(nameEdge!.confidence).toBe("High");
    });
  });

  // ── 5. Name heuristic: VM → Public IP ─────────────────────────────────

  describe("Name heuristic: VM → Public IP", () => {
    it("creates a network relationship when PIP is named MyVM-ip in same RG", () => {
      const vm = makeResource({
        id: "vm-001",
        name: "MyVM",
        type: "microsoft.compute/virtualmachines",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const pip = makeResource({
        id: "pip-001",
        name: "MyVM-ip",
        type: "microsoft.network/publicipaddresses",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const result = extractRelationships([vm, pip]);

      const nameEdge = result.relationships.find(
        (r) =>
          r.method === "name_heuristic" &&
          r.sourceResourceId === "vm-001" &&
          r.targetResourceId === "pip-001",
      );
      expect(nameEdge).toBeDefined();
      expect(nameEdge!.relationType).toBe("network");
      expect(nameEdge!.confidence).toBe("High");
    });
  });

  // ── 6. Name heuristic: VM → NSG ──────────────────────────────────────

  describe("Name heuristic: VM → NSG", () => {
    it("creates a security relationship when NSG is named MyVM-nsg in same RG", () => {
      const vm = makeResource({
        id: "vm-001",
        name: "MyVM",
        type: "microsoft.compute/virtualmachines",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const nsg = makeResource({
        id: "nsg-001",
        name: "MyVM-nsg",
        type: "microsoft.network/networksecuritygroups",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const result = extractRelationships([vm, nsg]);

      const nameEdge = result.relationships.find(
        (r) =>
          r.method === "name_heuristic" &&
          r.sourceResourceId === "vm-001" &&
          r.targetResourceId === "nsg-001",
      );
      expect(nameEdge).toBeDefined();
      expect(nameEdge!.relationType).toBe("security");
      expect(nameEdge!.confidence).toBe("High");
    });
  });

  // ── 7. Name heuristic: VM → Schedule ──────────────────────────────────

  describe("Name heuristic: VM → Schedule", () => {
    it("creates a monitoring relationship when schedule is named shutdown-computevm-MyVM in same RG", () => {
      const vm = makeResource({
        id: "vm-001",
        name: "MyVM",
        type: "microsoft.compute/virtualmachines",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const sched = makeResource({
        id: "sched-001",
        name: "shutdown-computevm-MyVM",
        type: "microsoft.devtestlab/schedules",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const result = extractRelationships([vm, sched]);

      const nameEdge = result.relationships.find(
        (r) =>
          r.method === "name_heuristic" &&
          r.sourceResourceId === "vm-001" &&
          r.targetResourceId === "sched-001",
      );
      expect(nameEdge).toBeDefined();
      expect(nameEdge!.relationType).toBe("monitoring");
      expect(nameEdge!.confidence).toBe("High");
    });
  });

  // ── 8. Name heuristic: NIC → NSG ─────────────────────────────────────

  describe("Name heuristic: NIC → NSG", () => {
    it("creates a security relationship when NIC myvm123 and NSG myvm-nsg share prefix myvm in same RG", () => {
      const nic = makeResource({
        id: "nic-001",
        name: "myvm123",
        type: "microsoft.network/networkinterfaces",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const nsg = makeResource({
        id: "nsg-001",
        name: "myvm-nsg",
        type: "microsoft.network/networksecuritygroups",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const result = extractRelationships([nic, nsg]);

      const nameEdge = result.relationships.find(
        (r) =>
          r.method === "name_heuristic" &&
          r.sourceResourceId === "nic-001" &&
          r.targetResourceId === "nsg-001",
      );
      expect(nameEdge).toBeDefined();
      expect(nameEdge!.relationType).toBe("security");
      expect(nameEdge!.confidence).toBe("High");
    });
  });

  // ── 9. Name heuristic: VPN Gateway → Public IP ────────────────────────

  describe("Name heuristic: VPN Gateway → Public IP", () => {
    it("creates a network relationship when PIP is named MyVPNGW-ip in same RG", () => {
      const gw = makeResource({
        id: "vpngw-001",
        name: "MyVPNGW",
        type: "microsoft.network/virtualnetworkgateways",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const pip = makeResource({
        id: "pip-001",
        name: "MyVPNGW-ip",
        type: "microsoft.network/publicipaddresses",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const result = extractRelationships([gw, pip]);

      const nameEdge = result.relationships.find(
        (r) =>
          r.method === "name_heuristic" &&
          r.sourceResourceId === "vpngw-001" &&
          r.targetResourceId === "pip-001",
      );
      expect(nameEdge).toBeDefined();
      expect(nameEdge!.relationType).toBe("network");
      expect(nameEdge!.confidence).toBe("High");
    });
  });

  // ── 10. Name heuristic: Connection → VPN Gateway / Local Network Gateway

  describe("Name heuristic: Connection → VPN Gateway / Local Network Gateway", () => {
    it("creates a gateway relationship from Connection to VPN Gateway in same RG", () => {
      const conn = makeResource({
        id: "conn-001",
        name: "MyConnection",
        type: "microsoft.network/connections",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const vpnGw = makeResource({
        id: "vpngw-001",
        name: "MyVPNGW",
        type: "microsoft.network/virtualnetworkgateways",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const result = extractRelationships([conn, vpnGw]);

      const nameEdge = result.relationships.find(
        (r) =>
          r.method === "name_heuristic" &&
          r.sourceResourceId === "conn-001" &&
          r.targetResourceId === "vpngw-001",
      );
      expect(nameEdge).toBeDefined();
      expect(nameEdge!.relationType).toBe("gateway");
    });

    it("creates a gateway relationship from Connection to Local Network Gateway in same RG", () => {
      const conn = makeResource({
        id: "conn-001",
        name: "MyConnection",
        type: "microsoft.network/connections",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const localGw = makeResource({
        id: "localgw-001",
        name: "MyLocalGW",
        type: "microsoft.network/localnetworkgateways",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const result = extractRelationships([conn, localGw]);

      const nameEdge = result.relationships.find(
        (r) =>
          r.method === "name_heuristic" &&
          r.sourceResourceId === "conn-001" &&
          r.targetResourceId === "localgw-001",
      );
      expect(nameEdge).toBeDefined();
      expect(nameEdge!.relationType).toBe("gateway");
    });
  });


  // ── 11. Deduplication ─────────────────────────────────────────────────

  describe("Deduplication", () => {
    it("keeps Definite confidence when same edge found by property_ref and name_heuristic", () => {
      const nicArmId =
        "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Network/networkInterfaces/myvm123";

      const vm = makeResource({
        id: "vm-001",
        name: "MyVM",
        type: "microsoft.compute/virtualmachines",
        armId:
          "/subscriptions/sub-1/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/MyVM",
        resourceGroup: "rg-prod",
        location: "eastus",
        raw: JSON.stringify({
          properties: {
            networkProfile: {
              networkInterfaces: [{ id: nicArmId }],
            },
          },
        }),
      });

      // NIC name "myvm123" matches VM name heuristic (stripped "myvm" + "123")
      const nic = makeResource({
        id: "nic-001",
        name: "myvm123",
        type: "microsoft.network/networkinterfaces",
        armId: nicArmId,
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const result = extractRelationships([vm, nic]);

      // Should have exactly 1 edge for this pair after deduplication
      const edgesForPair = result.relationships.filter(
        (r) =>
          r.sourceResourceId === "vm-001" &&
          r.targetResourceId === "nic-001",
      );
      expect(edgesForPair).toHaveLength(1);
      expect(edgesForPair[0].confidence).toBe("Definite");
    });
  });

  // ── 12. Empty input ───────────────────────────────────────────────────

  describe("Empty input", () => {
    it("returns empty output with all stats zero", () => {
      const result = extractRelationships([]);

      expect(result.relationships).toHaveLength(0);
      expect(result.stats.total).toBe(0);
      expect(result.stats.byType).toEqual({});
      expect(result.stats.byMethod).toEqual({});
      expect(result.stats.byConfidence).toEqual({});
    });
  });

  // ── 13. Resources with no ARM IDs ─────────────────────────────────────

  describe("Resources with no ARM IDs", () => {
    it("only heuristic methods run — no arm_hierarchy or property_ref edges", () => {
      const vm = makeResource({
        id: "vm-001",
        name: "MyVM",
        type: "microsoft.compute/virtualmachines",
        resourceGroup: "rg-prod",
        location: "eastus",
        // No armId, no properties with ARM refs
      });

      const disk = makeResource({
        id: "disk-001",
        name: "MyVM_OsDisk_0",
        type: "microsoft.compute/disks",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const nsg = makeResource({
        id: "nsg-001",
        name: "MyVM-nsg",
        type: "microsoft.network/networksecuritygroups",
        resourceGroup: "rg-prod",
        location: "eastus",
      });

      const result = extractRelationships([vm, disk, nsg]);

      // No arm_hierarchy or property_ref edges
      const armEdges = result.relationships.filter(
        (r) => r.method === "arm_hierarchy",
      );
      const propEdges = result.relationships.filter(
        (r) => r.method === "property_ref",
      );
      expect(armEdges).toHaveLength(0);
      expect(propEdges).toHaveLength(0);

      // Name heuristic edges should still be found
      const nameEdges = result.relationships.filter(
        (r) => r.method === "name_heuristic",
      );
      expect(nameEdges.length).toBeGreaterThanOrEqual(2);

      // VM → Disk (storage)
      const vmDisk = nameEdges.find(
        (r) =>
          r.sourceResourceId === "vm-001" &&
          r.targetResourceId === "disk-001",
      );
      expect(vmDisk).toBeDefined();
      expect(vmDisk!.relationType).toBe("storage");

      // VM → NSG (security)
      const vmNsg = nameEdges.find(
        (r) =>
          r.sourceResourceId === "vm-001" &&
          r.targetResourceId === "nsg-001",
      );
      expect(vmNsg).toBeDefined();
      expect(vmNsg!.relationType).toBe("security");
    });
  });
});
