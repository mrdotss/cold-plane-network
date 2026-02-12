import type { ArtifactManifest, ArtifactFile } from "@/lib/contracts/artifact-manifest";
import type { ParsedSpec } from "../schema";
import { generateTerraform } from "./terraform";

/**
 * Compute byte size of a UTF-8 string.
 * Works in both Node.js and browser environments.
 */
function byteSize(content: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(content).byteLength;
  }
  // Fallback for Node.js without TextEncoder
  return Buffer.byteLength(content, "utf-8");
}

/**
 * Generate a README.md summarizing the generation output.
 */
function generateReadme(
  resources: ParsedSpec["resources"],
  warnings: string[]
): string {
  const lines: string[] = [];
  lines.push("# Cold Network Plane — Generated Artifacts");
  lines.push("");
  lines.push(`Generated at: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`## Resources (${resources.length})`);
  lines.push("");
  for (const r of resources) {
    const parent = r.parent ? ` (child of ${r.parent})` : "";
    lines.push(`- **${r.name}** — \`${r.type}\`${parent}`);
  }
  lines.push("");

  if (warnings.length > 0) {
    lines.push("## Warnings");
    lines.push("");
    for (const w of warnings) {
      lines.push(`- ${w}`);
    }
    lines.push("");
  }

  lines.push("## Files");
  lines.push("");
  lines.push("- `manifest.json` — Artifact manifest");
  lines.push("- `artifacts.json` — Machine-readable structured output");
  lines.push("- `main.tf` — Terraform configuration");
  lines.push("- `README.md` — This file");
  lines.push("");

  return lines.join("\n");
}

/**
 * Orchestrate artifact generation from a parsed spec.
 * Produces an ArtifactManifest with at minimum: manifest.json, artifacts.json, README.md.
 */
export function generateArtifacts(parsed: ParsedSpec): ArtifactManifest {
  const startTime = performance.now();
  const allWarnings: string[] = [];

  // Generate Terraform
  const terraform = generateTerraform(parsed.resources);
  allWarnings.push(...terraform.warnings);

  // Build artifacts.json — structured output of all resources
  const artifactsJson = JSON.stringify(
    {
      version: "1",
      resources: parsed.resources.map((r) => ({
        name: r.name,
        type: r.type,
        parent: r.parent ?? null,
        properties: r.properties,
        dependsOn: r.dependsOn ?? [],
        connectTo: r.connectTo ?? [],
      })),
    },
    null,
    2
  );

  // Build README
  const readme = generateReadme(parsed.resources, allWarnings);

  // Collect files (manifest.json will be added after we know the full list)
  const files: ArtifactFile[] = [];

  const artifactsFile: ArtifactFile = {
    path: "artifacts.json",
    type: "application/json",
    content: artifactsJson,
    sizeBytes: byteSize(artifactsJson),
  };
  files.push(artifactsFile);

  const readmeFile: ArtifactFile = {
    path: "README.md",
    type: "text/markdown",
    content: readme,
    sizeBytes: byteSize(readme),
  };
  files.push(readmeFile);

  // Add main.tf if there are resources
  if (parsed.resources.length > 0) {
    const mainTfFile: ArtifactFile = {
      path: "main.tf",
      type: "text/plain",
      content: terraform.mainTf,
      sizeBytes: byteSize(terraform.mainTf),
    };
    files.push(mainTfFile);
  }

  const durationMs = Math.round(performance.now() - startTime);

  // Build the manifest (without itself in the files list yet)
  const manifest: ArtifactManifest = {
    version: "1",
    generatedAt: new Date().toISOString(),
    resourcesCount: parsed.resources.length,
    files: [],
    warnings: allWarnings,
    stats: {
      totalFiles: files.length + 1, // +1 for manifest.json itself
      totalSizeBytes: 0, // will be updated
      generatorDurationMs: durationMs,
    },
  };

  // Serialize manifest.json
  const manifestJson = JSON.stringify(manifest, null, 2);
  const manifestFile: ArtifactFile = {
    path: "manifest.json",
    type: "application/json",
    content: manifestJson,
    sizeBytes: byteSize(manifestJson),
  };

  // Final file list: manifest.json first, then the rest
  const allFiles = [manifestFile, ...files];
  const finalTotalSize = allFiles.reduce((sum, f) => sum + f.sizeBytes, 0);

  manifest.files = allFiles;
  manifest.stats.totalSizeBytes = finalTotalSize;

  return manifest;
}
