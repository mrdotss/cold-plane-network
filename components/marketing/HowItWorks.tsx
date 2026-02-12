import { HugeiconsIcon } from "@hugeicons/react";
import {
  ComputerTerminalIcon,
  MapsIcon,
  Download01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

interface Step {
  number: number;
  icon: IconSvgElement;
  title: string;
  description: string;
}

const steps: Step[] = [
  {
    number: 1,
    icon: ComputerTerminalIcon,
    title: "Write Your Spec",
    description:
      "Use the code editor or structured form to define your network resources and connections.",
  },
  {
    number: 2,
    icon: MapsIcon,
    title: "See the Topology",
    description:
      "Watch the live node-edge diagram update as you type. Pan, zoom, and select resources interactively.",
  },
  {
    number: 3,
    icon: Download01Icon,
    title: "Generate & Download",
    description:
      "Generate Terraform and config files, then download a ZIP or share a link with your team.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-muted/40 py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="mb-10 text-center text-2xl font-semibold tracking-tight">
          How It Works
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          {steps.map((s) => (
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
      </div>
    </section>
  );
}
