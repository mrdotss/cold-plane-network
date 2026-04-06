import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  LinkSquare01Icon,
  SecurityCheckIcon,
  Comment01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

interface WorkflowStep {
  number: number;
  icon: IconSvgElement;
  title: string;
  description: string;
}

const workflowSteps: WorkflowStep[] = [
  {
    number: 1,
    icon: LinkSquare01Icon,
    title: "Connect AWS Account",
    description:
      "Use an existing connected AWS account or add a new one via IAM role ARN. The same read-only access used for CFM works for security scanning.",
  },
  {
    number: 2,
    icon: SecurityCheckIcon,
    title: "Scan Security Posture",
    description:
      "Our rule engine checks 20+ security controls across IAM, networking, S3, CloudTrail, VPC, and Access Analyzer using only free-tier AWS APIs.",
  },
  {
    number: 3,
    icon: Comment01Icon,
    title: "Review & Remediate",
    description:
      "Get detailed step-by-step remediation for every finding, drill into categories, and chat with an AI assistant for implementation guidance.",
  },
];

const securityCategories = [
  "Identity & Access (IAM)",
  "Network Security (VPC/SG)",
  "Data Protection (S3)",
  "Logging & Monitoring (CloudTrail)",
  "External Access (Access Analyzer)",
];

const highlights = [
  "20+ security rules mapped to CIS AWS Benchmarks",
  "Zero cost — uses only free-tier AWS APIs",
  "Exponential decay security scoring (0-100)",
  "Severity classification: Critical, High, Medium, Low",
  "Step-by-step console remediation instructions",
  "AI-powered remediation chat assistant",
  "Real-time SSE progress during scans",
  "Finding tracking across scan history",
];

export function CspAnalysis() {
  return (
    <section id="csp" className="py-16 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-2 flex items-center justify-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <HugeiconsIcon
              icon={SecurityCheckIcon}
              strokeWidth={2}
              className="size-4 text-foreground"
            />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            CSP Security Analysis
          </h2>
        </div>
        <p className="mb-10 mx-auto max-w-lg text-center text-sm text-muted-foreground">
          Scan your AWS accounts for security misconfigurations and get
          AI-powered remediation guidance — all using free-tier AWS APIs with
          zero additional cost.
        </p>

        <div className="grid gap-8 md:grid-cols-3 mb-10">
          {workflowSteps.map((s) => (
            <div
              key={s.number}
              className="flex flex-col items-center text-center gap-3"
            >
              <div className="relative flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <HugeiconsIcon
                  icon={s.icon}
                  strokeWidth={2}
                  className="size-5"
                />
                <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold">
                  {s.number}
                </span>
              </div>
              <h3 className="text-base font-medium">{s.title}</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                {s.description}
              </p>
            </div>
          ))}
        </div>

        {/* Security dashboard preview mockup */}
        <div className="mx-auto mb-10 max-w-3xl overflow-hidden rounded-xl border bg-muted/30">
          <div className="border-b bg-background px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              CSP Dashboard Preview
            </span>
          </div>
          <div className="bg-background p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Security Score
                </div>
                <div className="text-4xl font-bold text-green-600 dark:text-green-400">87</div>
                <div className="text-xs text-muted-foreground">/ 100</div>
              </div>
              <div className="grid grid-cols-4 gap-4 text-center">
                {[
                  {
                    severity: "Critical",
                    count: 0,
                    color: "text-red-500",
                    bg: "bg-red-100 dark:bg-red-950",
                  },
                  {
                    severity: "High",
                    count: 2,
                    color: "text-orange-500",
                    bg: "bg-orange-100 dark:bg-orange-950",
                  },
                  {
                    severity: "Medium",
                    count: 5,
                    color: "text-yellow-500",
                    bg: "bg-yellow-100 dark:bg-yellow-950",
                  },
                  {
                    severity: "Low",
                    count: 8,
                    color: "text-blue-500",
                    bg: "bg-blue-100 dark:bg-blue-950",
                  },
                ].map((item) => (
                  <div key={item.severity} className={`${item.bg} rounded-lg p-3`}>
                    <p className={`text-xl font-bold ${item.color}`}>
                      {item.count}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.severity}
                    </p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-muted">
              <div className="bg-orange-500" style={{ width: "13%" }} />
              <div className="bg-yellow-500" style={{ width: "34%" }} />
              <div className="bg-blue-400" style={{ width: "53%" }} />
            </div>
          </div>
        </div>

        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-base">
              Security Categories
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm text-muted-foreground">
              {securityCategories.map((cat) => (
                <li key={cat} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primary shrink-0" />
                  {cat}
                </li>
              ))}
            </ul>
            <ul className="mt-3 grid gap-2 text-sm text-muted-foreground border-t pt-3">
              {highlights.map((h) => (
                <li key={h} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primary shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Button asChild>
            <Link href="/dashboard/csp">Open CSP Dashboard</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
