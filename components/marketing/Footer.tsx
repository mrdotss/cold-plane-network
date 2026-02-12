import { HugeiconsIcon } from "@hugeicons/react";
import { LayoutBottomIcon } from "@hugeicons/core-free-icons";

export function Footer() {
  return (
    <footer className="border-t py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center md:flex-row md:justify-between md:text-left">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-md">
            <HugeiconsIcon icon={LayoutBottomIcon} strokeWidth={2} className="size-3" />
          </div>
          <span>Cold Network Plane</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Built with Next.js &amp; React Flow. &copy; {new Date().getFullYear()} Cold Network Plane.
        </p>
      </div>
    </footer>
  );
}
