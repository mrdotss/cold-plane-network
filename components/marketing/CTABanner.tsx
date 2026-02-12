import Link from "next/link";
import { Button } from "@/components/ui/button";

export function CTABanner() {
  return (
    <section className="bg-muted/40 py-16">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Ready to design your network?
        </h2>
        <p className="text-muted-foreground">
          Jump into the Studio and start building your topology in minutes.
        </p>
        <Button asChild size="lg">
          <Link href="/dashboard/studio">Start Designing</Link>
        </Button>
      </div>
    </section>
  );
}
