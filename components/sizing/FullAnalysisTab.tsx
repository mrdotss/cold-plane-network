"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Download01Icon,
  CheckmarkCircle01Icon,
  Alert02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import {
  generateFullAnalysisReport,
  generateExcelReport,
  downloadWorkbook,
} from "@/lib/sizing/excel-generator";
import { detectPricingTiers } from "@/lib/sizing/parser";
import { mergePricingData, isRiEligible } from "@/lib/sizing/merge";
import { AutofillProgress } from "./AutofillProgress";
import type {
  PricingData,
  ReportMetadata,
  TierDetectionResult,
  AutofillServiceInput,
  AutofillResponse,
} from "@/lib/sizing/types";
import type { Workbook } from "exceljs";

const TIER_LABELS: Record<string, string> = {
  onDemand: "On-Demand",
  ri1Year: "RI 1-Year",
  ri3Year: "RI 3-Year",
};

interface FullAnalysisTabProps {
  pricingData: PricingData | null;
  fileName: string;
}

export function FullAnalysisTab({ pricingData, fileName }: FullAnalysisTabProps) {
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [readyWorkbook, setReadyWorkbook] = useState<Workbook | null>(null);
  const [xlsxFileName, setXlsxFileName] = useState("");
  const [hadAgentNotes, setHadAgentNotes] = useState(false);
  const [autofillEnabled, setAutofillEnabled] = useState(true);
  const [autofillWarning, setAutofillWarning] = useState<string | null>(null);
  const [autofillSuccess, setAutofillSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const tierDetection: TierDetectionResult | null = useMemo(() => {
    if (!pricingData) return null;
    return detectPricingTiers(pricingData);
  }, [pricingData]);

  const hasMissingTiers = tierDetection !== null && tierDetection.missingTiers.length > 0;

  /** Extract unique services from pricingData for the autofill API. */
  function extractServices(data: PricingData): AutofillServiceInput[] {
    const seen = new Set<string>();
    const services: AutofillServiceInput[] = [];
    for (const tier of data.tiers) {
      for (const group of tier.groups) {
        for (const svc of group.services) {
          const key = `${svc.serviceName}|${svc.description}|${svc.region}`.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            services.push({
              serviceName: svc.serviceName,
              description: svc.description,
              region: svc.region,
              configurationSummary: svc.configurationSummary,
            });
          }
        }
      }
    }
    return services;
  }

  /** Call the autofill API. Returns AutofillResponse + services list. */
  async function callAutofill(
    data: PricingData,
    detection: TierDetectionResult
  ): Promise<{ response: AutofillResponse; services: AutofillServiceInput[] }> {
    const allServices = extractServices(data);
    // Only request RI pricing for services that support it
    const onlyRi = detection.missingTiers.every((t) => t === "ri1Year" || t === "ri3Year");
    const services = onlyRi ? allServices.filter((s) => isRiEligible(s.serviceName)) : allServices;

    if (services.length === 0) {
      return { response: { services: [] }, services: allServices };
    }

    const res = await fetch("/api/sizing/autofill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        services,
        inputTier: detection.presentTiers[0],
        missingTiers: detection.missingTiers,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Auto-fill request failed" }));
      throw new Error(body.error || `Auto-fill failed (${res.status})`);
    }
    const { data: autofillResponse } = (await res.json()) as { data: AutofillResponse };
    return { response: autofillResponse, services };
  }

  /** Call the recommend API. Returns agent notes string or throws. */
  async function callRecommend(data: PricingData): Promise<string> {
    const pricingContext = JSON.stringify({
      fileName: data.fileName,
      serviceCount: data.serviceCount,
      regions: data.regions,
      totalMonthly: data.totalMonthly,
      totalAnnual: data.totalAnnual,
      tiers: data.tiers.map((t) => ({
        tierName: t.tierName,
        grandTotalMonthly: t.grandTotalMonthly,
        groups: t.groups.map((g) => ({
          name: g.name,
          subtotalMonthly: g.subtotalMonthly,
          services: g.services.map((s) => s.serviceName),
        })),
      })),
    });

    const res = await fetch("/api/sizing/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pricingContext, userDescription: description }),
    });
    if (!res.ok) throw new Error("Recommend request failed");
    const resData = await res.json();
    const notes = resData.data?.response;
    if (!notes) throw new Error("No recommendation returned");
    return notes;
  }

  const handleAnalysis = async () => {
    if (!pricingData || !description.trim()) return;
    setLoading(true);
    setError(null);
    setReadyWorkbook(null);
    setAutofillWarning(null);
    setAutofillSuccess(null);
    setWarnings([]);

    const xlsxName = fileName.replace(".json", "-full-analysis.xlsx");
    let dataForExcel = pricingData;
    let agentNotes: string | null = null;
    const newWarnings: string[] = [];

    try {
      const shouldAutofill = autofillEnabled && hasMissingTiers && tierDetection;

      // Run autofill + recommend in parallel (no MCP tool calls = no 429 risk)
      const [autofillResult, recommendResult] = await Promise.allSettled([
        shouldAutofill
          ? callAutofill(pricingData, tierDetection)
          : Promise.resolve(null),
        callRecommend(pricingData),
      ]);

      // Handle autofill result
      if (autofillResult.status === "fulfilled" && autofillResult.value) {
        const { response: autofillResponse, services } = autofillResult.value;
        dataForExcel = mergePricingData(pricingData, autofillResponse, tierDetection!.missingTiers);

        // Check for partial failures
        const returnedNames = new Set(
          autofillResponse.services.map(
            (s) => s.service.toLowerCase().trim()
          )
        );
        const unfilled = services.filter(
          (s) => !returnedNames.has(s.serviceName.toLowerCase().trim())
        );
        if (unfilled.length > 0 && unfilled.length < services.length) {
          setAutofillWarning(
            `${unfilled.length} service(s) could not be matched: ${unfilled.map((s) => s.serviceName).join(", ")}`
          );
        }
        const filledCount = services.length - unfilled.length;
        setAutofillSuccess(`Auto-filled pricing for ${filledCount} service(s)`);
      } else if (autofillResult.status === "rejected") {
        newWarnings.push("Auto-fill failed — using original pricing data.");
      }

      // Handle recommend result
      if (recommendResult.status === "fulfilled") {
        agentNotes = recommendResult.value;
      } else {
        newWarnings.push("Agent recommendation unavailable — Excel generated without AI notes.");
      }

      // Both failed
      if (autofillResult.status === "rejected" && recommendResult.status === "rejected") {
        newWarnings.length = 0;
        newWarnings.push("Both auto-fill and recommendation failed — generating report with original data only.");
      }

      setWarnings(newWarnings);

      const workbook = agentNotes
        ? await generateFullAnalysisReport(dataForExcel, agentNotes)
        : await generateExcelReport(dataForExcel);

      setReadyWorkbook(workbook);
      setXlsxFileName(xlsxName);
      setHadAgentNotes(!!agentNotes);

      // Persist report summary
      const metadata: ReportMetadata = {
        regions: dataForExcel.regions,
        currency: dataForExcel.currency,
        tierBreakdown: dataForExcel.tiers.map((t) => ({
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
          reportType: "full",
          region: dataForExcel.regions[0] ?? "",
          totalMonthly: dataForExcel.totalMonthly,
          totalAnnual: dataForExcel.totalAnnual,
          serviceCount: dataForExcel.serviceCount,
          metadata: JSON.stringify(metadata).slice(0, 1024),
        }),
      });

      // Audit events
      await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "SIZING_GENERATE_REPORT",
          metadata: { reportType: "full", serviceCount: dataForExcel.serviceCount, totalMonthly: dataForExcel.totalMonthly },
        }),
      }).catch(() => {});

      if (agentNotes) {
        await fetch("/api/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventType: "SIZING_AGENT_RECOMMEND",
            metadata: { reportType: "full", serviceCount: dataForExcel.serviceCount, totalMonthly: dataForExcel.totalMonthly },
          }),
        }).catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate analysis");
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = useCallback(async () => {
    if (!readyWorkbook) return;
    try {
      await downloadWorkbook(readyWorkbook, xlsxFileName);
      await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "SIZING_DOWNLOAD_EXCEL",
          metadata: { reportType: "full" },
        }),
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }, [readyWorkbook, xlsxFileName]);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Generate a comprehensive Excel report with AI-powered recommendations included.
      </p>

      {/* Tier detection info banner */}
      {tierDetection && pricingData && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900 dark:bg-blue-950">
          <HugeiconsIcon
            icon={InformationCircleIcon}
            strokeWidth={2}
            className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400"
          />
          <div className="text-sm">
            <span className="text-blue-800 dark:text-blue-200">
              Detected: {tierDetection.presentTiers.map((t) => TIER_LABELS[t]).join(", ") || "None"}
            </span>
            {tierDetection.missingTiers.length > 0 && (
              <span className="text-blue-600 dark:text-blue-400">
                {" · "}Missing: {tierDetection.missingTiers.map((t) => TIER_LABELS[t]).join(", ")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Auto-fill toggle — hidden when no tiers are missing */}
      {hasMissingTiers && (
        <div className="flex items-center gap-2">
          <Switch
            id="autofill-toggle-full"
            checked={autofillEnabled}
            onCheckedChange={setAutofillEnabled}
            disabled={loading}
          />
          <Label htmlFor="autofill-toggle-full" className="text-sm cursor-pointer">
            Auto-fill missing pricing tiers
          </Label>
        </div>
      )}

      <Textarea
        placeholder="Describe your workload and what you'd like the analysis to focus on..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="min-h-24"
      />
      <Button
        onClick={handleAnalysis}
        disabled={!pricingData || !description.trim() || loading}
      >
        {loading ? "Generating Full Analysis..." : "Generate Full Analysis"}
      </Button>

      {/* AI progress animation during loading */}
      {loading && pricingData && (
        <AutofillProgress serviceCount={pricingData.serviceCount} />
      )}

      {/* Autofill success message */}
      {autofillSuccess && !autofillWarning && (
        <p className="text-sm text-green-600 dark:text-green-400">{autofillSuccess}</p>
      )}

      {/* Autofill partial warning */}
      {autofillWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-950">
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400"
          />
          <p className="text-sm text-yellow-800 dark:text-yellow-200">{autofillWarning}</p>
        </div>
      )}

      {/* Warnings from parallel execution */}
      {warnings.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-950">
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400"
          />
          <div className="space-y-1">
            {warnings.map((w, i) => (
              <p key={i} className="text-sm text-yellow-800 dark:text-yellow-200">{w}</p>
            ))}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {readyWorkbook && !loading && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} strokeWidth={2} className="size-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              {hadAgentNotes ? "Full analysis ready" : "Report ready (without AI notes)"}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 truncate">
              {xlsxFileName}
            </p>
          </div>
          <Button size="sm" onClick={handleDownload} className="shrink-0 gap-2">
            <HugeiconsIcon icon={Download01Icon} strokeWidth={2} className="size-4" />
            Download Excel
          </Button>
        </div>
      )}
    </div>
  );
}
