import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { LayoutBottomIcon } from "@hugeicons/core-free-icons";

const productLinks = [
  { href: "/dashboard/studio", label: "Topology Studio" },
  { href: "/dashboard/migration", label: "Migration Advisor" },
  { href: "/dashboard/sizing", label: "AI Sizing" },
  { href: "/dashboard/cfm", label: "CFM Analysis" },
];

const resourceLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "/dashboard/audit", label: "Audit Log" },
];

export function Footer() {
  return (
    <footer className="border-t py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 text-sm font-medium mb-2">
              <div className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded-md">
                <HugeiconsIcon icon={LayoutBottomIcon} strokeWidth={2} className="size-3" />
              </div>
              <span>Cold Network Plane</span>
            </div>
            <p className="text-xs text-muted-foreground max-w-sm">
              An internal presales tool for cloud infrastructure design, migration planning, workload sizing, and cost optimization.
            </p>
          </div>

          {/* Product links */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Product
            </h4>
            <ul className="grid gap-1.5">
              {productLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Resources
            </h4>
            <ul className="grid gap-1.5">
              {resourceLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-center">
          <p className="text-xs text-muted-foreground">
            Built with Next.js, Azure AI Foundry, Drizzle ORM &amp; React Flow. &copy; {new Date().getFullYear()} Cold Network Plane.
          </p>
        </div>
      </div>
    </footer>
  );
}
