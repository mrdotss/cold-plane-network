import "server-only";

import os from "os";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import type { FileRef } from "./types";

/** Allowed MIME types validated via content inspection. */
const ALLOWED_TYPES = new Set([
  "application/json",
  "text/csv",
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

/** Maximum file size: 10 MB. */
const MAX_SIZE = 10 * 1024 * 1024;

/** Temp file TTL: 1 hour. */
const CLEANUP_TTL_MS = 60 * 60 * 1000;

/** Magic byte signatures for content-based MIME detection. */
const MAGIC_SIGNATURES: Array<{ bytes: number[]; type: string }> = [
  { bytes: [0x25, 0x50, 0x44, 0x46], type: "application/pdf" }, // %PDF
  { bytes: [0xff, 0xd8, 0xff], type: "image/jpeg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47], type: "image/png" }, // .PNG
];

/**
 * Detect MIME type from file content (magic bytes) with fallback to declared type.
 * For text-based formats (JSON, CSV), we validate the declared type since they
 * don't have reliable magic bytes.
 */
function detectMimeType(
  buffer: Buffer,
  declaredType: string,
): string | null {
  // Check binary magic signatures first
  for (const sig of MAGIC_SIGNATURES) {
    if (sig.bytes.every((b, i) => buffer[i] === b)) {
      return sig.type;
    }
  }

  // For text-based types, accept the declared type if it's in the allowlist
  // and the content looks like valid text (no null bytes in first 512 bytes)
  if (declaredType === "application/json" || declaredType === "text/csv") {
    const sample = buffer.subarray(0, Math.min(512, buffer.length));
    const hasNullBytes = sample.includes(0x00);
    if (!hasNullBytes) {
      return declaredType;
    }
  }

  return null;
}


/**
 * Handle a file upload: validate type/size, save to temp dir, extract PDF text.
 * Returns a FileRef on success, throws on validation failure.
 */
export async function handleUpload(file: File): Promise<FileRef> {
  // Validate size
  if (file.size > MAX_SIZE) {
    throw new FileValidationError("File exceeds 10 MB limit");
  }

  // Read file content into buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Validate MIME type via content inspection
  const detectedType = detectMimeType(buffer, file.type);
  if (!detectedType || !ALLOWED_TYPES.has(detectedType)) {
    throw new FileValidationError(
      `Unsupported file type: ${file.type || "unknown"}`,
    );
  }

  // Save to temp directory with UUID prefix
  const fileId = randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileName = `${fileId}-${safeName}`;
  const filePath = path.join(os.tmpdir(), fileName);

  await fs.writeFile(filePath, buffer);

  const ref: FileRef = {
    id: fileId,
    name: file.name,
    type: detectedType,
    size: file.size,
  };

  // Extract text from PDF
  if (detectedType === "application/pdf") {
    try {
      const text = await extractPdfText(buffer);
      ref.extractedText = text;
    } catch (err) {
      // Clean up the saved file on extraction failure
      await fs.unlink(filePath).catch(() => {});
      if (err instanceof PdfExtractionError) throw err;
      throw new PdfExtractionError(
        "Could not extract text from PDF. Try a different file.",
      );
    }
  }

  return ref;
}

/**
 * Extract text from a PDF buffer using pdf-parse with a 30-second timeout.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  const result = await Promise.race([
    parser.getText(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new PdfExtractionError("PDF extraction timed out")),
        30_000,
      ),
    ),
  ]);

  // Concatenate page texts
  const fullText = result.pages.map((p) => p.text).join("\n");

  // Clean up parser resources
  await parser.destroy().catch(() => {});

  if (!fullText || fullText.trim().length === 0) {
    throw new PdfExtractionError(
      "Could not extract text from PDF. The file may be scanned or encrypted.",
    );
  }

  return fullText;
}

/**
 * Remove temporary files older than the TTL (1 hour).
 * Scans os.tmpdir() for files matching our UUID prefix pattern.
 */
export async function cleanupExpiredFiles(): Promise<number> {
  const tmpDir = os.tmpdir();
  const now = Date.now();
  let cleaned = 0;

  // UUID pattern: 8-4-4-4-12 hex chars followed by a dash
  const uuidPrefix = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/;

  try {
    const entries = await fs.readdir(tmpDir);

    for (const entry of entries) {
      if (!uuidPrefix.test(entry)) continue;

      const filePath = path.join(tmpDir, entry);
      try {
        const stat = await fs.stat(filePath);
        if (now - stat.mtimeMs > CLEANUP_TTL_MS) {
          await fs.unlink(filePath);
          cleaned++;
        }
      } catch {
        // File may have been deleted concurrently — skip
      }
    }
  } catch {
    // tmpdir read failure — non-fatal
  }

  return cleaned;
}

/** Error thrown when file validation fails (type or size). */
export class FileValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileValidationError";
  }
}

/** Error thrown when PDF text extraction fails or times out. */
export class PdfExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfExtractionError";
  }
}

// Re-export constants for testing
export const ALLOWED_MIME_TYPES = ALLOWED_TYPES;
export const MAX_FILE_SIZE = MAX_SIZE;
export const CLEANUP_TTL = CLEANUP_TTL_MS;
