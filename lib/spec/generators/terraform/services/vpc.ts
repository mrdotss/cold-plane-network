import type { SpecResource } from "../../../schema";
import type { ResourceHclOutput } from "../types";
import { terraformName, mapProperties, tagsBlock, hclVariable, hclOutput } from "../hcl-utils";

const PROP_MAP: Record<string, string> = {
  cidr: "cidr_block",
  "enable-dns": "enable_dns_support",
  "enable-dns-hostnames": "enable_dns_hostnames",
  tenancy: "instance_tenancy",
};

export function generateVpcHcl(resource: SpecResource): ResourceHclOutput {
  const name = terraformName(resource.name);
  const { mapped, unmapped } = mapProperties(resource, PROP_MAP);

  // Default CIDR if not specified
  const hasCidr = mapped.some((l) => l.includes("cidr_block"));
  const lines = [`resource "aws_vpc" "${name}" {`];
  if (!hasCidr) lines.push('  cidr_block = "10.0.0.0/16"');
  lines.push(...mapped);
  if (!mapped.some((l) => l.includes("enable_dns_support"))) {
    lines.push("  enable_dns_support   = true");
  }
  if (!mapped.some((l) => l.includes("enable_dns_hostnames"))) {
    lines.push("  enable_dns_hostnames = true");
  }
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
      hclOutput(`${name}_id`, `aws_vpc.${name}.id`, `ID of VPC ${resource.name}`),
      hclOutput(`${name}_cidr`, `aws_vpc.${name}.cidr_block`, `CIDR of VPC ${resource.name}`),
    ],
  };
}
