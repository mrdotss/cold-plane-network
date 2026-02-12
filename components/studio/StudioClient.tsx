"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { StudioLayout } from "./StudioLayout";
import { EditorTabs } from "./editor/EditorTabs";
import { TopologyCanvas } from "./preview/TopologyCanvas";
import { ResourceList } from "./preview/ResourceList";
import { PreviewToolbar } from "./preview/PreviewToolbar";
import { OutputTabs } from "@/components/studio/output/OutputTabs";
import { useStudioPipeline } from "@/hooks/use-studio-pipeline";
import { useSpecStorage } from "@/hooks/use-spec-storage";
import { parseSpec } from "@/lib/spec/parser";
import { validateSpec } from "@/lib/spec/validator";
import { generateArtifacts } from "@/lib/spec/generators";
import { logAuditEvent } from "@/lib/audit/client";
import { bundleZip, zipFilename, triggerDownload } from "@/lib/export/zip";
import { compressSpec, decompressSpec } from "@/lib/export/share";
import type { SpecDiagnostic } from "@/lib/spec/schema";

type LoadingAction = "validate" | "generate" | "share" | "download" | null;

export function StudioClient() {
  const pipeline = useStudioPipeline();
  const { load, save } = useSpecStorage();
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);
  const [hydrated, setHydrated] = useState(false);

  // Restore spec from IndexedDB on mount
  useEffect(() => {
    load().then((content) => {
      if (content) pipeline.setSpecText(content);
      setHydrated(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for share payload in URL hash on mount
  useEffect(() => {
    if (!hydrated) return;
    const hash = window.location.hash.slice(1);
    if (hash) {
      try {
        const decoded = decompressSpec(hash);
        if (decoded) {
          pipeline.setSpecText(decoded);
          // Clear hash after hydrating
          window.history.replaceState(null, "", window.location.pathname);
        }
      } catch {
        // Invalid share payload — ignore silently
      }
    }
  }, [hydrated, pipeline]);

  // Persist spec to IndexedDB on changes
  useEffect(() => {
    if (hydrated) save(pipeline.specText);
  }, [pipeline.specText, hydrated, save]);

  // Toolbar: Validate
  const handleValidate = useCallback(async () => {
    setLoadingAction("validate");
    try {
      const parsed = parseSpec(pipeline.specText);
      const diags = validateSpec(parsed);
      const errorCount = diags.filter((d) => d.severity === "error").length;
      await logAuditEvent("STUDIO_VALIDATE", {
        resourceCount: parsed.resources.length,
        errorCount,
      });
    } finally {
      setLoadingAction(null);
    }
  }, [pipeline.specText]);

  // Toolbar: Generate
  const handleGenerate = useCallback(async () => {
    setLoadingAction("generate");
    try {
      const parsed = parseSpec(pipeline.specText);
      const manifest = generateArtifacts(parsed);
      pipeline.setArtifacts(manifest);
      await logAuditEvent("STUDIO_GENERATE_ARTIFACTS", {
        artifactTypes: manifest.files.map((f) => f.type),
        resourceCount: manifest.resourcesCount,
      });
    } finally {
      setLoadingAction(null);
    }
  }, [pipeline]);

  // Toolbar: Share
  const handleShare = useCallback(async () => {
    setLoadingAction("share");
    try {
      const compressed = compressSpec(pipeline.specText);
      if (!compressed) return;
      if (compressed.length > 8000) {
        alert("Spec is too large for a share link. Consider downloading instead.");
        return;
      }
      const url = `${window.location.origin}${window.location.pathname}#${compressed}`;
      await navigator.clipboard.writeText(url);
      await logAuditEvent("STUDIO_COPY_SHARE_LINK", {});
    } finally {
      // Brief "Copied!" feedback
      setTimeout(() => setLoadingAction(null), 800);
    }
  }, [pipeline.specText]);

  // Toolbar: Download
  const handleDownload = useCallback(async () => {
    if (!pipeline.artifacts) return;
    setLoadingAction("download");
    try {
      const data = await bundleZip(pipeline.artifacts);
      const blob = new Blob([data.buffer as ArrayBuffer], { type: "application/zip" });
      triggerDownload(blob, zipFilename());
      await logAuditEvent("STUDIO_DOWNLOAD_ZIP", {
        artifactCount: pipeline.artifacts.stats.totalFiles,
        totalSizeBytes: pipeline.artifacts.stats.totalSizeBytes,
      });
    } finally {
      setLoadingAction(null);
    }
  }, [pipeline.artifacts]);

  // Diagnostic click → jump to source
  const handleDiagnosticClick = useCallback(
    (diag: SpecDiagnostic) => {
      if (diag.nodeId) {
        pipeline.setSelectedNodeId(diag.nodeId);
      }
    },
    [pipeline]
  );

  // Cross-highlight: node select from canvas or resource list
  const handleNodeSelect = useCallback(
    (nodeId: string | null) => {
      pipeline.setSelectedNodeId(nodeId);
    },
    [pipeline]
  );

  if (!hydrated) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Loading Studio…
      </div>
    );
  }

  // Filter out inferred edges when toggle is off
  const visibleEdges = pipeline.showInferredEdges
    ? pipeline.flowEdges
    : pipeline.flowEdges.filter(
        (e) => (e.data as { relationType?: string })?.relationType !== "inferred"
      );

  return (
    <StudioLayout
      toolbar={
        <PreviewToolbar
          isEmpty={pipeline.isEmpty}
          hasErrors={pipeline.hasErrors}
          hasArtifacts={pipeline.artifacts !== null}
          loadingAction={loadingAction}
          showInferredEdges={pipeline.showInferredEdges}
          onToggleInferredEdges={() => pipeline.setShowInferredEdges(!pipeline.showInferredEdges)}
          onValidate={handleValidate}
          onGenerate={handleGenerate}
          onShare={handleShare}
          onDownload={handleDownload}
        />
      }
      specInput={
        <EditorTabs
          specText={pipeline.specText}
          onSpecChange={pipeline.setSpecText}
        />
      }
      topologyPreview={
        <div className="flex flex-col h-full">
          <div className="flex-1 min-h-0">
            <ReactFlowProvider>
              <TopologyCanvas
                nodes={pipeline.flowNodes}
                edges={visibleEdges}
                selectedNodeId={pipeline.selectedNodeId}
                onNodeSelect={handleNodeSelect}
              />
            </ReactFlowProvider>
          </div>
          <div className="shrink-0 border-t max-h-[200px] overflow-auto">
            <ResourceList
              graphIR={pipeline.graphIR}
              selectedNodeId={pipeline.selectedNodeId}
              onRowSelect={(id) => handleNodeSelect(id)}
            />
          </div>
        </div>
      }
      output={
        <OutputTabs
          diagnostics={pipeline.diagnostics}
          artifacts={pipeline.artifacts}
          onDiagnosticClick={handleDiagnosticClick}
        />
      }
    />
  );
}
