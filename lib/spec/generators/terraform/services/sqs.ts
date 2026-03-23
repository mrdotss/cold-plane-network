import type { SpecResource } from "../../../schema";
import type { ResourceHclOutput } from "../types";
import { terraformName, mapProperties, tagsBlock, hclOutput } from "../hcl-utils";

const PROP_MAP: Record<string, string> = {
  delay: "delay_seconds",
  "delay-seconds": "delay_seconds",
  retention: "message_retention_seconds",
  "message-retention": "message_retention_seconds",
  "visibility-timeout": "visibility_timeout_seconds",
  fifo: "fifo_queue",
};

export function generateSqsHcl(resource: SpecResource): ResourceHclOutput {
  const name = terraformName(resource.name);
  const { mapped, unmapped } = mapProperties(resource, PROP_MAP);
  const isFifo = resource.properties["fifo"] === true;

  const lines = [`resource "aws_sqs_queue" "${name}" {`];
  lines.push(`  name = "${resource.name}${isFifo ? ".fifo" : ""}"`);
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
      hclOutput(`${name}_url`, `aws_sqs_queue.${name}.url`, `URL of SQS queue ${resource.name}`),
      hclOutput(`${name}_arn`, `aws_sqs_queue.${name}.arn`, `ARN of SQS queue ${resource.name}`),
    ],
  };
}
