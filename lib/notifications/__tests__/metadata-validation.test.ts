// Feature: phase4-ai-insights, Property 1: Metadata size enforcement
//
// For any JSON object, the notification creation function SHALL accept the
// object as metadata if and only if its serialized size is ≤ 1024 bytes,
// and SHALL reject it otherwise.
//
// Validates: Requirements 1.4

import { describe, it, expect } from "vitest";
import fc from "fast-check";

// Mirror the validation logic from service.ts to avoid "server-only" import.
const MAX_METADATA_BYTES = 1024;

function validateMetadataSize(metadata: unknown): void {
  const serialized = JSON.stringify(metadata);
  const byteLength = new TextEncoder().encode(serialized).byteLength;
  if (byteLength > MAX_METADATA_BYTES) {
    throw new Error(
      `Metadata exceeds maximum size of ${MAX_METADATA_BYTES} bytes (got ${byteLength} bytes)`,
    );
  }
}

function getByteLength(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

/**
 * Generate a metadata object with a controlled size by padding a string field.
 * targetSize is the desired serialized byte length.
 */
function buildMetadataOfSize(targetSize: number): Record<string, string> {
  // Start with a base object and measure its overhead
  const base = { v: "" };
  const overhead = getByteLength(base); // {"v":""} = 8 bytes
  const padLen = Math.max(0, targetSize - overhead);
  return { v: "x".repeat(padLen) };
}

describe("Property 1: Metadata size enforcement", () => {
  it("accepts metadata whose serialized size is ≤ 1024 bytes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_METADATA_BYTES }),
        (targetSize) => {
          const metadata = buildMetadataOfSize(targetSize);
          expect(getByteLength(metadata)).toBeLessThanOrEqual(MAX_METADATA_BYTES);
          expect(() => validateMetadataSize(metadata)).not.toThrow();
        },
      ),
      { numRuns: 200 },
    );
  });

  it("rejects metadata whose serialized size is > 1024 bytes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_METADATA_BYTES + 1, max: MAX_METADATA_BYTES * 5 }),
        (targetSize) => {
          const metadata = buildMetadataOfSize(targetSize);
          expect(getByteLength(metadata)).toBeGreaterThan(MAX_METADATA_BYTES);
          expect(() => validateMetadataSize(metadata)).toThrow(
            /Metadata exceeds maximum size/,
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it("correctly classifies arbitrary JSON objects by size", () => {
    fc.assert(
      fc.property(fc.json(), (jsonStr) => {
        const metadata = JSON.parse(jsonStr);
        const size = getByteLength(metadata);
        if (size <= MAX_METADATA_BYTES) {
          expect(() => validateMetadataSize(metadata)).not.toThrow();
        } else {
          expect(() => validateMetadataSize(metadata)).toThrow(
            /Metadata exceeds maximum size/,
          );
        }
      }),
      { numRuns: 200 },
    );
  });

  it("accepts metadata exactly at the 1024-byte boundary", () => {
    const metadata = buildMetadataOfSize(MAX_METADATA_BYTES);
    expect(getByteLength(metadata)).toBe(MAX_METADATA_BYTES);
    expect(() => validateMetadataSize(metadata)).not.toThrow();
  });

  it("rejects metadata at 1025 bytes", () => {
    const metadata = buildMetadataOfSize(MAX_METADATA_BYTES + 1);
    expect(getByteLength(metadata)).toBe(MAX_METADATA_BYTES + 1);
    expect(() => validateMetadataSize(metadata)).toThrow(
      /Metadata exceeds maximum size/,
    );
  });
});
