import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Upload01Icon,
  AiInnovation01Icon,
  Download01Icon,
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
    icon: Upload01Icon,
    title: "Upload Pricing Data",
    description:
      "Upload your AWS Pricing Calculator JSON export. The parser extracts services, regions, and pricing tiers automatically.",
  },
  {
    number: 2,
    icon: AiInnovation01Icon,
    title: "Get AI Recommendations",
    description:
      "Our Azure AI agent analyzes your workload and recommends optimal instance types, savings plans, and architectural alternatives.",
  },
  {
    number: 3,
    icon: Download01Icon,
    title: "Download Excel Report",
    description:
      "Generate a detailed Excel report with On-Demand, 1-Year RI, and 3-Year RI comparisons — ready for stakeholders.",
  },
];

const highlights = [
  "AI-powered sizing recommendations",
  "On-Demand, RI, and Savings Plans comparison",
  "Excel reports with subtotals and grand totals",
  "Three modes: Report, Recommend, Full Analysis",
  "Graviton and serverless alternative suggestions",
];

export function Sizing() {
  return (
    <section id="sizing" className="py-16 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-2 text-center text-2xl font-semibold tracking-tight">
          AI-Powered Sizing
        </h2>
        <p className="mb-10 text-center text-sm text-muted-foreground max-w-lg mx-auto">
          Turn AWS Pricing Calculator exports into optimized sizing recommendations. Our AI agent analyzes workloads and suggests right-sized instances with cost breakdowns.
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

        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-base">Key Highlights</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 text-sm text-muted-foreground">
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
            <Link href="/dashboard/sizing">Try AI Sizing</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
