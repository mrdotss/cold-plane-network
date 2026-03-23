import type { SpecResource } from "../../../schema";
import type { ResourceHclOutput } from "../types";
import { terraformName, mapProperties, tagsBlock, hclVariable, hclOutput } from "../hcl-utils";

const PROP_MAP: Record<string, string> = {
  ami: "ami",
  "instance-type": "instance_type",
  "instance_type": "instance_type",
  key: "key_name",
  "key-name": "key_name",
  monitoring: "monitoring",
  subnet: "subnet_id",
  "subnet-id": "subnet_id",
  "user-data": "user_data",
};

export function generateEc2Hcl(resource: SpecResource): ResourceHclOutput {
  const name = terraformName(resource.name);
  const { mapped, unmapped } = mapProperties(resource, PROP_MAP);

  const lines = [`resource "aws_instance" "${name}" {`];
  if (!mapped.some((l) => l.includes("ami"))) {
    lines.push('  ami           = "ami-0c55b159cbfafe1f0"');
  }
  if (!mapped.some((l) => l.includes("instance_type"))) {
    lines.push('  instance_type = "t3.micro"');
  }
  lines.push(...mapped);
  lines.push("");
  lines.push("  vpc_security_group_ids = var.security_group_ids");
  if (!mapped.some((l) => l.includes("subnet_id"))) {
    lines.push("  subnet_id              = var.subnet_id");
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
    variableBlocks: [
      hclVariable("subnet_id", "string", "Subnet ID for EC2 instances"),
      hclVariable("security_group_ids", "list(string)", "Security group IDs", '[]'),
    ],
    outputBlocks: [
      hclOutput(`${name}_id`, `aws_instance.${name}.id`, `Instance ID of ${resource.name}`),
      hclOutput(`${name}_public_ip`, `aws_instance.${name}.public_ip`, `Public IP of ${resource.name}`),
      hclOutput(`${name}_private_ip`, `aws_instance.${name}.private_ip`, `Private IP of ${resource.name}`),
    ],
  };
}
