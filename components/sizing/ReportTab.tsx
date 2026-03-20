"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Download01Icon,
  CheckmarkCircle01Icon,
  Alert02Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons";
import { generateExcelReport, downloadWorkbook } from "@/lib/sizing/excel-generator";
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

interface ReportTabProps {
  pricingData: PricingData | null;
  fileName: string;
}

export function ReportTab({ pricingData, fileName }: ReportTabProps) {
  const [loading, setLoading] = useState(false);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autofillWarning, setAutofillWarning] = useState<string | null>(null);
  const [autofillSuccess, setAutofillSuccess] = useState<string | null>(null);
  const [readyWorkbook, setReadyWorkbook] = useState<Workbook | null>(null);
  const [xlsxFileName, setXlsxFileName] = useState("");
  const [autofillEnabled, setAutofillEnabled] = useState(true);
  // Track if autofill failed so we can offer "Generate without auto-fill"
  const [autofillFailed, setAutofillFailed] = useState(false);
  // SSE progress state
  const [currentBatch, setCurrentBatch] = useState<number | undefined>(undefined);
  const [totalBatches, setTotalBatches] = useState<number | undefined>(undefined);
  const [currentServiceName, setCurrentServiceName] = useState<string | undefined>(undefined);
  const [completedCount, setCompletedCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  // Phase-based progress (Fix 2)
  const [autofillPhase, setAutofillPhase] = useState<"sending" | "parsing" | "done" | undefined>(undefined);
  const [parsedCount, setParsedCount] = useState(0);

  const tierDetection: TierDetectionResult | null = useMemo(() => {
    if (!pricingData) return null;
    return detectPricingTiers(pricingData);
  }, [pricingData]);

  const hasMissingTiers = tierDetection !== null && tierDetection.missingTiers.length > 0;

  /** Extract services from pricingData for the autofill API call. */
  function extractServices(data: PricingData): AutofillServiceInput[] {
    const seen = new Set<string>();
    const services: AutofillServiceInput[] = [];
    // Use the first tier that has data (the present tier)
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
              properties: svc.properties ?? {},
              currentPricing: {
                monthly: String(svc.monthly),
                upfront: String(svc.upfront),
                twelve_months: String(svc.first12MonthsTotal),
              },
            });
          }
        }
      }
    }
    return services;
  }

  /** Call the autofill API and merge results. Returns merged PricingData or null on failure. */
  async function runAutofill(data: PricingData, detection: TierDetectionResult): Promise<PricingData | null> {
    const allServices = extractServices(data);
    // Only request RI pricing for services that support it
    const onlyRi = detection.missingTiers.every((t) => t === "ri1Year" || t === "ri3Year");
    const services = onlyRi ? allServices.filter((s) => isRiEligible(s.serviceName)) : allServices;
    const skippedCount = allServices.length - services.length;

    setAutofillLoading(true);
    setAutofillWarning(null);
    setAutofillSuccess(null);
    setCurrentBatch(undefined);
    setTotalBatches(undefined);
    setCurrentServiceName(undefined);
    setCompletedCount(0);
    setFailedCount(0);
    setAutofillPhase("sending");
    setParsedCount(0);

    if (services.length === 0) {
      setAutofillLoading(false);
      setAutofillSuccess(`All ${allServices.length} service(s) are pay-as-you-go only — no RI pricing to fill`);
      return data;
    }

    try {
      const res = await fetch("/api/sizing/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          services,
          inputTier: detection.presentTiers[0],
          missingTiers: detection.missingTiers,
        }),
      });

      // Read body as text first, then parse
      const responseText = await res.text();

      if (!res.ok) {
        const errBody = (() => { try { return JSON.parse(responseText); } catch { return { error: `Auto-fill failed (${res.status})` }; } })();
        throw new Error(errBody.error || `Auto-fill failed (${res.status})`);
      }

      // Response received — switch to parsing phase
      setAutofillPhase("parsing");

      let autofillResponse: AutofillResponse;
      try {
        const parsed = JSON.parse(responseText);
        // Handle both { services: [...] } and { data: { services: [...] } } shapes
        autofillResponse = parsed.data ?? parsed;
      } catch {
        throw new Error("Auto-fill returned invalid response");
      }

      if (!autofillResponse?.services?.length) {
        throw new Error("Auto-fill returned no valid pricing data");
      }

      // Update parsedCount as we iterate through matched services
      for (let i = 0; i < autofillResponse.services.length; i++) {
        setParsedCount(i + 1);
        // Small yield to allow React to render progress updates
        if (i % 3 === 0) await new Promise((r) => setTimeout(r, 0));
      }

      const merged = mergePricingData(data, autofillResponse, detection.missingTiers);

      // Check for partial failures (services not matched) — only among RI-eligible ones
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

      // All done — show completed state
      setAutofillPhase("done");
      setParsedCount(filledCount);

      const msg = skippedCount > 0
        ? `Auto-filled pricing for ${filledCount} service(s) (${skippedCount} pay-as-you-go skipped)`
        : `Auto-filled pricing for ${filledCount} service(s)`;
      setAutofillSuccess(msg);

      return merged;
    } catch (err) {
      setAutofillFailed(true);
      setAutofillWarning(
        err instanceof Error ? err.message : "Auto-fill failed. You can generate without auto-fill."
      );
      return null;
    } finally {
      setAutofillLoading(false);
      // Reset phase if it wasn't set to "done" (i.e. on error)
      setAutofillPhase((prev) => (prev === "done" ? prev : undefined));
    }
  }

  const handleGenerate = async (skipAutofill = false) => {
    if (!pricingData) return;
    setLoading(true);
    setError(null);
    setReadyWorkbook(null);
    setAutofillFailed(false);
    setAutofillWarning(null);
    setAutofillSuccess(null);
    setAutofillPhase(undefined);
    setParsedCount(0);

    try {
      let dataForExcel = pricingData;

      // Run autofill if enabled, missing tiers exist, and not skipping
      if (!skipAutofill && autofillEnabled && hasMissingTiers && tierDetection) {
        const merged = await runAutofill(pricingData, tierDetection);
        if (merged) {
          dataForExcel = merged;
        } else {
          // Autofill failed entirely — stop and let user decide
          setLoading(false);
          return;
        }
      }

      const xlsxName = fileName.replace(".json", ".xlsx");
      const workbook = await generateExcelReport(dataForExcel);

      setReadyWorkbook(workbook);
      setXlsxFileName(xlsxName);

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
          reportType: "report",
          region: dataForExcel.regions[0] ?? "",
          totalMonthly: dataForExcel.totalMonthly,
          totalAnnual: dataForExcel.totalAnnual,
          serviceCount: dataForExcel.serviceCount,
          metadata: JSON.stringify(metadata).slice(0, 1024),
        }),
      });

      // Audit: generate event
      await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "SIZING_GENERATE_REPORT",
          metadata: {
            reportType: "report",
            serviceCount: dataForExcel.serviceCount,
            totalMonthly: dataForExcel.totalMonthly,
          },
        }),
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report");
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
          metadata: { reportType: "report" },
        }),
      }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }, [readyWorkbook, xlsxFileName]);

  const isProcessing = loading || autofillLoading;

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Generate a formatted Excel report from your uploaded pricing data.
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
            id="autofill-toggle"
            checked={autofillEnabled}
            onCheckedChange={setAutofillEnabled}
            disabled={isProcessing}
          />
          <Label htmlFor="autofill-toggle" className="text-sm cursor-pointer">
            Auto-fill missing pricing tiers
          </Label>
        </div>
      )}

      {/* Generate button */}
      <Button
        onClick={() => handleGenerate(false)}
        disabled={!pricingData || isProcessing}
      >
        {loading && !autofillLoading
          ? "Generating..."
          : "Generate Report"}
      </Button>

      {/* AI progress animation during autofill */}
      {autofillLoading && pricingData && (
        <AutofillProgress
          serviceCount={pricingData.serviceCount}
          currentBatch={currentBatch}
          totalBatches={totalBatches}
          currentServiceName={currentServiceName}
          completedCount={completedCount}
          failedCount={failedCount}
          phase={autofillPhase}
          parsedCount={parsedCount}
        />
      )}

      {/* Autofill success message */}
      {autofillSuccess && !autofillWarning && (
        <p className="text-sm text-green-600 dark:text-green-400">{autofillSuccess}</p>
      )}

      {/* Autofill warning (partial failure or full failure) */}
      {autofillWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-950">
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400"
          />
          <div className="flex-1 space-y-2">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">{autofillWarning}</p>
            {autofillFailed && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleGenerate(true)}
                disabled={isProcessing}
              >
                Generate without auto-fill
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Ready workbook download */}
      {readyWorkbook && !isProcessing && (
        <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} strokeWidth={2} className="size-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Report ready
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
