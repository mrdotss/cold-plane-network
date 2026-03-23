import type { SpecResource } from "../../../schema";
import type { ResourceHclOutput } from "../types";
import { terraformName, mapProperties, tagsBlock, hclVariable, hclOutput } from "../hcl-utils";

const PROP_MAP: Record<string, string> = {
  internal: "internal",
  "idle-timeout": "idle_timeout",
};

export function generateAlbHcl(resource: SpecResource): ResourceHclOutput {
  const name = terraformName(resource.name);
  const { mapped, unmapped } = mapProperties(resource, PROP_MAP);

  const lines = [`resource "aws_lb" "${name}" {`];
  lines.push(`  name               = "${resource.name}"`);
  if (!mapped.some((l) => l.includes("internal"))) {
    lines.push("  internal           = false");
  }
  lines.push('  load_balancer_type = "application"');
  lines.push("  security_groups    = var.security_group_ids");
  lines.push("  subnets            = var.subnet_ids");
  lines.push(...mapped);
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
      hclVariable("subnet_ids", "list(string)", "Subnet IDs for ALB"),
      hclVariable("security_group_ids", "list(string)", "Security group IDs for ALB", '[]'),
    ],
    outputBlocks: [
      hclOutput(`${name}_arn`, `aws_lb.${name}.arn`, `ARN of ALB ${resource.name}`),
      hclOutput(`${name}_dns_name`, `aws_lb.${name}.dns_name`, `DNS name of ALB ${resource.name}`),
    ],
  };
}
