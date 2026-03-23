import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CTABanner() {
  return (
    <section className="relative overflow-hidden bg-muted/40 py-20">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_110%,rgba(120,119,198,0.1),transparent)]" />
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 text-center">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Ready to optimize your cloud?
        </h2>
        <p className="max-w-lg text-muted-foreground">
          Design topologies, plan migrations, right-size workloads, and cut cloud costs — all from one platform.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/dashboard">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard/cfm">Try CFM Analysis</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
