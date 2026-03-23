import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  MapsIcon,
  File01Icon,
  Share03Icon,
  ShieldIcon,
  ArrowDataTransferHorizontalIcon,
  AiInnovation01Icon,
  AnalyticsUpIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

interface Feature {
  icon: IconSvgElement;
  title: string;
  description: string;
}

const features: Feature[] = [
  {
    icon: MapsIcon,
    title: "Live Topology Preview",
    description:
      "See your network topology update in real time as you edit your spec. Nodes and edges render instantly with auto-layout.",
  },
  {
    icon: File01Icon,
    title: "Artifact Generation",
    description:
      "Generate Terraform and config files directly from your spec. Download ready-to-deploy artifacts in one click.",
  },
  {
    icon: Share03Icon,
    title: "Share & Download",
    description:
      "Share your topology via a compressed URL or download a ZIP bundle of all generated artifacts.",
  },
  {
    icon: ShieldIcon,
    title: "Audit Trail",
    description:
      "Every action is logged. Review who did what and when with a searchable, filterable audit log.",
  },
  {
    icon: ArrowDataTransferHorizontalIcon,
    title: "Migration Advisor",
    description:
      "Import Azure resource inventories and get instant, catalog-driven AWS migration recommendations with confidence ratings.",
  },
  {
    icon: AiInnovation01Icon,
    title: "AI-Powered Sizing",
    description:
      "Upload AWS Pricing Calculator exports and get AI-driven sizing recommendations with RI and Savings Plans comparisons.",
  },
  {
    icon: AnalyticsUpIcon,
    title: "CFM Cost Analysis",
    description:
      "Connect AWS accounts via IAM roles and scan for cost optimization opportunities across EC2, RDS, S3, Lambda, and more.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-16">
      <div className="mb-10 text-center">
        <h2 className="mb-2 text-2xl font-semibold tracking-tight">
          Everything You Need for Cloud Operations
        </h2>
        <p className="mx-auto max-w-lg text-sm text-muted-foreground">
          A unified platform for network design, migration planning, workload sizing, and cloud financial management.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title} className="transition-shadow hover:shadow-md">
            <CardHeader>
              <div className="mb-1 flex size-9 items-center justify-center rounded-lg bg-muted">
                <HugeiconsIcon icon={f.icon} strokeWidth={2} className="size-5 text-foreground" />
              </div>
              <CardTitle>{f.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>{f.description}</CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
