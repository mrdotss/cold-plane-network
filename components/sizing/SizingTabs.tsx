"use client";

import React, { useState, useCallback } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FileUpload } from "./FileUpload";
import { ReportTab } from "./ReportTab";
import { RecommendTab } from "./RecommendTab";
import { FullAnalysisTab } from "./FullAnalysisTab";
import type { PricingData } from "@/lib/sizing/types";

export function SizingTabs() {
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [fileName, setFileName] = useState("");

  const handleParsed = useCallback((data: PricingData, name: string) => {
    setPricingData(data);
    setFileName(name);
  }, []);

  return (
    <div className="space-y-4">
      <FileUpload onParsed={handleParsed} />

      <Tabs defaultValue="report">
        <TabsList>
          <TabsTrigger value="report">Report</TabsTrigger>
          <TabsTrigger value="recommend">Recommend</TabsTrigger>
          <TabsTrigger value="full">Full Analysis</TabsTrigger>
        </TabsList>
        <TabsContent value="report">
          <ReportTab pricingData={pricingData} fileName={fileName} />
        </TabsContent>
        <TabsContent value="recommend">
          <RecommendTab pricingData={pricingData} fileName={fileName} />
        </TabsContent>
        <TabsContent value="full">
          <FullAnalysisTab pricingData={pricingData} fileName={fileName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
