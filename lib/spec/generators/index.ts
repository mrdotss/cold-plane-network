import type { ArtifactManifest, ArtifactFile } from "@/lib/contracts/artifact-manifest";
import type { ParsedSpec } from "../schema";
import { generateTerraformModular } from "./terraform/index";

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
  warnings: string[],
  terraformFiles: { path: string }[]
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
  lines.push("- `README.md` — This file");
  lines.push("");

  if (terraformFiles.length > 0) {
    lines.push("### Terraform Modules");
    lines.push("");
    for (const tf of terraformFiles) {
      lines.push(`- \`${tf.path}\``);
    }
    lines.push("");
  }

  lines.push("## Usage");
  lines.push("");
  lines.push("```bash");
  lines.push("cd terraform");
  lines.push("terraform init");
  lines.push("terraform plan");
  lines.push("terraform apply");
  lines.push("```");
  lines.push("");

  return lines.join("\n");
}

/**
 * Orchestrate artifact generation from a parsed spec.
 * Produces an ArtifactManifest with: manifest.json, artifacts.json, README.md,
 * and a modular Terraform file structure (provider.tf, main.tf, modules/...).
 */
export function generateArtifacts(parsed: ParsedSpec): ArtifactManifest {
  const startTime = performance.now();
  const allWarnings: string[] = [];

  // Generate modular Terraform
  const terraform = generateTerraformModular(parsed.resources);
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
  const readme = generateReadme(parsed.resources, allWarnings, terraform.files);

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

  // Add all Terraform files
  for (const tf of terraform.files) {
    files.push({
      path: tf.path,
      type: "text/plain",
      content: tf.content,
      sizeBytes: byteSize(tf.content),
    });
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
