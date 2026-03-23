import type { SpecResource } from "../../../schema";
import type { ResourceHclOutput } from "../types";
import { terraformName, mapProperties, tagsBlock, hclOutput } from "../hcl-utils";

const PROP_MAP: Record<string, string> = {
  acl: "acl",
};

export function generateS3Hcl(resource: SpecResource): ResourceHclOutput {
  const name = terraformName(resource.name);
  const { mapped, unmapped } = mapProperties(resource, PROP_MAP);

  const bucketBlock = [
    `resource "aws_s3_bucket" "${name}" {`,
    `  bucket = "${resource.name}"`,
    ...mapped,
    unmapped.length > 0 ? "" : null,
    ...unmapped,
    "",
    tagsBlock(resource.name),
    "}",
  ]
    .filter((l) => l !== null)
    .join("\n");

  // Versioning block
  const hasVersioning = resource.properties["versioning"] !== false;
  const versioningBlock = hasVersioning
    ? [
        `resource "aws_s3_bucket_versioning" "${name}_versioning" {`,
        `  bucket = aws_s3_bucket.${name}.id`,
        "",
        "  versioning_configuration {",
        '    status = "Enabled"',
        "  }",
        "}",
      ].join("\n")
    : "";

  return {
    mainBlock: [bucketBlock, versioningBlock].filter(Boolean).join("\n\n"),
    variableBlocks: [],
    outputBlocks: [
      hclOutput(`${name}_id`, `aws_s3_bucket.${name}.id`, `ID of S3 bucket ${resource.name}`),
      hclOutput(`${name}_arn`, `aws_s3_bucket.${name}.arn`, `ARN of S3 bucket ${resource.name}`),
    ],
  };
}
