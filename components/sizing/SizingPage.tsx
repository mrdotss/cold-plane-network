"use client";

import { useState, useCallback } from "react";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ReportPanel } from "./ReportPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import type { PricingData } from "@/lib/sizing/types";

/**
 * Split-panel Sizing page: ReportPanel (left) + ChatPanel (right).
 * Shared PricingData state flows from ReportPanel → ChatPanel via parent state.
 */
export function SizingPage() {
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [fileName, setFileName] = useState("");

  const handleParsed = useCallback((data: PricingData, name: string) => {
    setPricingData(data);
    setFileName(name);
  }, []);

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full overflow-hidden">
      <ResizablePanel defaultSize={45} minSize={30}>
        <div className="h-full overflow-y-auto p-4">
          <ReportPanel onParsed={handleParsed} />
        </div>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={55} minSize={30}>
        <ChatPanel pricingData={pricingData} fileName={fileName} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
