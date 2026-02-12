import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { generateMarkdownReport, generateCsvReport, type ExportProject } from "@/lib/export";

// Generator for a recommendation
const recommendationArb = fc.record({
  awsService: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes("|") && !s.includes("\n")),
  awsCategory: fc.constantFrom("Compute", "Storage", "Networking", "Database"),
  confidence: fc.constantFrom("High", "Medium", "Low", "None"),
  rationale: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => !s.includes("|") && !s.includes("\n")),
  migrationNotes: fc.string({ maxLength: 50 }).filter((s) => !s.includes("|") && !s.includes("\n")),
  alternatives: fc.constant("[]"), // JSON string
});

// Generator for a resource with recommendations
const resourceArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes("|") && !s.includes("\n")),
  type: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !s.includes("|") && !s.includes("\n")),
  location: fc.option(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes("|") && !s.includes("\n")),
    { nil: null }
  ),
  recommendations: fc.array(recommendationArb, { minLength: 1, maxLength: 2 }),
});

// Generator for a project
const projectArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes("\n")),
  customerName: fc.string({ maxLength: 20 }).filter((s) => !s.includes("\n")),
  notes: fc.string({ maxLength: 30 }).filter((s) => !s.includes("\n")),
  resources: fc.array(resourceArb, { minLength: 1, maxLength: 3 }),
});

describe("Property 9: Markdown export contains all resource data", () => {
  /**
   * **Validates: Requirements 6.1**
   * generateMarkdownReport contains every resource name, AWS service, confidence, rationale,
   * and non-empty migration notes.
   */
  it("markdown contains all resource and recommendation data", () => {
    fc.assert(
      fc.property(projectArb, (project) => {
        const md = generateMarkdownReport(project as ExportProject);

        for (const resource of project.resources) {
          expect(md).toContain(resource.name);
          for (const rec of resource.recommendations) {
            expect(md).toContain(rec.awsService);
            expect(md).toContain(rec.confidence);
            expect(md).toContain(rec.rationale);
            if (rec.migrationNotes) {
              expect(md).toContain(rec.migrationNotes);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });
});

describe("Property 10: CSV export contains all required columns and data", () => {
  /**
   * **Validates: Requirements 6.2**
   * generateCsvReport contains all required column headers and one data row per recommendation.
   */
  it("csv contains required headers and correct row count", () => {
    fc.assert(
      fc.property(projectArb, (project) => {
        const csv = generateCsvReport(project as ExportProject);

        // Check required column headers
        const requiredColumns = [
          "Azure Resource Name",
          "Azure Type",
          "Location",
          "AWS Service",
          "Category",
          "Confidence",
          "Rationale",
          "Migration Notes",
          "Alternatives",
        ];
        for (const col of requiredColumns) {
          expect(csv).toContain(col);
        }

        // Count expected data rows (one per recommendation)
        let expectedRows = 0;
        for (const r of project.resources) {
          expectedRows += r.recommendations.length;
        }

        // CSV lines: 1 header + expectedRows data rows
        const lines = csv.trim().split("\n");
        expect(lines.length).toBe(1 + expectedRows);
      }),
      { numRuns: 100 }
    );
  });
});
