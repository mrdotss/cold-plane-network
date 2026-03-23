import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon } from "@hugeicons/core-free-icons";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle gradient background */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(120,119,198,0.12),transparent)]" />

      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center md:py-28">
        {/* Badge pill */}
        <div className="flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
          <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} className="size-3.5" />
          <span>AI-Powered Cloud Infrastructure Platform</span>
        </div>

        <h1 className="max-w-4xl text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
          Design, Migrate &{" "}
          <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-violet-400">
            Optimize
          </span>{" "}
          Your Cloud
        </h1>

        <p className="max-w-2xl text-lg text-muted-foreground">
          From network topology design to Azure-to-AWS migration planning, AI-powered workload sizing,
          and automated cost optimization — everything your cloud team needs in one platform.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/dashboard">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <a href="#features">Explore Features</a>
          </Button>
        </div>

        {/* Stats row */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-foreground">4</span>
            <span>Core Modules</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-foreground">50+</span>
            <span>CFM Scan Tools</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-foreground">30+</span>
            <span>Service Mappings</span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-foreground">AI</span>
            <span>Powered Analysis</span>
          </div>
        </div>
      </div>
    </section>
  );
}
