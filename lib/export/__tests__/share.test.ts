import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { compressSpec, decompressSpec } from "../share";

describe("Share link encoding/decoding", () => {
  /**
   * Feature: cold-plane-mvp, Property 18: Share link round-trip
   * Validates: Requirements 8.5, 8.6
   *
   * For any valid spec text, compressing it with compressSpec and then
   * decompressing the result with decompressSpec SHALL produce a string
   * identical to the original spec text.
   */
  it("Property 18: Share link round-trip", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 5000 }), (specText) => {
        const compressed = compressSpec(specText);
        expect(compressed).not.toBeNull();

        const decompressed = decompressSpec(compressed!);
        expect(decompressed).toBe(specText);
      }),
      { numRuns: 100 }
    );
  });
});
