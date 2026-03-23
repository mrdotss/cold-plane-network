import type { SpecResource } from "../../../schema";
import type { ResourceHclOutput } from "../types";
import { terraformName, mapProperties, tagsBlock, hclVariable, hclOutput } from "../hcl-utils";

const PROP_MAP: Record<string, string> = {
  cidr: "cidr_block",
  az: "availability_zone",
  "availability-zone": "availability_zone",
  public: "map_public_ip_on_launch",
};

export function generateSubnetHcl(resource: SpecResource): ResourceHclOutput {
  const name = terraformName(resource.name);
  const { mapped, unmapped } = mapProperties(resource, PROP_MAP);

  const lines = [`resource "aws_subnet" "${name}" {`];
  lines.push("  vpc_id = var.vpc_id");
  const hasCidr = mapped.some((l) => l.includes("cidr_block"));
  if (!hasCidr) lines.push('  cidr_block = "10.0.1.0/24"');
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
      hclVariable("vpc_id", "string", "VPC ID for subnets"),
    ],
    outputBlocks: [
      hclOutput(`${name}_id`, `aws_subnet.${name}.id`, `ID of subnet ${resource.name}`),
    ],
  };
}
