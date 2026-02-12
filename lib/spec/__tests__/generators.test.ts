import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { parseSpec } from "../parser";
import { generateArtifacts } from "../generators";
import { RESOURCE_TYPES } from "../schema";

const arbResourceName = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,14}$/)
  .filter((s) => s.length > 0);

const arbResourceType = fc.constantFrom(...RESOURCE_TYPES);

/**
 * Generate a valid YAML spec with at least one resource.
 */
const arbValidSpec = fc
  .array(
    fc.record({
      name: arbResourceName,
      type: arbResourceType,
    }),
    { minLength: 1, maxLength: 8 }
  )
  .map((entries) => {
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

const REQUIRED_FILES = ["manifest.json", "artifacts.json", "README.md"];

/**
 * Feature: cold-plane-mvp, Property 16: Artifact manifest minimum files
 * Validates: Requirements 7.2
 *
 * For any valid parsed spec with at least one resource, the Artifact Manifest
 * produced by the generator SHALL contain files with paths including at minimum
 * "manifest.json", "artifacts.json", and "README.md".
 */
describe("Property 16: Artifact manifest minimum files", () => {
  it("manifest always contains manifest.json, artifacts.json, and README.md", () => {
    fc.assert(
      fc.property(arbValidSpec, (specText) => {
        const parsed = parseSpec(specText);
        expect(parsed.errors.filter((d) => d.severity === "error")).toHaveLength(0);
        expect(parsed.resources.length).toBeGreaterThan(0);

        const manifest = generateArtifacts(parsed);
        const filePaths = manifest.files.map((f) => f.path);

        for (const required of REQUIRED_FILES) {
          expect(filePaths).toContain(required);
        }
      }),
      { numRuns: 100 }
    );
  });
});
