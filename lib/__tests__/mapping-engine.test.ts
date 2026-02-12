import { describe, it, expect } from "vitest";
import { findMapping, getCatalogCategories, getCatalogStats } from "@/lib/mapping-engine";

describe("findMapping", () => {
  it("returns High confidence for exact type match (VMs)", () => {
    const result = findMapping("microsoft.compute/virtualmachines");
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("High");
    expect(result.awsServices[0].service).toBe("Amazon EC2");
    expect(result.category).toBe("Compute");
  });

  it("returns kind-specific match over generic (functionapp)", () => {
    const result = findMapping("microsoft.web/sites", "functionapp");
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("High");
    expect(result.awsServices[0].service).toBe("AWS Lambda");
    expect(result.category).toBe("Serverless");
  });

  it("returns generic match when no kind provided for web/sites", () => {
    const result = findMapping("microsoft.web/sites");
    expect(result.matched).toBe(true);
    expect(result.awsServices[0].service).toBe("AWS App Runner");
    expect(result.category).toBe("Compute");
  });

  it("handles case-insensitive type lookup", () => {
    const result = findMapping("Microsoft.Compute/VirtualMachines");
    expect(result.matched).toBe(true);
    expect(result.awsServices[0].service).toBe("Amazon EC2");
  });

  it("returns matched:false for unknown type", () => {
    const result = findMapping("microsoft.unknown/nonexistent");
    expect(result.matched).toBe(false);
    expect(result.confidence).toBe("None");
    expect(result.awsServices).toEqual([]);
    expect(result.category).toBe("Unknown");
  });

  it("falls back to generic entry with non-matching kind", () => {
    const result = findMapping("microsoft.storage/storageaccounts", "unknownkind");
    expect(result.matched).toBe(true);
    // Should get the generic storage entry (Medium confidence)
    expect(result.confidence).toBe("Medium");
  });

  it("returns blobstorage-specific entry for matching kind", () => {
    const result = findMapping("microsoft.storage/storageaccounts", "blobstorage");
    expect(result.matched).toBe(true);
    expect(result.confidence).toBe("High");
  });
});

describe("getCatalogCategories", () => {
  it("returns an array of unique category strings", () => {
    const categories = getCatalogCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories).toContain("Compute");
    expect(categories).toContain("Storage");
    expect(categories).toContain("Networking");
    // No duplicates
    expect(new Set(categories).size).toBe(categories.length);
  });
});

describe("getCatalogStats", () => {
  it("returns version, totalMappings, categories, and uniqueAzureTypes", () => {
    const stats = getCatalogStats();
    expect(stats.version).toBe("1.0.0");
    expect(stats.totalMappings).toBeGreaterThan(0);
    expect(stats.categories.length).toBeGreaterThan(0);
    expect(stats.uniqueAzureTypes).toBeGreaterThan(0);
    expect(stats.uniqueAzureTypes).toBeLessThanOrEqual(stats.totalMappings);
  });
});
