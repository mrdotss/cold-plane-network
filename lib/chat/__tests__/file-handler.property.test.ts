import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fc from "fast-check";
import os from "os";
import path from "path";
import fs from "fs/promises";

// Mock server-only
vi.mock("server-only", () => ({}));

// Mock pdf-parse to avoid needing real PDF files
vi.mock("pdf-parse", () => ({
  PDFParse: class MockPDFParse {
    private data: Uint8Array;
    constructor(opts: { data: Uint8Array }) {
      this.data = opts.data;
    }
    async getText() {
      return { pages: [{ text: "Extracted PDF text content" }] };
    }
    async destroy() {}
  },
}));

import {
  handleUpload,
  cleanupExpiredFiles,
  FileValidationError,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
} from "../file-handler";

// Track temp files created during tests for cleanup
let createdFiles: string[] = [];

beforeEach(() => {
  createdFiles = [];
});

afterEach(async () => {
  // Clean up any temp files created during tests
  for (const f of createdFiles) {
    await fs.unlink(f).catch(() => {});
  }
});

/**
 * Helper: create a File object with given content and type.
 */
function createTestFile(
  content: Buffer | string,
  name: string,
  type: string,
): File {
  const buf = typeof content === "string" ? Buffer.from(content) : content;
  return new File([new Uint8Array(buf)], name, { type });
}

/**
 * Feature: sizing-v2-chatbot, Property 11: File upload validation rejects invalid type or size
 * Validates: Requirements 8.1, 8.2
 */
describe("Property 11: File upload validation rejects invalid type or size", () => {
  it("rejects files with invalid MIME types", async () => {
    const invalidTypes = [
      "application/xml",
      "text/html",
      "application/zip",
      "video/mp4",
      "audio/mpeg",
      "application/octet-stream",
    ];

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...invalidTypes),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (mimeType, content) => {
          const file = createTestFile(content, "test.bin", mimeType);
          await expect(handleUpload(file)).rejects.toThrow(
            FileValidationError,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rejects files exceeding 10 MB", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...[...ALLOWED_MIME_TYPES]),
        async (mimeType) => {
          // Create a file just over the limit
          const oversizedContent = Buffer.alloc(MAX_FILE_SIZE + 1, "a");
          const file = createTestFile(
            oversizedContent,
            "large.json",
            mimeType,
          );
          await expect(handleUpload(file)).rejects.toThrow(
            "File exceeds 10 MB limit",
          );
        },
      ),
      { numRuns: 5 }, // Fewer runs since we're allocating large buffers
    );
  });
});

/**
 * Feature: sizing-v2-chatbot, Property 12: File upload round-trip
 * Validates: Requirements 8.4
 */
describe("Property 12: File upload round-trip", () => {
  it("returns FileRef with matching name, type, and size for valid files", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }),
        async (content) => {
          const file = createTestFile(content, "data.json", "application/json");
          const ref = await handleUpload(file);

          expect(ref.name).toBe("data.json");
          expect(ref.type).toBe("application/json");
          expect(ref.size).toBe(file.size);
          expect(ref.id).toBeTruthy();

          // Verify file exists on disk
          const tmpDir = os.tmpdir();
          const files = await fs.readdir(tmpDir);
          const match = files.find((f) => f.startsWith(ref.id));
          expect(match).toBeTruthy();

          // Track for cleanup
          if (match) {
            createdFiles.push(path.join(tmpDir, match));
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns extractedText for PDF files", async () => {
    // PDF magic bytes: %PDF
    const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46]);
    const pdfContent = Buffer.concat([pdfHeader, Buffer.from("-1.4 fake pdf content")]);
    const file = createTestFile(pdfContent, "doc.pdf", "application/pdf");

    const ref = await handleUpload(file);
    expect(ref.type).toBe("application/pdf");
    expect(ref.extractedText).toBeTruthy();
    expect(ref.extractedText!.length).toBeGreaterThan(0);

    // Track for cleanup
    const tmpDir = os.tmpdir();
    const files = await fs.readdir(tmpDir);
    const match = files.find((f) => f.startsWith(ref.id));
    if (match) createdFiles.push(path.join(tmpDir, match));
  });

  it("handles CSV files correctly", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), {
          minLength: 1,
          maxLength: 5,
        }),
        async (values) => {
          const csvContent = values.join(",");
          const file = createTestFile(csvContent, "data.csv", "text/csv");
          const ref = await handleUpload(file);

          expect(ref.name).toBe("data.csv");
          expect(ref.type).toBe("text/csv");

          const tmpDir = os.tmpdir();
          const files = await fs.readdir(tmpDir);
          const match = files.find((f) => f.startsWith(ref.id));
          if (match) createdFiles.push(path.join(tmpDir, match));
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Feature: sizing-v2-chatbot, Property 14: Temp file cleanup after TTL
 * Validates: Requirements 8.11, 13.2
 */
describe("Property 14: Temp file cleanup after TTL", () => {
  it("removes files older than 1 hour, keeps recent files", async () => {
    const tmpDir = os.tmpdir();

    await fc.assert(
      fc.asyncProperty(
        fc.uuid(),
        fc.boolean(),
        async (fileId, isExpired) => {
          const fileName = `${fileId}-test-cleanup.txt`;
          const filePath = path.join(tmpDir, fileName);

          // Create the file
          await fs.writeFile(filePath, "test content");
          createdFiles.push(filePath);

          if (isExpired) {
            // Set mtime to 2 hours ago
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            await fs.utimes(filePath, twoHoursAgo, twoHoursAgo);
          }

          await cleanupExpiredFiles();

          const exists = await fs
            .access(filePath)
            .then(() => true)
            .catch(() => false);

          if (isExpired) {
            expect(exists).toBe(false);
            // Remove from cleanup list since already deleted
            createdFiles = createdFiles.filter((f) => f !== filePath);
          } else {
            expect(exists).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
