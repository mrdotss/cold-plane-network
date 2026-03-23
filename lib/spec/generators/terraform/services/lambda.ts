import type { SpecResource } from "../../../schema";
import type { ResourceHclOutput } from "../types";
import { terraformName, mapProperties, tagsBlock, hclOutput } from "../hcl-utils";

const PROP_MAP: Record<string, string> = {
  runtime: "runtime",
  handler: "handler",
  memory: "memory_size",
  "memory-size": "memory_size",
  timeout: "timeout",
  description: "description",
  "environment": "environment",
};

export function generateLambdaHcl(resource: SpecResource): ResourceHclOutput {
  const name = terraformName(resource.name);
  const { mapped, unmapped } = mapProperties(resource, PROP_MAP);

  // IAM role for Lambda
  const roleBlock = [
    `resource "aws_iam_role" "${name}_role" {`,
    `  name = "${resource.name}-role"`,
    "",
    "  assume_role_policy = jsonencode({",
    '    Version = "2012-10-17"',
    "    Statement = [{",
    '      Action = "sts:AssumeRole"',
    '      Effect = "Allow"',
    "      Principal = {",
    '        Service = "lambda.amazonaws.com"',
    "      }",
    "    }]",
    "  })",
    "",
    tagsBlock(`${resource.name}-role`),
    "}",
  ].join("\n");

  const lines = [`resource "aws_lambda_function" "${name}" {`];
  lines.push(`  function_name = "${resource.name}"`);
  lines.push(`  role          = aws_iam_role.${name}_role.arn`);
  if (!mapped.some((l) => l.includes("runtime"))) {
    lines.push('  runtime       = "nodejs20.x"');
  }
  if (!mapped.some((l) => l.includes("handler"))) {
    lines.push('  handler       = "index.handler"');
  }
  if (!mapped.some((l) => l.includes("memory_size"))) {
    lines.push("  memory_size   = 128");
  }
  if (!mapped.some((l) => l.includes("timeout"))) {
    lines.push("  timeout       = 30");
  }
  lines.push('  filename      = "lambda.zip"');
  lines.push(...mapped);
  if (unmapped.length > 0) {
    lines.push("");
    lines.push(...unmapped);
  }
  lines.push("");
  lines.push(tagsBlock(resource.name));
  lines.push("}");

  return {
    mainBlock: roleBlock + "\n\n" + lines.join("\n"),
    variableBlocks: [],
    outputBlocks: [
      hclOutput(`${name}_arn`, `aws_lambda_function.${name}.arn`, `ARN of Lambda ${resource.name}`),
      hclOutput(`${name}_function_name`, `aws_lambda_function.${name}.function_name`, `Name of Lambda ${resource.name}`),
    ],
  };
}
