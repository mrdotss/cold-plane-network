import { describe, it, expect } from "vitest";
import {
  getAzureResourceCategory,
  AZURE_CATEGORIES,
} from "../azure-icons";

describe("getAzureResourceCategory", () => {
  it("maps Compute types to orange", () => {
    const cat = getAzureResourceCategory(
      "microsoft.compute/virtualmachines",
    );
    expect(cat.label).toBe("Compute");
    expect(cat.color).toBe("#f97316");
  });

  it("maps Networking types to blue", () => {
    const cat = getAzureResourceCategory(
      "microsoft.network/virtualnetworks",
    );
    expect(cat.label).toBe("Networking");
    expect(cat.color).toBe("#3b82f6");
  });

  it("maps Storage types to green", () => {
    const cat = getAzureResourceCategory(
      "microsoft.storage/storageaccounts",
    );
    expect(cat.label).toBe("Storage");
    expect(cat.color).toBe("#22c55e");
  });

  it("maps Security types to red", () => {
    const cat = getAzureResourceCategory(
      "microsoft.keyvault/vaults",
    );
    expect(cat.label).toBe("Security");
    expect(cat.color).toBe("#ef4444");
  });

  it("maps Container types to teal", () => {
    const cat = getAzureResourceCategory(
      "microsoft.containerservice/managedclusters",
    );
    expect(cat.label).toBe("Containers");
    expect(cat.color).toBe("#14b8a6");
  });

  it("maps Monitoring types to cyan", () => {
    const cat = getAzureResourceCategory(
      "microsoft.insights/components",
    );
    expect(cat.label).toBe("Monitoring");
    expect(cat.color).toBe("#06b6d4");
  });

  it("maps Identity types to purple", () => {
    const cat = getAzureResourceCategory(
      "microsoft.managedidentity/userassignedidentities",
    );
    expect(cat.label).toBe("Identity");
    expect(cat.color).toBe("#a855f7");
  });

  it("maps Database types to emerald", () => {
    const cat = getAzureResourceCategory(
      "microsoft.sql/servers",
    );
    expect(cat.label).toBe("Database");
    expect(cat.color).toBe("#10b981");
  });

  it("maps Compute/disks to Storage (not Compute)", () => {
    const cat = getAzureResourceCategory("microsoft.compute/disks");
    expect(cat.label).toBe("Storage");
    expect(cat.color).toBe("#22c55e");
  });

  it("maps Compute/snapshots to Storage", () => {
    const cat = getAzureResourceCategory("microsoft.compute/snapshots");
    expect(cat.label).toBe("Storage");
  });

  it("maps Compute/virtualMachines to Compute (specific prefix)", () => {
    const cat = getAzureResourceCategory("microsoft.compute/virtualmachines");
    expect(cat.label).toBe("Compute");
    expect(cat.color).toBe("#f97316");
  });

  it("maps generic Compute subtypes to Compute", () => {
    const cat = getAzureResourceCategory("microsoft.compute/sshpublickeys");
    expect(cat.label).toBe("Compute");
  });

  it("is case-insensitive", () => {
    const cat = getAzureResourceCategory(
      "Microsoft.Compute/VirtualMachines",
    );
    expect(cat.label).toBe("Compute");
  });

  it("returns default category for unknown types", () => {
    const cat = getAzureResourceCategory(
      "microsoft.unknown/something",
    );
    expect(cat.label).toBe("Other");
    expect(cat.color).toBe("#6b7280");
  });

  it("maps DevTestLab schedules to Monitoring", () => {
    const cat = getAzureResourceCategory(
      "microsoft.devtestlab/schedules",
    );
    expect(cat.label).toBe("Monitoring");
  });

  it("maps DocumentDB (CosmosDB) to Database", () => {
    const cat = getAzureResourceCategory(
      "microsoft.documentdb/databaseaccounts",
    );
    expect(cat.label).toBe("Database");
  });

  it("maps Redis Cache to Database", () => {
    const cat = getAzureResourceCategory(
      "microsoft.cache/redis",
    );
    expect(cat.label).toBe("Database");
  });

  it("maps Container Registry to Containers", () => {
    const cat = getAzureResourceCategory(
      "microsoft.containerregistry/registries",
    );
    expect(cat.label).toBe("Containers");
  });

  it("maps Recovery Services to Storage", () => {
    const cat = getAzureResourceCategory(
      "microsoft.recoveryservices/vaults",
    );
    expect(cat.label).toBe("Storage");
  });

  it("exports all 8 categories", () => {
    const keys = Object.keys(AZURE_CATEGORIES);
    expect(keys).toHaveLength(8);
    expect(keys).toEqual(
      expect.arrayContaining([
        "compute",
        "networking",
        "storage",
        "security",
        "containers",
        "monitoring",
        "identity",
        "database",
      ]),
    );
  });
});
