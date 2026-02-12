/** A single generated output file. */
export interface ArtifactFile {
  /** Relative path within the export (e.g., "main.tf", "README.md"). */
  path: string;
  /** MIME type or file type hint. */
  type: string;
  /** File content as a string. */
  content: string;
  /** Byte size of content (UTF-8). */
  sizeBytes: number;
}

/** Describes the output of artifact generation. */
export interface ArtifactManifest {
  /** Schema version for forward compatibility. */
  version: "1";
  /** ISO 8601 timestamp of generation. */
  generatedAt: string;
  /** Total number of resources in the source spec. */
  resourcesCount: number;
  /** List of generated output files. */
  files: ArtifactFile[];
  /** Non-fatal warnings from generation. */
  warnings: string[];
  /** Summary statistics. */
  stats: {
    totalFiles: number;
    totalSizeBytes: number;
    generatorDurationMs: number;
  };
}
