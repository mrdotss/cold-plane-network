import { describe, it, expect } from "vitest";
import fc from "fast-check";
import JSZip from "jszip";
import { bundleZip } from "../zip";
import type { ArtifactManifest, ArtifactFile } from "@/lib/contracts/artifact-manifest";

/**
 * Arbitrary for generating a valid ArtifactFile with a unique path.
 */
function arbArtifactFile(path: string): fc.Arbitrary<ArtifactFile> {
  return fc.string({ minLength: 1, maxLength: 200 }).map((content) => ({
    path,
    type: "text/plain",
    content,
    sizeBytes: new TextEncoder().encode(content).byteLength,
  }));
}

/**
 * Arbitrary for generating a valid ArtifactManifest.
 * Always includes manifest.json, artifacts.json, and README.md as minimum files.
 */
const arbManifest: fc.Arbitrary<ArtifactManifest> = fc
  .array(
    fc.string({ minLength: 1, maxLength: 30, unit: "grapheme-ascii" }).filter(
      (s) =>
        !["manifest.json", "artifacts.json", "README.md"].includes(s) &&
        /^[a-zA-Z0-9._-]+$/.test(s) &&
        s !== "." &&
        s !== ".."
    ),
    { minLength: 0, maxLength: 5 }
  )
  .chain((extraPaths) => {
    const uniquePaths = [...new Set(extraPaths)];
    const allPaths = ["manifest.json", "artifacts.json", "README.md", ...uniquePaths];
    return fc.tuple(...allPaths.map((p) => arbArtifactFile(p))).map((files) => {
      const totalSize = files.reduce((s, f) => s + f.sizeBytes, 0);
      return {
        version: "1" as const,
        generatedAt: new Date().toISOString(),
        resourcesCount: 1,
        files,
        warnings: [],
        stats: {
          totalFiles: files.length,
          totalSizeBytes: totalSize,
          generatorDurationMs: 0,
        },
      };
    });
  });

describe("ZIP export", () => {
  /**
   * Feature: cold-plane-mvp, Property 17: ZIP contains exactly manifest files
   * Validates: Requirements 8.3
   *
   * For any ArtifactManifest, the ZIP archive produced by bundleZip SHALL contain
   * exactly the files listed in manifest.files, with no extra or missing files.
   */
  it("Property 17: ZIP contains exactly manifest files", async () => {
    await fc.assert(
      fc.asyncProperty(arbManifest, async (manifest) => {
        const data = await bundleZip(manifest);
        const zip = await JSZip.loadAsync(data);

        const zipPaths = Object.keys(zip.files).sort();
        const manifestPaths = manifest.files.map((f) => f.path).sort();

        expect(zipPaths).toEqual(manifestPaths);

        // Verify content matches
        for (const file of manifest.files) {
          const zipContent = await zip.file(file.path)?.async("string");
          expect(zipContent).toBe(file.content);
        }
      }),
      { numRuns: 100 }
    );
  });
});
