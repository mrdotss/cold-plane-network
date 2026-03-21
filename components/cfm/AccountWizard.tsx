"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Field, FieldError, FieldDescription } from "@/components/ui/field";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Tick02Icon,
  InformationCircleIcon,
  ArrowRight01Icon,
  ArrowLeft02Icon,
} from "@hugeicons/core-free-icons";
import {
  connectionDetailsSchema,
  analysisScopeSchema,
} from "@/lib/cfm/client-validators";
import type { TestConnectionResponse } from "@/lib/cfm/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const REGIONS = [
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-3", label: "Asia Pacific (Jakarta)" },
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "eu-west-1", label: "Europe (Ireland)" },
];

const SERVICES = [
  { value: "EC2", label: "EC2", defaultChecked: true },
  { value: "RDS", label: "RDS", defaultChecked: true },
  { value: "S3", label: "S3", defaultChecked: true },
  { value: "Lambda", label: "Lambda", defaultChecked: true },
  { value: "CloudWatch", label: "CloudWatch", defaultChecked: true },
  { value: "NAT Gateway", label: "NAT Gateway", defaultChecked: true },
  { value: "CloudTrail", label: "CloudTrail", defaultChecked: false },
  { value: "ECS", label: "ECS", defaultChecked: false },
];

const STEPS = ["Connection Details", "Analysis Scope", "Confirm & Connect"] as const;

// ─── Props ───────────────────────────────────────────────────────────────────

