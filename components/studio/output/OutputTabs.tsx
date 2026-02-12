"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { DiagnosticsPanel } from "@/components/studio/output/DiagnosticsPanel";
import { ArtifactViewer } from "@/components/studio/output/ArtifactViewer";
import type { SpecDiagnostic } from "@/lib/spec/schema";
import type { ArtifactManifest } from "@/lib/contracts/artifact-manifest";

interface OutputTabsProps {
  diagnostics: SpecDiagnostic[];
  artifacts: ArtifactManifest | null;
  onDiagnosticClick?: (diagnostic: SpecDiagnostic) => void;
}

export function OutputTabs({
  diagnostics,
  artifacts,
  onDiagnosticClick,
}: OutputTabsProps) {
  const errorCount = diagnostics.filter((d) => d.severity === "error").length;
  const warnCount = diagnostics.filter((d) => d.severity === "warning").length;

  return (
    <Tabs defaultValue="diagnostics" className="flex flex-col h-full">
      <div className="shrink-0 px-2 pt-1">
        <TabsList className="w-full">
          <TabsTrigger value="diagnostics">
            Diagnostics
            {errorCount > 0 && (
              <span className="ml-1 rounded bg-destructive/10 px-1 text-[10px] text-destructive">
                {errorCount}
              </span>
            )}
            {warnCount > 0 && errorCount === 0 && (
              <span className="ml-1 rounded bg-yellow-100 px-1 text-[10px] text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                {warnCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="artifacts">
            Artifacts
            {artifacts && (
              <span className="ml-1 rounded bg-muted px-1 text-[10px] text-muted-foreground">
                {artifacts.files.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="diagnostics" className="flex-1 min-h-0 overflow-auto">
        <DiagnosticsPanel
          diagnostics={diagnostics}
          onDiagnosticClick={onDiagnosticClick}
        />
      </TabsContent>
      <TabsContent value="artifacts" className="flex-1 min-h-0 overflow-auto">
        <ArtifactViewer artifacts={artifacts} />
      </TabsContent>
    </Tabs>
  );
}
