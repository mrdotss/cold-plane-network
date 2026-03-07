import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeSummaryStats } from "@/components/sizing/SizingDashboard";

// Generator for a sizing report record
const reportArb = fc.record({
  id: fc.uuid(),
  fileName: fc.string({ minLength: 1, maxLength: 30 }),
  reportType: fc.constantFrom("report", "recommend", "full"),
  totalMonthly: fc.float({ min: 0, max: 100000, noNaN: true }),
  serviceCount: fc.integer({ min: 0, max: 200 }),
  region: fc.constantFrom("us-east-1", "eu-west-1", "ap-southeast-1", "us-west-2"),
  createdAt: fc
    .integer({
      min: new Date("2024-01-01").getTime(),
      max: new Date("2026-12-31").getTime(),
    })
    .map((ts) => new Date(ts).toISOString()),
});

describe("Property 10: Summary statistics computation correctness", () => {
  /**
   * **Validates: Requirements 5.5**
   * For any list of SizingReports, the computed summary statistics SHALL have:
   * - total count equal to the list length
   * - last estimate total equal to the most recent report's totalMonthly
   * - most used region equal to the region with the highest frequency
   */
  it("computes correct total count, last estimate, and most used region", () => {
    fc.assert(
      fc.property(
        fc.array(reportArb, { minLength: 1, maxLength: 50 }),
        (reports) => {
          const stats = computeSummaryStats(reports);

          // Total count
          expect(stats.totalCount).toBe(reports.length);

          // Last estimate: most recent report's totalMonthly
          const mostRecent = reports.reduce((latest, r) =>
            new Date(r.createdAt) > new Date(latest.createdAt) ? r : latest
          );
          expect(stats.lastEstimateTotal).toBeCloseTo(mostRecent.totalMonthly, 2);

          // Most used region: highest frequency
          const regionCounts: Record<string, number> = {};
          for (const r of reports) {
            if (r.region) {
              regionCounts[r.region] = (regionCounts[r.region] || 0) + 1;
            }
          }
          const maxCount = Math.max(...Object.values(regionCounts));
          const topRegions = Object.entries(regionCounts)
            .filter(([, c]) => c === maxCount)
            .map(([r]) => r);

          expect(topRegions).toContain(stats.mostUsedRegion);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("handles empty report list", () => {
    const stats = computeSummaryStats([]);
    expect(stats.totalCount).toBe(0);
    expect(stats.lastEstimateTotal).toBe(0);
    expect(stats.mostUsedRegion).toBe("—");
  });
});
