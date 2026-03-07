"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AgentResponse } from "./AgentResponse";
import type { PricingData, ReportMetadata } from "@/lib/sizing/types";

interface RecommendTabProps {
  pricingData: PricingData | null;
  fileName: string;
}

export function RecommendTab({ pricingData, fileName }: RecommendTabProps) {
  const [description, setDescription] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRecommend = async () => {
    if (!pricingData || !description.trim()) return;
    setLoading(true);
    setError(null);
    setResponse("");

    try {
      // Build pricing context summary
      const pricingContext = JSON.stringify({
        fileName: pricingData.fileName,
        serviceCount: pricingData.serviceCount,
        regions: pricingData.regions,
        totalMonthly: pricingData.totalMonthly,
        totalAnnual: pricingData.totalAnnual,
        tiers: pricingData.tiers.map((t) => ({
          tierName: t.tierName,
          grandTotalMonthly: t.grandTotalMonthly,
          groups: t.groups.map((g) => ({
            name: g.name,
            subtotalMonthly: g.subtotalMonthly,
            services: g.services.map((s) => s.serviceName),
          })),
        })),
      });

      const res = await fetch("/api/sizing/recommend?stream=true", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pricingContext,
          userDescription: description,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullText += chunk;
          setResponse(fullText);
        }
      }

      // Persist report summary
      const metadata: ReportMetadata = {
        regions: pricingData.regions,
        currency: pricingData.currency,
        tierBreakdown: pricingData.tiers.map((t) => ({
          tierName: t.tierName,
          monthly: t.grandTotalMonthly,
          annual: t.grandTotalFirst12Months,
        })),
      };

      await fetch("/api/sizing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName,
          reportType: "recommend",
          region: pricingData.regions[0] ?? "",
          totalMonthly: pricingData.totalMonthly,
          totalAnnual: pricingData.totalAnnual,
          serviceCount: pricingData.serviceCount,
          metadata: JSON.stringify(metadata).slice(0, 1024),
        }),
      });

      // Audit event
      await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "SIZING_AGENT_RECOMMEND",
          metadata: {
            reportType: "recommend",
            serviceCount: pricingData.serviceCount,
            promptLength: pricingContext.length + description.length,
          },
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get recommendation");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Describe your sizing needs and get AI-powered recommendations.
      </p>
      <Textarea
        placeholder="Describe your workload, requirements, or questions about the pricing data..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="min-h-24"
      />
      <Button
        onClick={handleRecommend}
        disabled={!pricingData || !description.trim() || loading}
      >
        {loading ? "Getting Recommendation..." : "Get Recommendation"}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <AgentResponse content={response} isStreaming={loading} />
    </div>
  );
}
