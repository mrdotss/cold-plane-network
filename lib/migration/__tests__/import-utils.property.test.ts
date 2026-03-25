import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { normalizeResource } from "@/lib/import-utils";

/**
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 *
 * Property 1: ARM ID normalization round-trip
 *
 * For any Azure resource with a valid ARM ID string, normalizeResource SHALL:
 * - Persist the full ARM ID as armId
 * - Extract the correct subscriptionId from segment index 2
 * - Extract the correct resourceGroup from segment index 4 (when no explicit resourceGroup)
 * - Prefer the explicit resourceGroup field over the ARM-extracted value when both present
 * - Include the properties object in the serialized raw field
 */

const arbAlphanumeric = fc.string({ minLength: 1, maxLength: 20 }).map(
  (s) => s.replace(/[^a-z0-9]/g, "a"),
).filter((s) => s.length >= 1);

const arbSubscriptionId = fc.uuid();

const arbProvider = fc.constantFrom(
  "Microsoft.Compute",
  "Microsoft.Network",
  "Microsoft.Storage",
  "Microsoft.Sql",
  "Microsoft.Web",
);

const arbResourceType = fc.constantFrom(
  "virtualMachines",
  "networkInterfaces",
  "storageAccounts",
  "publicIPAddresses",
  "virtualNetworks",
);

const arbResourceName = arbAlphanumeric;

/** Generates a valid ARM ID string and its expected parsed segments. */
const arbArmId = fc.record({
  subscriptionId: arbSubscriptionId,
  resourceGroup: arbAlphanumeric,
  provider: arbProvider,
  resourceType: arbResourceType,
  resourceName: arbResourceName,
}).map(({ subscriptionId, resourceGroup, provider, resourceType, resourceName }) => ({
  armId: `/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/${provider}/${resourceType}/${resourceName}`,
  subscriptionId,
  resourceGroup,
}));

describe("Property 1: ARM ID normalization round-trip", () => {
  it("persists the full ARM ID as armId for any valid ARM ID", () => {
    fc.assert(
      fc.property(
        arbArmId,
        arbAlphanumeric,
        ({ armId }, name) => {
          const result = normalizeResource({
            id: armId,
            name,
            type: "microsoft.compute/virtualmachines",
          });
          expect(result.armId).toBe(armId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("extracts subscriptionId from segment index 2 of the ARM ID", () => {
    fc.assert(
      fc.property(
        arbArmId,
        arbAlphanumeric,
        ({ armId, subscriptionId }, name) => {
          const result = normalizeResource({
            id: armId,
            name,
            type: "microsoft.compute/virtualmachines",
          });
          expect(result.subscriptionId).toBe(subscriptionId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("extracts resourceGroup from segment index 4 when no explicit resourceGroup is provided", () => {
    fc.assert(
      fc.property(
        arbArmId,
        arbAlphanumeric,
        ({ armId, resourceGroup }, name) => {
          const result = normalizeResource({
            id: armId,
            name,
            type: "microsoft.compute/virtualmachines",
          });
          expect(result.resourceGroup).toBe(resourceGroup);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("prefers explicit resourceGroup over ARM-extracted value when both are present", () => {
    fc.assert(
      fc.property(
        arbArmId,
        arbAlphanumeric,
        arbAlphanumeric,
        ({ armId }, name, explicitRG) => {
          const result = normalizeResource({
            id: armId,
            name,
            type: "microsoft.compute/virtualmachines",
            resourceGroup: explicitRG,
          });
          expect(result.resourceGroup).toBe(explicitRG);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("includes the properties object in the serialized raw field", () => {
    fc.assert(
      fc.property(
        arbArmId,
        arbAlphanumeric,
        fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ maxLength: 50 })),
        ({ armId }, name, properties) => {
          const input = {
            id: armId,
            name,
            type: "microsoft.compute/virtualmachines",
            properties,
          };
          const result = normalizeResource(input);
          const parsed = JSON.parse(result.raw);
          expect(parsed.properties).toEqual(properties);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * **Validates: Requirements 2.1, 2.2, 2.3**
 *
 * Property 2: Backward-compatible normalization
 *
 * For any Azure resource object that lacks `id`, `resourceGroup`, and `properties`
 * fields (legacy v1 format with only `name` and `type`), the enhanced
 * `normalizeResource` function SHALL produce a valid `NormalizedResource` with
 * `armId: null`, `resourceGroup: null`, and the `raw` field containing the
 * original payload — matching the v1 normalization behavior exactly.
 */

const arbLegacyResourceName = fc.string({ minLength: 1, maxLength: 50 }).filter(
  (s) => s.trim().length > 0,
);

const arbLegacyResourceType = fc.constantFrom(
  "microsoft.compute/virtualmachines",
  "microsoft.network/networkinterfaces",
  "microsoft.storage/storageaccounts",
  "microsoft.network/publicipaddresses",
  "microsoft.network/virtualnetworks",
  "microsoft.sql/servers",
  "microsoft.web/sites",
  "microsoft.compute/disks",
);

/** Generates a legacy v1 resource with only `name` and `type` (no id, no resourceGroup, no properties). */
const arbLegacyResource = fc.record({
  name: arbLegacyResourceName,
  type: arbLegacyResourceType,
});

describe("Property 2: Backward-compatible normalization", () => {
  it("produces armId: null for any resource with only name and type", () => {
    fc.assert(
      fc.property(arbLegacyResource, (resource) => {
        const result = normalizeResource(resource);
        expect(result.armId).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("produces resourceGroup: null for any resource with only name and type", () => {
    fc.assert(
      fc.property(arbLegacyResource, (resource) => {
        const result = normalizeResource(resource);
        expect(result.resourceGroup).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("produces subscriptionId: null for any resource with only name and type", () => {
    fc.assert(
      fc.property(arbLegacyResource, (resource) => {
        const result = normalizeResource(resource);
        expect(result.subscriptionId).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("includes the original payload as JSON in the raw field", () => {
    fc.assert(
      fc.property(arbLegacyResource, (resource) => {
        const result = normalizeResource(resource);
        const parsed = JSON.parse(result.raw);
        expect(parsed.name).toBe(resource.name);
        expect(parsed.type).toBe(resource.type);
      }),
      { numRuns: 100 },
    );
  });

  it("produces a result with all required NormalizedResource fields", () => {
    fc.assert(
      fc.property(arbLegacyResource, (resource) => {
        const result = normalizeResource(resource);
        expect(result).toHaveProperty("name");
        expect(result).toHaveProperty("type");
        expect(result).toHaveProperty("location");
        expect(result).toHaveProperty("kind");
        expect(result).toHaveProperty("sku");
        expect(result).toHaveProperty("subscriptionId");
        expect(result).toHaveProperty("resourceGroup");
        expect(result).toHaveProperty("armId");
        expect(result).toHaveProperty("tags");
        expect(result).toHaveProperty("raw");
        // Verify types
        expect(typeof result.name).toBe("string");
        expect(typeof result.type).toBe("string");
        expect(typeof result.tags).toBe("string");
        expect(typeof result.raw).toBe("string");
      }),
      { numRuns: 100 },
    );
  });
});
