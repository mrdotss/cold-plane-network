import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  LinkSquare01Icon,
  AnalyticsUpIcon,
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
      "Add an AWS account via IAM role ARN with cross-account STS AssumeRole. Secure, read-only access to your resources.",
  },
  {
    number: 2,
    icon: AnalyticsUpIcon,
    title: "Scan for Savings",
    description:
      "Our AI agent runs 50+ CFM analysis tools across EC2, RDS, S3, Lambda, NAT Gateway, CloudWatch, ECS, and CloudTrail.",
  },
  {
    number: 3,
    icon: Comment01Icon,
    title: "Deep Dive with AI",
    description:
      "Drill into service-level findings, chat with an AI assistant scoped to your data, and get actionable implementation steps.",
  },
];

const supportedServices = [
  "EC2", "RDS", "S3", "Lambda", "NAT Gateway", "CloudWatch", "ECS", "CloudTrail",
];

const highlights = [
  "50+ CFM MCP analysis tools",
  "Real-time SSE progress streaming during scans",
  "Per-service deep dive with AI chat assistant",
  "Priority-based recommendations (Critical, Medium, Low)",
  "Estimated monthly savings per resource",
  "Commitment comparison (RI vs Savings Plans)",
];

export function CfmAnalysis() {
  return (
    <section id="cfm" className="py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-2 flex items-center justify-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <HugeiconsIcon icon={AnalyticsUpIcon} strokeWidth={2} className="size-4 text-foreground" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            CFM Cost Analysis
          </h2>
        </div>
        <p className="mb-10 mx-auto max-w-lg text-center text-sm text-muted-foreground">
          Connect your AWS accounts and let our AI-powered Cloud Financial Management engine
          scan for cost optimization opportunities across your entire infrastructure.
        </p>

        <div className="grid gap-8 md:grid-cols-3 mb-10">
          {workflowSteps.map((s) => (
            <div key={s.number} className="flex flex-col items-center text-center gap-3">
              <div className="relative flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <HugeiconsIcon icon={s.icon} strokeWidth={2} className="size-5" />
                <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold">
                  {s.number}
                </span>
              </div>
              <h3 className="text-base font-medium">{s.title}</h3>
              <p className="text-sm text-muted-foreground max-w-xs">{s.description}</p>
            </div>
          ))}
        </div>

        {/* Dashboard preview mockup */}
        <div className="mx-auto mb-10 max-w-3xl overflow-hidden rounded-xl border bg-muted/30">
          <div className="border-b bg-background px-4 py-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              CFM Dashboard Preview
            </span>
          </div>
          <div className="grid grid-cols-4 gap-px bg-border">
            {[
              { service: "EC2", savings: "$73", recs: 4 },
              { service: "RDS", savings: "$120", recs: 2 },
              { service: "S3", savings: "$15", recs: 3 },
              { service: "Lambda", savings: "$8", recs: 1 },
            ].map((item) => (
              <div key={item.service} className="bg-background p-4 text-center">
                <p className="text-lg font-bold text-foreground">{item.savings}</p>
                <p className="text-xs font-medium">{item.service}</p>
                <p className="text-xs text-muted-foreground">{item.recs} recommendations</p>
              </div>
            ))}
          </div>
        </div>

        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-base">Supported Services</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
              {supportedServices.map((svc) => (
                <li key={svc} className="flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-primary shrink-0" />
                  {svc}
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
            <Link href="/dashboard/cfm">Open CFM Dashboard</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
