import "server-only";

import fs from "fs/promises";
import os from "os";
import path from "path";
import type { FileRef } from "./types";

/**
 * Build attachment context string for the AI message.
 * JSON/CSV: read file content as text from temp dir.
 * PDF: use previously extracted text from FileRef.
 * Images: describe metadata.
 */
export async function buildAttachmentContext(
  attachments: FileRef[],
): Promise<string> {
  const parts: string[] = [];

  for (const att of attachments) {
    if (att.type === "application/json" || att.type === "text/csv") {
      try {
        const tmpDir = os.tmpdir();
        const files = await fs.readdir(tmpDir);
        const match = files.find((f) => f.startsWith(att.id));
        if (match) {
          const content = await fs.readFile(path.join(tmpDir, match), "utf-8");
          parts.push(
            `--- Attached file: ${att.name} (${att.type}) ---\n${content}\n--- End of ${att.name} ---`,
          );
        }
      } catch {
        // File read failure — skip silently
      }
    } else if (att.type === "application/pdf" && att.extractedText) {
      parts.push(
        `--- Attached PDF: ${att.name} ---\n${att.extractedText}\n--- End of ${att.name} ---`,
      );
    } else if (att.type === "image/jpeg" || att.type === "image/png") {
      parts.push(
        `[Attached image: ${att.name}, type: ${att.type}, size: ${att.size} bytes]`,
      );
    }
  }

  return parts.join("\n\n");
}
