import type { SpecResource } from "../../../schema";
import type { ResourceHclOutput } from "../types";
import { terraformName, mapProperties, tagsBlock, hclVariable, hclOutput } from "../hcl-utils";

const PROP_MAP: Record<string, string> = {
  description: "description",
};

export function generateSecurityGroupHcl(resource: SpecResource): ResourceHclOutput {
  const name = terraformName(resource.name);
  const { mapped, unmapped } = mapProperties(resource, PROP_MAP);

  const ingressPort = resource.properties["ingress-port"] ?? resource.properties["ingress_port"];
  const ingressCidr = resource.properties["ingress-cidr"] ?? resource.properties["ingress_cidr"] ?? "0.0.0.0/0";

  const lines = [`resource "aws_security_group" "${name}" {`];
  lines.push(`  name   = "${resource.name}"`);
  lines.push("  vpc_id = var.vpc_id");
  if (!mapped.some((l) => l.includes("description"))) {
    lines.push(`  description = "Security group for ${resource.name}"`);
  }
  lines.push(...mapped);
  lines.push("");

  // Ingress rule
  if (ingressPort) {
    lines.push("  ingress {");
    lines.push(`    from_port   = ${ingressPort}`);
    lines.push(`    to_port     = ${ingressPort}`);
    lines.push('    protocol    = "tcp"');
    lines.push(`    cidr_blocks = ["${ingressCidr}"]`);
    lines.push("  }");
  } else {
    lines.push("  ingress {");
    lines.push("    from_port   = 443");
    lines.push("    to_port     = 443");
    lines.push('    protocol    = "tcp"');
    lines.push('    cidr_blocks = ["0.0.0.0/0"]');
    lines.push("  }");
  }
  lines.push("");

  // Egress rule (allow all outbound)
  lines.push("  egress {");
  lines.push("    from_port   = 0");
  lines.push("    to_port     = 0");
  lines.push('    protocol    = "-1"');
  lines.push('    cidr_blocks = ["0.0.0.0/0"]');
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
    variableBlocks: [
      hclVariable("vpc_id", "string", "VPC ID for security groups"),
    ],
    outputBlocks: [
      hclOutput(`${name}_id`, `aws_security_group.${name}.id`, `ID of security group ${resource.name}`),
    ],
  };
}
