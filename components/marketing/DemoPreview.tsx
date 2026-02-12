export function DemoPreview() {
  return (
    <section id="demo" className="mx-auto max-w-6xl px-4 py-16">
      <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">
        Studio Preview
      </h2>
      <div className="overflow-hidden rounded-xl border bg-muted/30">
        {/* Static placeholder representing the 3-panel Studio layout */}
        <div className="grid grid-cols-[1fr_2fr_1fr] gap-px bg-border min-h-[320px]">
          {/* Spec Input panel */}
          <div className="bg-background p-4 flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Spec Input
            </span>
            <div className="flex-1 rounded-md bg-muted/50 p-3 font-mono text-xs text-muted-foreground leading-relaxed">
              <p>resources:</p>
              <p className="pl-3">- name: production-vpc</p>
              <p className="pl-5">type: vpc</p>
              <p className="pl-5">properties:</p>
              <p className="pl-7">cidr: 10.0.0.0/16</p>
              <p className="pl-3">- name: web-subnet</p>
              <p className="pl-5">type: subnet</p>
              <p className="pl-5">parent: production-vpc</p>
            </div>
          </div>

          {/* Topology Preview panel */}
          <div className="bg-background p-4 flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Live Topology
            </span>
            <div className="flex-1 flex items-center justify-center rounded-md bg-muted/30">
              {/* Stylized node-edge placeholder */}
              <svg viewBox="0 0 300 200" className="w-full max-w-xs text-muted-foreground/60" aria-label="Topology diagram placeholder">
                {/* VPC node */}
                <rect x="110" y="20" width="80" height="36" rx="8" className="fill-primary/10 stroke-primary" strokeWidth="1.5" />
                <text x="150" y="43" textAnchor="middle" className="fill-foreground text-[10px] font-medium">VPC</text>

                {/* Subnet node */}
                <rect x="50" y="120" width="80" height="36" rx="8" className="fill-primary/10 stroke-primary" strokeWidth="1.5" />
                <text x="90" y="143" textAnchor="middle" className="fill-foreground text-[10px] font-medium">Subnet</text>

                {/* Router node */}
                <rect x="170" y="120" width="80" height="36" rx="8" className="fill-primary/10 stroke-primary" strokeWidth="1.5" />
                <text x="210" y="143" textAnchor="middle" className="fill-foreground text-[10px] font-medium">Router</text>

                {/* Edges */}
                <line x1="150" y1="56" x2="90" y2="120" className="stroke-muted-foreground/40" strokeWidth="1.5" strokeDasharray="4 3" />
                <line x1="150" y1="56" x2="210" y2="120" className="stroke-muted-foreground/40" strokeWidth="1.5" />
              </svg>
            </div>
          </div>

          {/* Output panel */}
          <div className="bg-background p-4 flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Output
            </span>
            <div className="flex-1 rounded-md bg-muted/50 p-3 font-mono text-xs text-muted-foreground leading-relaxed">
              <p className="text-green-600 dark:text-green-400">✓ 0 errors, 0 warnings</p>
              <p className="mt-2">Generated files:</p>
              <p className="pl-3">main.tf</p>
              <p className="pl-3">variables.tf</p>
              <p className="pl-3">README.md</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
