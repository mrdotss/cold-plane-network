import type { SpecResource } from "../../../schema";
import type { ResourceHclOutput } from "../types";
import { terraformName, mapProperties, tagsBlock, hclVariable, hclOutput } from "../hcl-utils";

const PROP_MAP: Record<string, string> = {
  engine: "engine",
  "engine-version": "engine_version",
  "instance-class": "instance_class",
  "instance_class": "instance_class",
  storage: "allocated_storage",
  "allocated-storage": "allocated_storage",
  username: "username",
  "multi-az": "multi_az",
  backup: "backup_retention_period",
  "backup-retention": "backup_retention_period",
  "storage-type": "storage_type",
  "publicly-accessible": "publicly_accessible",
};

export function generateRdsHcl(resource: SpecResource): ResourceHclOutput {
  const name = terraformName(resource.name);
  const { mapped, unmapped } = mapProperties(resource, PROP_MAP);

  const lines = [`resource "aws_db_instance" "${name}" {`];
  lines.push(`  identifier = "${resource.name}"`);
  if (!mapped.some((l) => l.includes("engine"))) {
    lines.push('  engine     = "postgres"');
  }
  if (!mapped.some((l) => l.includes("instance_class"))) {
    lines.push('  instance_class    = "db.t3.micro"');
  }
  if (!mapped.some((l) => l.includes("allocated_storage"))) {
    lines.push("  allocated_storage = 20");
  }
  if (!mapped.some((l) => l.includes("username"))) {
    lines.push('  username = "dbadmin"');
  }
  lines.push("  manage_master_user_password = true");
  lines.push("  skip_final_snapshot         = true");
  lines.push(...mapped);
  lines.push("");
  lines.push("  vpc_security_group_ids = var.security_group_ids");
  if (unmapped.length > 0) {
    lines.push("");
    lines.push(...unmapped);
  }
  lines.push("");
  lines.push(tagsBlock(resource.name));
  lines.push("}");

  return {
    mainBlock: lines.join("\n"),
    variableBlocks: [
      hclVariable("security_group_ids", "list(string)", "Security group IDs for RDS", '[]'),
    ],
    outputBlocks: [
      hclOutput(`${name}_endpoint`, `aws_db_instance.${name}.endpoint`, `Endpoint of RDS ${resource.name}`),
      hclOutput(`${name}_arn`, `aws_db_instance.${name}.arn`, `ARN of RDS ${resource.name}`),
    ],
  };
}
