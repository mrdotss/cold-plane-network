"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SecurityScoreCardProps {
  score: number;
  totalFindings: number;
  severityBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

function getScoreColor(score: number) {
  if (score >= 80) return { text: "text-green-500", strokeClass: "text-green-500" };
  if (score >= 60) return { text: "text-yellow-500", strokeClass: "text-yellow-500" };
  if (score >= 40) return { text: "text-orange-500", strokeClass: "text-orange-500" };
  return { text: "text-red-500", strokeClass: "text-red-500" };
}

function getScoreLabel(score: number) {
  if (score >= 80) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "Needs Attention";
  return "Critical";
}

export function SecurityScoreCard({
  score,
  totalFindings,
  severityBreakdown,
}: SecurityScoreCardProps) {
  const { text, strokeClass } = getScoreColor(score);

  // SVG gauge: 270-degree arc, gap at bottom
  const radius = 54;
  const strokeWidth = 10;
  const cx = 70;
  const cy = 66;
  const arcAngle = 270;
  const startAngle = 135;
  const circumference = (arcAngle / 360) * 2 * Math.PI * radius;
  const filledLength = (score / 100) * circumference;

  function polarToCartesian(angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(startAngle + arcAngle);
  const largeArc = arcAngle > 180 ? 1 : 0;
  const bgPath = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;

  return (
    <Card>
      <CardHeader className="pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Security Score
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          {/* Gauge — viewBox height 130 fits arc bottom (cy+r+stroke/2 = 66+54+5 = 125) */}
          <div className="relative shrink-0">
            <svg width="140" height="130" viewBox="0 0 140 130">
              {/* Background arc */}
              <path
                d={bgPath}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                className="text-muted/30"
              />
              {/* Filled arc — uses currentColor via Tailwind text color class */}
              <path
                d={bgPath}
                fill="none"
                stroke="currentColor"
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={circumference - filledLength}
                className={strokeClass}
              />
            </svg>
            {/* Score text centered in gauge */}
            <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: 14 }}>
              <span className={`text-3xl font-bold ${text}`}>{score}</span>
              <span className="text-[10px] text-muted-foreground font-medium">
                {getScoreLabel(score)}
              </span>
            </div>
          </div>

          {/* Severity breakdown */}
          <div className="flex-1 space-y-2">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Open Issues
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-red-500 dark:bg-red-400" />
              <span className="text-sm flex-1">Critical</span>
              <span className="text-sm font-bold">
                {severityBreakdown.critical}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-orange-500 dark:bg-orange-400" />
              <span className="text-sm flex-1">High</span>
              <span className="text-sm font-bold">
                {severityBreakdown.high}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-yellow-500 dark:bg-yellow-400" />
              <span className="text-sm flex-1">Medium</span>
              <span className="text-sm font-bold">
                {severityBreakdown.medium}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1 h-4 rounded-full bg-blue-500 dark:bg-blue-400" />
              <span className="text-sm flex-1">Low</span>
              <span className="text-sm font-bold">
                {severityBreakdown.low}
              </span>
            </div>
            <div className="pt-1 border-t mt-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-muted-foreground">Total</span>
                <span className="font-bold">{totalFindings}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
