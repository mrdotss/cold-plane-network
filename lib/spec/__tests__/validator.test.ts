import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { parseSpec } from "../parser";
import { validateSpec } from "../validator";
import { RESOURCE_TYPES } from "../schema";

/**
 * Arbitrary for a valid resource name: lowercase alphanumeric + hyphens, 1-20 chars.
 */
const arbResourceName = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,19}$/)
  .filter((s) => s.length > 0);

/**
 * Arbitrary for a valid resource type from the known set.
 */
const arbResourceType = fc.constantFrom(...RESOURCE_TYPES);

/**
 * Generate a well-formed YAML spec string with unique resource names and valid types.
 * This ensures the spec conforms to the schema so validation should produce zero errors.
 */
const arbValidSpec = fc
  .array(
    fc.record({
      name: arbResourceName,
      type: arbResourceType,
    }),
    { minLength: 1, maxLength: 10 }
  )
  .map((entries) => {
    // Deduplicate names to avoid duplicate-name errors
    const seen = new Set<string>();
    const unique = entries.filter((e) => {
      const key = e.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    if (unique.length === 0) return null;

    const lines = ["resources:"];
    for (const entry of unique) {
      lines.push(`  - name: ${entry.name}`);
      lines.push(`    type: ${entry.type}`);
      lines.push(`    properties: {}`);
    }
    return lines.join("\n");
  })
  .filter((s): s is string => s !== null);

/**
 * Feature: cold-plane-mvp, Property 10: Valid spec produces zero error diagnostics
 * Validates: Requirements 5.5
 *
 * For any well-formed spec that conforms to the spec schema,
 * running validateSpec SHALL produce a diagnostics list containing
 * zero entries with severity "error".
 */
describe("Property 10: Valid spec produces zero error diagnostics", () => {
  it("well-formed specs produce no error-level diagnostics", () => {
    fc.assert(
      fc.property(arbValidSpec, (specText) => {
        const parsed = parseSpec(specText);
        // Parser itself should produce no errors for valid YAML
        const parseErrors = parsed.errors.filter((d) => d.severity === "error");
        expect(parseErrors).toHaveLength(0);

        const diagnostics = validateSpec(parsed);
        const errors = diagnostics.filter((d) => d.severity === "error");
        expect(errors).toHaveLength(0);
      }),
      { numRuns: 100 }
    );
  });
});
