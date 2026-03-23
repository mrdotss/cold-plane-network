import type { SpecResource } from "../../../schema";
import type { ResourceHclOutput } from "../types";
import { terraformName, mapProperties, tagsBlock, hclOutput } from "../hcl-utils";

const PROP_MAP: Record<string, string> = {
  "hash-key": "hash_key",
  "hash_key": "hash_key",
  "range-key": "range_key",
  "range_key": "range_key",
  billing: "billing_mode",
  "billing-mode": "billing_mode",
  "read-capacity": "read_capacity",
  "write-capacity": "write_capacity",
};

export function generateDynamoDbHcl(resource: SpecResource): ResourceHclOutput {
  const name = terraformName(resource.name);
  const { mapped, unmapped } = mapProperties(resource, PROP_MAP);

  const hashKey = (resource.properties["hash-key"] ?? resource.properties["hash_key"] ?? "id") as string;

  const lines = [`resource "aws_dynamodb_table" "${name}" {`];
  lines.push(`  name = "${resource.name}"`);
  if (!mapped.some((l) => l.includes("billing_mode"))) {
    lines.push('  billing_mode = "PAY_PER_REQUEST"');
  }
  if (!mapped.some((l) => l.includes("hash_key"))) {
    lines.push(`  hash_key = "${hashKey}"`);
  }
  lines.push(...mapped);
  lines.push("");
  lines.push("  attribute {");
  lines.push(`    name = "${hashKey}"`);
  lines.push('    type = "S"');
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
      hclOutput(`${name}_arn`, `aws_dynamodb_table.${name}.arn`, `ARN of DynamoDB table ${resource.name}`),
      hclOutput(`${name}_name`, `aws_dynamodb_table.${name}.name`, `Name of DynamoDB table ${resource.name}`),
    ],
  };
}
