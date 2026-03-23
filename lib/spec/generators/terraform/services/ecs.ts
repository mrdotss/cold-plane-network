import type { SpecResource } from "../../../schema";
import type { ResourceHclOutput } from "../types";
import { terraformName, mapProperties, tagsBlock, hclOutput } from "../hcl-utils";

const PROP_MAP: Record<string, string> = {
  "capacity-providers": "capacity_providers",
};

export function generateEcsHcl(resource: SpecResource): ResourceHclOutput {
  const name = terraformName(resource.name);
  const { mapped, unmapped } = mapProperties(resource, PROP_MAP);

  const lines = [`resource "aws_ecs_cluster" "${name}" {`];
  lines.push(`  name = "${resource.name}"`);
  lines.push(...mapped);
  lines.push("");
  lines.push("  setting {");
  lines.push('    name  = "containerInsights"');
  lines.push('    value = "enabled"');
  lines.push("  }");
  if (unmapped.length > 0) {
    lines.push("");
    lines.push(...unmapped);
  }
  lines.push("");
  lines.push(tagsBlock(resource.name));
  lines.push("}");

  return {
    mainBlock: lines.join("\n"),
    variableBlocks: [],
    outputBlocks: [
      hclOutput(`${name}_arn`, `aws_ecs_cluster.${name}.arn`, `ARN of ECS cluster ${resource.name}`),
      hclOutput(`${name}_name`, `aws_ecs_cluster.${name}.name`, `Name of ECS cluster ${resource.name}`),
    ],
  };
}
