import type { SpecResource } from "../../../schema";
import type { ResourceHclOutput } from "../types";
import { terraformName, mapProperties, tagsBlock, hclOutput } from "../hcl-utils";

const PROP_MAP: Record<string, string> = {
  "display-name": "display_name",
  "display_name": "display_name",
  fifo: "fifo_topic",
};

export function generateSnsHcl(resource: SpecResource): ResourceHclOutput {
  const name = terraformName(resource.name);
  const { mapped, unmapped } = mapProperties(resource, PROP_MAP);

  const lines = [`resource "aws_sns_topic" "${name}" {`];
  lines.push(`  name = "${resource.name}"`);
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
    variableBlocks: [],
    outputBlocks: [
      hclOutput(`${name}_arn`, `aws_sns_topic.${name}.arn`, `ARN of SNS topic ${resource.name}`),
    ],
  };
}
