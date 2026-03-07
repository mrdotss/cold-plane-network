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
      "Import Azure resource inventories and get instant, catalog-driven AWS migration recommendations with confidence ratings and exportable reports.",
  },
  {
    icon: AiInnovation01Icon,
    title: "AI-Powered Sizing",
    description:
      "Upload AWS Pricing Calculator exports and get AI-driven sizing recommendations with On-Demand, RI, and Savings Plans comparisons.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">
        Features
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title}>
            <CardHeader>
              <div className="bg-muted mb-1 flex size-9 items-center justify-center rounded-lg">
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
