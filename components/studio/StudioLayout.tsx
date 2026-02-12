"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

interface StudioLayoutProps {
  specInput: React.ReactNode;
  topologyPreview: React.ReactNode;
  output: React.ReactNode;
  toolbar: React.ReactNode;
}

export function StudioLayout({
  specInput,
  topologyPreview,
  output,
  toolbar,
}: StudioLayoutProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 border-b px-2 py-1.5">{toolbar}</div>
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize={25} minSize={15} className="flex flex-col">
          {specInput}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={45} minSize={25} className="flex flex-col">
          {topologyPreview}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={30} minSize={15} className="flex flex-col">
          {output}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
