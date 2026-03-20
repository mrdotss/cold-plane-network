/**
 * @vitest-environment jsdom
 */
// Feature: sizing-v2-chatbot, Property 22: FileAttachment aria-label contains file metadata
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import React from "react";
import { render } from "@testing-library/react";
import { FileAttachment } from "../FileAttachment";
import type { FileRef } from "@/lib/chat/types";

const ALLOWED_TYPES = [
  "application/json",
  "text/csv",
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

const TYPE_LABELS: Record<string, string> = {
  "application/json": "JSON",
  "text/csv": "CSV",
  "application/pdf": "PDF",
  "image/jpeg": "JPEG",
  "image/png": "PNG",
};

/** Arbitrary for generating valid FileRef objects. */
const fileRefArb = fc
  .record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50, unit: "grapheme" }).map(
      (s) => s.replace(/\0/g, "").trim() || "file",
    ),
    type: fc.constantFrom(...ALLOWED_TYPES),
    size: fc.integer({ min: 1, max: 10 * 1024 * 1024 }),
  })
  .map(
    (r): FileRef => ({
      id: r.id,
      name: r.name,
      type: r.type,
      size: r.size,
    }),
  );

describe("Property 22: FileAttachment aria-label contains file metadata", () => {
  it("aria-label contains file name, type label, and formatted size", () => {
    fc.assert(
      fc.property(fileRefArb, (file) => {
        const { container } = render(<FileAttachment file={file} />);
        const el = container.querySelector("[aria-label]");
        expect(el).not.toBeNull();

        const label = el!.getAttribute("aria-label")!;
        // Must contain the file name
        expect(label).toContain(file.name);
        // Must contain the type label
        const typeLabel = TYPE_LABELS[file.type] ?? file.type;
        expect(label).toContain(typeLabel);
        // Must contain a size representation (the formatted string)
        // We check that the label has some numeric content representing size
        expect(label).toMatch(/\d/);
      }),
      { numRuns: 100 },
    );
  });
});
