import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Upload01Icon,
  ArrowDataTransferHorizontalIcon,
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
    title: "Import Azure Inventory",
    description:
      "Paste JSON, upload a file, or manually enter Azure resources from your customer's environment.",
  },
  {
    number: 2,
    icon: ArrowDataTransferHorizontalIcon,
    title: "Run Mapping Engine",
    description:
      "Our deterministic catalog maps each Azure service to its AWS equivalent with confidence ratings and rationale.",
  },
  {
    number: 3,
    icon: Download01Icon,
    title: "Export Reports",
    description:
      "Review results in table or canvas view, then export Markdown or CSV reports for stakeholders.",
  },
];

const highlights = [
  "30+ Azure-to-AWS service mappings",
  "Confidence ratings (High, Medium, Low)",
  "Table and canvas visualization",
  "Markdown and CSV export",
  "No AI hallucinations — pure catalog-driven",
];

export function MigrationAdvisor() {
  return (
    <section id="migration" className="py-16">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-2 flex items-center justify-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-muted">
            <HugeiconsIcon icon={ArrowDataTransferHorizontalIcon} strokeWidth={2} className="size-4 text-foreground" />
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Migration Advisor
          </h2>
        </div>
        <p className="mb-10 text-center text-sm text-muted-foreground max-w-lg mx-auto">
          Turn Azure resource inventories into actionable AWS migration plans — no guesswork, no AI hallucinations. Pure catalog-driven recommendations.
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
            <Link href="/dashboard/migration">Try Migration Advisor</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
