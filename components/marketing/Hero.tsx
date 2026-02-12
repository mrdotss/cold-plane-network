import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-20 text-center md:py-28">
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
        Spec-First Network Topology Design
      </h1>
      <p className="max-w-2xl text-lg text-muted-foreground">
        Author a declarative spec, see a live topology diagram, and generate
        deployment artifacts — all from a single browser tab.
      </p>
      <div className="flex items-center gap-3">
        <Button asChild size="lg">
          <Link href="/dashboard/studio">Open Studio</Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <a href="#features">Learn More</a>
        </Button>
      </div>
    </section>
  );
}
