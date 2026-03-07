import Link from "next/link";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { LayoutBottomIcon } from "@hugeicons/core-free-icons";

export function Navbar() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-medium">
          <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
            <HugeiconsIcon icon={LayoutBottomIcon} strokeWidth={2} className="size-4" />
          </div>
          <span className="text-sm font-semibold">Cold Network Plane</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            How It Works
          </a>
          <a href="#demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Demo
          </a>
          <a href="#migration" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Migration
          </a>
          <a href="#sizing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Sizing
          </a>
        </div>

        <Button asChild size="sm">
          <Link href="/dashboard/studio">Open Studio</Link>
        </Button>
      </div>
    </nav>
  );
}
