import JSZip from "jszip";
import type { ArtifactManifest } from "@/lib/contracts/artifact-manifest";

/**
 * Build a JSZip instance from an ArtifactManifest.
 * Contains exactly the files listed in manifest.files — no extras.
 */
export function buildZip(manifest: ArtifactManifest): JSZip {
  const zip = new JSZip();
  for (const file of manifest.files) {
    zip.file(file.path, file.content);
  }
  return zip;
}

/**
 * Bundle an ArtifactManifest's files into a ZIP Uint8Array.
 * Works in both Node.js and browser environments.
 */
export async function bundleZip(manifest: ArtifactManifest): Promise<Uint8Array> {
  const zip = buildZip(manifest);
  return zip.generateAsync({ type: "uint8array" });
}

/**
 * Generate the ZIP filename with ISO 8601 timestamp (colons replaced for filesystem safety).
 */
export function zipFilename(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `cold-network-plane-${ts}.zip`;
}

/**
 * Trigger a browser download of a Blob.
 */
export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
