"use client";

import { useState } from "react";
import type { ArtifactManifest } from "@/lib/contracts/artifact-manifest";
import { cn } from "@/lib/utils";

interface ArtifactViewerProps {
  artifacts: ArtifactManifest | null;
}

export function ArtifactViewer({ artifacts }: ArtifactViewerProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  if (!artifacts) {
    return (
      <div className="flex items-center justify-center p-4 text-xs text-muted-foreground">
        No artifacts generated yet — click Generate
      </div>
    );
  }

  const activeFile = artifacts.files.find((f) => f.path === selectedFile) ?? artifacts.files[0];

  return (
    <div className="flex flex-col h-full">
      {/* Warnings banner */}
      {artifacts.warnings.length > 0 && (
        <div className="shrink-0 border-b bg-yellow-50 dark:bg-yellow-900/10 px-2 py-1 text-xs text-yellow-700 dark:text-yellow-400">
          {artifacts.warnings.map((w, i) => (
            <div key={i}>⚠ {w}</div>
          ))}
        </div>
      )}

      {/* File list */}
      <div className="shrink-0 flex gap-0.5 border-b px-1 py-1 overflow-x-auto">
        {artifacts.files.map((f) => (
          <button
            key={f.path}
            onClick={() => setSelectedFile(f.path)}
            className={cn(
              "rounded px-2 py-0.5 text-xs whitespace-nowrap transition-colors",
              (activeFile?.path === f.path)
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/50"
            )}
          >
            {f.path}
          </button>
        ))}
      </div>

      {/* File content */}
      {activeFile && (
        <div className="flex-1 overflow-auto">
          <pre className="p-2 text-xs font-mono leading-5 text-foreground whitespace-pre-wrap">
            {activeFile.content}
          </pre>
        </div>
      )}

      {/* Stats bar */}
      <div className="shrink-0 border-t px-2 py-1 text-[10px] text-muted-foreground flex gap-3">
        <span>{artifacts.stats.totalFiles} files</span>
        <span>{(artifacts.stats.totalSizeBytes / 1024).toFixed(1)} KB</span>
        <span>{artifacts.stats.generatorDurationMs}ms</span>
      </div>
    </div>
  );
}
