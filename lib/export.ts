import { Parser } from "json2csv";

export interface ExportResource {
  name: string;
  type: string;
  location: string | null;
  recommendations: {
    awsService: string;
    awsCategory: string;
    confidence: string;
    rationale: string;
    migrationNotes: string;
    alternatives: string;
  }[];
}

export interface ExportProject {
  name: string;
  customerName: string;
  notes: string;
  resources: ExportResource[];
}

export function generateMarkdownReport(project: ExportProject): string {
  const lines: string[] = [];

  lines.push(`# Migration Report: ${project.name}`);
  lines.push("");
  if (project.customerName) {
    lines.push(`**Customer:** ${project.customerName}`);
    lines.push("");
  }
  if (project.notes) {
    lines.push(`**Notes:** ${project.notes}`);
    lines.push("");
  }

  lines.push("## Summary");
  lines.push("");
  lines.push("| Azure Resource | Azure Type | Location | AWS Service | Category | Confidence |");
  lines.push("|---|---|---|---|---|---|");

  for (const resource of project.resources) {
    for (const rec of resource.recommendations) {
      const loc = resource.location || "—";
      lines.push(
        `| ${resource.name} | ${resource.type} | ${loc} | ${rec.awsService} | ${rec.awsCategory} | ${rec.confidence} |`
      );
    }
  }

  lines.push("");
  lines.push("## Resource Details");
  lines.push("");

  for (const resource of project.resources) {
    lines.push(`### ${resource.name}`);
    lines.push("");
    lines.push(`- **Azure Type:** ${resource.type}`);
    lines.push(`- **Location:** ${resource.location || "—"}`);
    lines.push("");

    for (const rec of resource.recommendations) {
      lines.push(`**AWS Service:** ${rec.awsService}`);
      lines.push(`- **Category:** ${rec.awsCategory}`);
      lines.push(`- **Confidence:** ${rec.confidence}`);
      lines.push(`- **Rationale:** ${rec.rationale}`);
      if (rec.migrationNotes) {
        lines.push(`- **Migration Notes:** ${rec.migrationNotes}`);
      }
      const alts = parseAlternatives(rec.alternatives);
      if (alts.length > 0) {
        lines.push(`- **Alternatives:** ${alts.join(", ")}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

export function generateCsvReport(project: ExportProject): string {
  const rows: Record<string, string>[] = [];

  for (const resource of project.resources) {
    for (const rec of resource.recommendations) {
      rows.push({
        "Azure Resource Name": resource.name,
        "Azure Type": resource.type,
        "Location": resource.location || "",
        "AWS Service": rec.awsService,
        "Category": rec.awsCategory,
        "Confidence": rec.confidence,
        "Rationale": rec.rationale,
        "Migration Notes": rec.migrationNotes,
        "Alternatives": parseAlternatives(rec.alternatives).join("; "),
      });
    }
  }

  const fields = [
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

  const parser = new Parser({ fields });
  return parser.parse(rows);
}

function parseAlternatives(alternatives: string): string[] {
  try {
    const parsed = JSON.parse(alternatives);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
