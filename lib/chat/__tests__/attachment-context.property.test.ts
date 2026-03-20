import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";
import os from "os";
import path from "path";
import fs from "fs/promises";

// Mock server-only
vi.mock("server-only", () => ({}));

import { buildAttachmentContext } from "../attachment-context";
import type { FileRef } from "../types";

// Track temp files for cleanup
let createdFiles: string[] = [];

afterEach(async () => {
  for (const f of createdFiles) {
    await fs.unlink(f).catch(() => {});
  }
  createdFiles = [];
});

/**
 * Helper: write a temp file matching the FileRef id pattern.
 */
async function writeTempFile(id: string, content: string): Promise<void> {
  const filePath = path.join(os.tmpdir(), `${id}-test.txt`);
  await fs.writeFile(filePath, content);
  createdFiles.push(filePath);
}

/**
 * Feature: sizing-v2-chatbot, Property 13: Attachment content included in AI message context
 * Validates: Requirements 8.8, 8.9
 */
describe("Property 13: Attachment content included in AI message context", () => {
  it("JSON/CSV file content is included in context", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 500 }),
        fc.constantFrom("application/json", "text/csv"),
        async (fileId, content, mimeType) => {
          // Write temp file
          await writeTempFile(fileId, content);

          const attachment: FileRef = {
            id: fileId,
            name: mimeType === "application/json" ? "data.json" : "data.csv",
            type: mimeType,
            size: Buffer.byteLength(content),
          };

          const context = await buildAttachmentContext([attachment]);

          // Context must contain the file content
          expect(context).toContain(content);
          // Context must reference the file name
          expect(context).toContain(attachment.name);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("PDF extractedText is included in context", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 500 }),
        async (fileId, extractedText) => {
          const attachment: FileRef = {
            id: fileId,
            name: "document.pdf",
            type: "application/pdf",
            size: 1024,
            extractedText,
          };

          const context = await buildAttachmentContext([attachment]);

          // Context must contain the extracted text
          expect(context).toContain(extractedText);
          // Context must reference the file name
          expect(context).toContain("document.pdf");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("image attachments are described with metadata", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.constantFrom("image/jpeg", "image/png"),
        fc.integer({ min: 100, max: 10_000_000 }),
        async (fileId, mimeType, size) => {
          const name = mimeType === "image/jpeg" ? "photo.jpg" : "screenshot.png";
          const attachment: FileRef = {
            id: fileId,
            name,
            type: mimeType,
            size,
          };

          const context = await buildAttachmentContext([attachment]);

          expect(context).toContain(name);
          expect(context).toContain(mimeType);
          expect(context).toContain(String(size));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("multiple attachments are all included in context", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.uuid(),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        async (jsonId, pdfId, jsonContent, pdfText) => {
          await writeTempFile(jsonId, jsonContent);

          const attachments: FileRef[] = [
            {
              id: jsonId,
              name: "data.json",
              type: "application/json",
              size: Buffer.byteLength(jsonContent),
            },
            {
              id: pdfId,
              name: "report.pdf",
              type: "application/pdf",
              size: 2048,
              extractedText: pdfText,
            },
          ];

          const context = await buildAttachmentContext(attachments);

          expect(context).toContain(jsonContent);
          expect(context).toContain(pdfText);
          expect(context).toContain("data.json");
          expect(context).toContain("report.pdf");
        },
      ),
      { numRuns: 100 },
    );
  });
});