interface AccountWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccountCreated: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AccountWizard({ open, onOpenChange, onAccountCreated }: AccountWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);

  // Step 1 state
  const [accountName, setAccountName] = useState("");
  const [awsAccountId, setAwsAccountId] = useState("");
  const [roleArn, setRoleArn] = useState("");
  const [externalId, setExternalId] = useState("");
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});

  // Step 2 state
  const [selectedRegions, setSelectedRegions] = useState<string[]>(
    REGIONS.map((r) => r.value)
  );
  const [selectedServices, setSelectedServices] = useState<string[]>(
    SERVICES.filter((s) => s.defaultChecked).map((s) => s.value)
  );
  const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});

  // Step 3 state
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [testing, setTesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resetWizard = useCallback(() => {
    setStep(0);
    setAccountName("");
    setAwsAccountId("");
    setRoleArn("");
    setExternalId("");
    setStep1Errors({});
    setSelectedRegions(REGIONS.map((r) => r.value));
    setSelectedServices(SERVICES.filter((s) => s.defaultChecked).map((s) => s.value));
    setStep2Errors({});
    setTestResult(null);
    setTesting(false);
    setSubmitting(false);
    setSubmitError(null);
  }, []);


  const handleOpenChange = (value: boolean) => {
    if (!value) resetWizard();
    onOpenChange(value);
  };

  // ─── Step 1 Validation ──────────────────────────────────────────────────

  const validateStep1 = (): boolean => {
    const result = connectionDetailsSchema.safeParse({
      accountName,
      awsAccountId,
      roleArn,
      externalId: externalId || undefined,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (!errors[key]) errors[key] = issue.message;
      }
      setStep1Errors(errors);
      return false;
    }
    setStep1Errors({});
    return true;
  };

  // ─── Step 2 Validation ──────────────────────────────────────────────────

  const validateStep2 = (): boolean => {
    const result = analysisScopeSchema.safeParse({
      regions: selectedRegions,
      services: selectedServices,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (!errors[key]) errors[key] = issue.message;
      }
      setStep2Errors(errors);
      return false;
    }
    setStep2Errors({});
    return true;
  };

  // ─── Navigation ─────────────────────────────────────────────────────────

  const goNext = () => {
    if (step === 0 && !validateStep1()) return;
    if (step === 1 && !validateStep2()) return;
    setStep((s) => Math.min(s + 1, 2));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  // ─── Test Connection (standalone — does NOT create the account) ───────

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/cfm/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleArn,
          externalId: externalId || undefined,
        }),
      });
      const data: TestConnectionResponse = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ success: false, error: "Network error. Please try again." });
    } finally {
      setTesting(false);
    }
  };

  // ─── Confirm & Connect (creates the account) ───────────────────────────

  const handleConfirmAndConnect = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/cfm/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountName,
          awsAccountId,
          roleArn,
          externalId: externalId || undefined,
          regions: selectedRegions,
          services: selectedServices,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSubmitError(data.error || "Failed to create account");
        return;
      }

      const { account } = await res.json();

      // Start an initial scan for the newly connected account (Req 1.13)
      const scanRes = await fetch("/api/cfm/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id }),
      });

      onAccountCreated();
      handleOpenChange(false);

      // Navigate to scan progress page if scan was created
      if (scanRes.ok) {
        router.push(`/dashboard/cfm/${account.id}/scan`);
      }
    } catch {
      setSubmitError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Toggle helpers ─────────────────────────────────────────────────────

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  };

  const toggleService = (service: string) => {
    setSelectedServices((prev) =>
      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
    );
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg w-full overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Connect AWS Account</SheetTitle>
          <SheetDescription>
            Step {step + 1} of 3 — {STEPS[step]}
          </SheetDescription>
        </SheetHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-1 px-4">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-1 flex-1">
              <div
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-primary" : "bg-muted"
                }`}
              />
            </div>
          ))}
        </div>

        <div className="flex-1 px-4 pb-4 flex flex-col gap-4">
          {/* ─── Step 1: Connection Details ─────────────────────────── */}
          {step === 0 && (
            <div className="flex flex-col gap-3">
              <Field>
                <Label htmlFor="accountName">Account Name</Label>
                <Input
                  id="accountName"
                  placeholder="e.g. Production Account"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  aria-invalid={!!step1Errors.accountName}
                />
                {step1Errors.accountName && (
                  <FieldError>{step1Errors.accountName}</FieldError>
                )}
              </Field>

              <Field>
                <Label htmlFor="awsAccountId">AWS Account ID</Label>
                <Input
                  id="awsAccountId"
                  placeholder="123456789012"
                  value={awsAccountId}
                  onChange={(e) => setAwsAccountId(e.target.value)}
                  maxLength={12}
                  aria-invalid={!!step1Errors.awsAccountId}
                />
                {step1Errors.awsAccountId && (
                  <FieldError>{step1Errors.awsAccountId}</FieldError>
                )}
              </Field>

              <Field>
                <Label htmlFor="roleArn">Cross-Account Role ARN</Label>
                <Input
                  id="roleArn"
                  placeholder="arn:aws:iam::123456789012:role/CpnReadOnly"
                  value={roleArn}
                  onChange={(e) => setRoleArn(e.target.value)}
                  aria-invalid={!!step1Errors.roleArn}
                />
                {step1Errors.roleArn && (
                  <FieldError>{step1Errors.roleArn}</FieldError>
                )}
              </Field>

              <Field>
                <Label htmlFor="externalId">External ID (optional)</Label>
                <Input
                  id="externalId"
                  placeholder="Optional external ID"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                />
              </Field>

              {/* Inline help */}
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground flex gap-2">
                <HugeiconsIcon icon={InformationCircleIcon} strokeWidth={2} className="size-4 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-foreground">How to create the IAM role</span>
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>In the customer AWS account, create a new IAM role</li>
                    <li>Set trusted entity to &quot;Another AWS account&quot; and enter CPN&apos;s account ID</li>
                    <li>Attach <code className="bg-muted px-1 rounded">ReadOnlyAccess</code> and <code className="bg-muted px-1 rounded">ComputeOptimizerReadOnlyAccess</code> policies</li>
                    <li>Optionally set an External ID for additional security</li>
                    <li>Copy the Role ARN and paste it above</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {/* ─── Step 2: Analysis Scope ─────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label>Regions</Label>
                <FieldDescription>Select the AWS regions to analyze.</FieldDescription>
                <div className="flex flex-col gap-1.5">
                  {REGIONS.map((region) => (
                    <label
                      key={region.value}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Switch
                        size="sm"
                        checked={selectedRegions.includes(region.value)}
                        onCheckedChange={() => toggleRegion(region.value)}
                        aria-label={`Toggle ${region.label}`}
                      />
                      <span className="flex-1">{region.label}</span>
                      <code className="text-xs text-muted-foreground">{region.value}</code>
                    </label>
                  ))}
                </div>
                {step2Errors.regions && (
                  <FieldError>{step2Errors.regions}</FieldError>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Label>Services</Label>
                <FieldDescription>Select the AWS services to analyze for cost optimization.</FieldDescription>
                <div className="grid grid-cols-2 gap-1.5">
                  {SERVICES.map((service) => (
                    <label
                      key={service.value}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
                    >
                      <Switch
                        size="sm"
                        checked={selectedServices.includes(service.value)}
                        onCheckedChange={() => toggleService(service.value)}
                        aria-label={`Toggle ${service.label}`}
                      />
                      <span>{service.label}</span>
                    </label>
                  ))}
                </div>
                {step2Errors.services && (
                  <FieldError>{step2Errors.services}</FieldError>
                )}
              </div>
            </div>
          )}

          {/* ─── Step 3: Confirm & Connect ──────────────────────────── */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg border p-3 text-sm flex flex-col gap-2">
                <div className="font-medium">Connection Details</div>
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Account Name</span>
                  <span>{accountName}</span>
                  <span className="text-muted-foreground">AWS Account ID</span>
                  <span className="font-mono">{awsAccountId}</span>
                  <span className="text-muted-foreground">Role ARN</span>
                  <span className="font-mono break-all">{roleArn}</span>
                  {externalId && (
                    <>
                      <span className="text-muted-foreground">External ID</span>
                      <span>{externalId}</span>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-lg border p-3 text-sm flex flex-col gap-2">
                <div className="font-medium">Analysis Scope</div>
                <div className="flex flex-col gap-1.5 text-xs">
                  <div>
                    <span className="text-muted-foreground">Regions: </span>
                    <span className="flex flex-wrap gap-1 mt-1">
                      {selectedRegions.map((r) => (
                        <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                      ))}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Services: </span>
                    <span className="flex flex-wrap gap-1 mt-1">
                      {selectedServices.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Test Connection */}
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestConnection}
                  disabled={testing}
                >
                  {testing ? "Testing…" : "Test Connection"}
                </Button>
                {testResult && (
                  <div
                    className={`rounded-md px-3 py-2 text-xs ${
                      testResult.success
                        ? "bg-green-500/10 text-green-700 dark:text-green-400"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {testResult.success ? (
                      <span className="flex items-center gap-1.5">
                        <HugeiconsIcon icon={Tick02Icon} strokeWidth={2} className="size-3.5" />
                        Connection successful{testResult.accountAlias ? ` — ${testResult.accountAlias}` : ""}
                      </span>
                    ) : (
                      testResult.error
                    )}
                  </div>
                )}
              </div>

              {submitError && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {submitError}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between gap-2 border-t p-4">
          <Button
            variant="outline"
            size="sm"
            onClick={goBack}
            disabled={step === 0}
          >
            <HugeiconsIcon icon={ArrowLeft02Icon} data-icon="inline-start" strokeWidth={2} />
            Back
          </Button>
          <div className="flex gap-2">
            {step < 2 ? (
              <Button size="sm" onClick={goNext}>
                Next
                <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" strokeWidth={2} />
              </Button>
            ) : (
              <Button size="sm" onClick={handleConfirmAndConnect} disabled={submitting}>
                {submitting ? "Connecting…" : "Confirm & Connect"}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
