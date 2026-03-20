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
import { FileUpload } from "./FileUpload";
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

interface ReportPanelProps {
  onParsed: (data: PricingData, fileName: string) => void;
}

export function ReportPanel({ onParsed }: ReportPanelProps) {
  const [pricingData, setPricingData] = useState<PricingData | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [autofillLoading, setAutofillLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autofillWarning, setAutofillWarning] = useState<string | null>(null);
  const [autofillSuccess, setAutofillSuccess] = useState<string | null>(null);
  const [readyWorkbook, setReadyWorkbook] = useState<Workbook | null>(null);
  const [xlsxFileName, setXlsxFileName] = useState("");
  const [autofillEnabled, setAutofillEnabled] = useState(true);
  const [autofillFailed, setAutofillFailed] = useState(false);

  const tierDetection: TierDetectionResult | null = useMemo(() => {
    if (!pricingData) return null;
    return detectPricingTiers(pricingData);
  }, [pricingData]);

  const hasMissingTiers = tierDetection !== null && tierDetection.missingTiers.length > 0;

  const handleFileParsed = useCallback(
    (data: PricingData, name: string) => {
      setPricingData(data);
      setFileName(name);
      setReadyWorkbook(null);
      setError(null);
      setAutofillWarning(null);
      setAutofillSuccess(null);
      setAutofillFailed(false);
      onParsed(data, name);
    },
    [onParsed],
  );

  /** Extract services from pricingData for the autofill API call. */
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
              properties: svc.properties ?? {},
              currentPricing: {
                monthly: String(svc.monthly ?? 0),
                upfront: String(svc.upfront ?? 0),
                twelve_months: String(svc.first12MonthsTotal ?? 0),
              },
            });
          }
        }
      }
    }
    return services;
  }

  /** Call the autofill API and merge results. */
  async function runAutofill(
    data: PricingData,
    detection: TierDetectionResult,
  ): Promise<PricingData | null> {
    const allServices = extractServices(data);
    const onlyRi = detection.missingTiers.every(
      (t) => t === "ri1Year" || t === "ri3Year",
    );
    const services = onlyRi
      ? allServices.filter((s) => isRiEligible(s.serviceName))
      : allServices;
    const skippedCount = allServices.length - services.length;

    setAutofillLoading(true);
    setAutofillWarning(null);
    setAutofillSuccess(null);

    if (services.length === 0) {
      setAutofillLoading(false);
      setAutofillSuccess(
        `All ${allServices.length} service(s) are pay-as-you-go only — no RI pricing to fill`,
      );
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

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Auto-fill request failed" }));
        throw new Error(body.error || `Auto-fill failed (${res.status})`);
      }

      const { data: autofillResponse } = (await res.json()) as {
        data: AutofillResponse;
      };
      const merged = mergePricingData(data, autofillResponse, detection.missingTiers);

      const returnedNames = new Set(
        autofillResponse.services.map((s) => s.service.toLowerCase().trim()),
      );
      const unfilled = services.filter(
        (s) => !returnedNames.has(s.serviceName.toLowerCase().trim()),
      );

      if (unfilled.length > 0 && unfilled.length < services.length) {
        setAutofillWarning(
          `${unfilled.length} service(s) could not be matched: ${unfilled.map((s) => s.serviceName).join(", ")}`,
        );
      }

      const filledCount = services.length - unfilled.length;
      const msg =
        skippedCount > 0
          ? `Auto-filled pricing for ${filledCount} service(s) (${skippedCount} pay-as-you-go skipped)`
          : `Auto-filled pricing for ${filledCount} service(s)`;
      setAutofillSuccess(msg);

      return merged;
    } catch (err) {
      setAutofillFailed(true);
      setAutofillWarning(
        err instanceof Error
          ? err.message
          : "Auto-fill failed. You can generate without auto-fill.",
      );
      return null;
    } finally {
      setAutofillLoading(false);
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

    try {
      let dataForExcel = pricingData;

      if (!skipAutofill && autofillEnabled && hasMissingTiers && tierDetection) {
        const merged = await runAutofill(pricingData, tierDetection);
        if (merged) {
          dataForExcel = merged;
        } else {
          setLoading(false);
          return;
        }
      }

      const xlsxName = fileName.replace(".json", ".xlsx");
      const workbook = await generateExcelReport(dataForExcel);

      setReadyWorkbook(workbook);
      setXlsxFileName(xlsxName);

      // Persist report summary to DB
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

      // Audit event (non-blocking)
      fetch("/api/audit", {
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
      fetch("/api/audit", {
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
      <FileUpload onParsed={handleFileParsed} />

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
              Detected:{" "}
              {tierDetection.presentTiers.map((t) => TIER_LABELS[t]).join(", ") || "None"}
            </span>
            {tierDetection.missingTiers.length > 0 && (
              <span className="text-blue-600 dark:text-blue-400">
                {" · "}Missing:{" "}
                {tierDetection.missingTiers.map((t) => TIER_LABELS[t]).join(", ")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Auto-fill toggle */}
      {hasMissingTiers && (
        <div className="flex items-center gap-2">
          <Switch
            id="autofill-toggle"
            checked={autofillEnabled}
            onCheckedChange={setAutofillEnabled}
            disabled={isProcessing}
          />
          <Label htmlFor="autofill-toggle" className="cursor-pointer text-sm">
            Auto-fill missing pricing tiers
          </Label>
        </div>
      )}

      {/* Generate button */}
      <Button
        onClick={() => handleGenerate(false)}
        disabled={!pricingData || isProcessing}
      >
        {loading && !autofillLoading ? "Generating..." : "Generate Report"}
      </Button>

      {/* AI progress animation during autofill */}
      {autofillLoading && pricingData && (
        <AutofillProgress serviceCount={pricingData.serviceCount} />
      )}

      {/* Autofill success message */}
      {autofillSuccess && !autofillWarning && (
        <p className="text-sm text-green-600 dark:text-green-400">
          {autofillSuccess}
        </p>
      )}

      {/* Autofill warning (partial or full failure) */}
      {autofillWarning && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-900 dark:bg-yellow-950">
          <HugeiconsIcon
            icon={Alert02Icon}
            strokeWidth={2}
            className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400"
          />
          <div className="flex-1 space-y-2">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {autofillWarning}
            </p>
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
            <HugeiconsIcon
              icon={CheckmarkCircle01Icon}
              strokeWidth={2}
              className="size-5 text-green-600 dark:text-green-400"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-green-800 dark:text-green-200">
              Report ready
            </p>
            <p className="truncate text-xs text-green-600 dark:text-green-400">
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
