import { describe, it, expect } from "vitest";
import { parseArmIdForImport, normalizeResource } from "@/lib/import-utils";

/**
 * Unit tests for the enhanced import normalizer.
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 2.2, 2.3, 2.4
 */

describe("parseArmIdForImport", () => {
  it("returns correct subscriptionId and resourceGroup for a valid ARM ID", () => {
    const result = parseArmIdForImport(
      "/subscriptions/sub-123/resourceGroups/my-rg/providers/Microsoft.Compute/virtualMachines/myVM",
    );
    expect(result).toEqual({
      subscriptionId: "sub-123",
      resourceGroup: "my-rg",
    });
  });

  it("returns correct values for ARM ID with child segments (extensions)", () => {
    const result = parseArmIdForImport(
      "/subscriptions/sub-456/resourceGroups/prod-rg/providers/Microsoft.Compute/virtualMachines/myVM/extensions/MDE.Windows",
    );
    expect(result).toEqual({
      subscriptionId: "sub-456",
      resourceGroup: "prod-rg",
    });
  });

  it("returns null for malformed ARM ID with too few segments", () => {
    expect(parseArmIdForImport("/subscriptions/sub-123/resourceGroups/rg")).toBeNull();
  });

  it("returns null for ARM ID missing 'subscriptions' keyword", () => {
    expect(
      parseArmIdForImport(
        "/notSubscriptions/sub-123/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm",
      ),
    ).toBeNull();
  });

  it("returns null for ARM ID missing 'resourceGroups' keyword", () => {
    expect(
      parseArmIdForImport(
        "/subscriptions/sub-123/notResourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm",
      ),
    ).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseArmIdForImport("")).toBeNull();
  });

  it("handles case-insensitive 'subscriptions' and 'resourceGroups' keywords", () => {
    const result = parseArmIdForImport(
      "/Subscriptions/sub-789/ResourceGroups/dev-rg/providers/Microsoft.Network/virtualNetworks/myVNet",
    );
    expect(result).toEqual({
      subscriptionId: "sub-789",
      resourceGroup: "dev-rg",
    });
  });
});

describe("normalizeResource — ARM ID enhancement", () => {
  it("sets armId and extracts subscriptionId and resourceGroup from valid ARM ID", () => {
    const armId =
      "/subscriptions/sub-aaa/resourceGroups/rg-one/providers/Microsoft.Compute/virtualMachines/vm1";
    const result = normalizeResource({
      id: armId,
      name: "vm1",
      type: "Microsoft.Compute/virtualMachines",
    });

    expect(result.armId).toBe(armId);
    expect(result.subscriptionId).toBe("sub-aaa");
    expect(result.resourceGroup).toBe("rg-one");
  });

  it("prefers explicit subscriptionId over ARM-extracted value", () => {
    const armId =
      "/subscriptions/arm-sub/resourceGroups/arm-rg/providers/Microsoft.Compute/virtualMachines/vm1";
    const result = normalizeResource({
      id: armId,
      name: "vm1",
      type: "Microsoft.Compute/virtualMachines",
      subscriptionId: "explicit-sub",
    });

    expect(result.subscriptionId).toBe("explicit-sub");
  });

  it("prefers explicit resourceGroup over ARM-extracted value", () => {
    const armId =
      "/subscriptions/sub-aaa/resourceGroups/arm-rg/providers/Microsoft.Compute/virtualMachines/vm1";
    const result = normalizeResource({
      id: armId,
      name: "vm1",
      type: "Microsoft.Compute/virtualMachines",
      resourceGroup: "explicit-rg",
    });

    expect(result.resourceGroup).toBe("explicit-rg");
  });

  it("includes properties object in serialized raw field", () => {
    const props = { vmId: "abc-123", hardwareProfile: { vmSize: "Standard_D2s_v3" } };
    const input = {
      id: "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Compute/virtualMachines/vm1",
      name: "vm1",
      type: "Microsoft.Compute/virtualMachines",
      properties: props,
    };
    const result = normalizeResource(input);
    const parsed = JSON.parse(result.raw);

    expect(parsed.properties).toEqual(props);
  });

  it("sets armId to null when id does not start with /subscriptions/", () => {
    const result = normalizeResource({
      id: "not-an-arm-id",
      name: "vm1",
      type: "Microsoft.Compute/virtualMachines",
    });

    expect(result.armId).toBeNull();
  });

  it("sets armId, subscriptionId, and resourceGroup to null for legacy format (no id field)", () => {
    const result = normalizeResource({
      name: "myVM",
      type: "Microsoft.Compute/virtualMachines",
    });

    expect(result.armId).toBeNull();
    expect(result.subscriptionId).toBeNull();
    expect(result.resourceGroup).toBeNull();
  });

  it("is backward compatible: legacy resource with no id, resourceGroup, or properties has all nullable fields null", () => {
    const result = normalizeResource({
      name: "myVM",
      type: "Microsoft.Compute/virtualMachines",
    });

    expect(result.name).toBe("myVM");
    expect(result.type).toBe("microsoft.compute/virtualmachines");
    expect(result.armId).toBeNull();
    expect(result.subscriptionId).toBeNull();
    expect(result.resourceGroup).toBeNull();
    expect(result.location).toBeNull();
    expect(result.kind).toBeNull();
    expect(result.sku).toBeNull();
    expect(result.tags).toBe("{}");
  });

  it("works correctly regardless of how the resource was unwrapped (Req 2.4)", () => {
    // normalizeResource operates on a single resource object;
    // wrapper format unwrapping is handled upstream by the Zod schema.
    // This test verifies normalizeResource handles a fully-populated resource correctly.
    const resource = {
      id: "/subscriptions/sub-1/resourceGroups/rg-1/providers/Microsoft.Network/networkInterfaces/nic1",
      name: "nic1",
      type: "Microsoft.Network/networkInterfaces",
      location: "eastus",
      kind: null,
      sku: { name: "Standard" },
      tags: { env: "prod" },
      properties: { ipConfigurations: [{ id: "ip-config-1" }] },
      resourceGroup: "rg-1",
    };

    const result = normalizeResource(resource);

    expect(result.name).toBe("nic1");
    expect(result.type).toBe("microsoft.network/networkinterfaces");
    expect(result.location).toBe("eastus");
    expect(result.sku).toBe("Standard");
    expect(result.armId).toBe(resource.id);
    expect(result.subscriptionId).toBe("sub-1");
    expect(result.resourceGroup).toBe("rg-1");
    expect(result.tags).toBe(JSON.stringify({ env: "prod" }));

    const raw = JSON.parse(result.raw);
    expect(raw.properties).toEqual(resource.properties);
  });
});
