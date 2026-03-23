import type { SpecResource } from "../../../schema";
import type { ResourceHclOutput } from "../types";
import { terraformName, mapProperties, tagsBlock, hclOutput } from "../hcl-utils";

const PROP_MAP: Record<string, string> = {
  "price-class": "price_class",
  "default-ttl": "default_ttl",
};

export function generateCloudFrontHcl(resource: SpecResource): ResourceHclOutput {
  const name = terraformName(resource.name);
  const { mapped, unmapped } = mapProperties(resource, PROP_MAP);
  const originDomain = (resource.properties["origin-domain"] ?? resource.properties["origin_domain"] ?? "example.com") as string;

  const lines = [`resource "aws_cloudfront_distribution" "${name}" {`];
  lines.push("  enabled         = true");
  lines.push(`  comment         = "${resource.name}"`);
  if (!mapped.some((l) => l.includes("price_class"))) {
    lines.push('  price_class     = "PriceClass_100"');
  }
  lines.push(...mapped);
  lines.push("");
  lines.push("  origin {");
  lines.push(`    domain_name = "${originDomain}"`);
  lines.push(`    origin_id   = "${resource.name}-origin"`);
  lines.push("");
  lines.push("    custom_origin_config {");
  lines.push("      http_port              = 80");
  lines.push("      https_port             = 443");
  lines.push('      origin_protocol_policy = "https-only"');
  lines.push('      origin_ssl_protocols   = ["TLSv1.2"]');
  lines.push("    }");
  lines.push("  }");
  lines.push("");
  lines.push("  default_cache_behavior {");
  lines.push('    allowed_methods  = ["GET", "HEAD"]');
  lines.push('    cached_methods   = ["GET", "HEAD"]');
  lines.push(`    target_origin_id = "${resource.name}-origin"`);
  lines.push('    viewer_protocol_policy = "redirect-to-https"');
  lines.push("");
  lines.push("    forwarded_values {");
  lines.push("      query_string = false");
  lines.push("      cookies {");
  lines.push('        forward = "none"');
  lines.push("      }");
  lines.push("    }");
  lines.push("  }");
  lines.push("");
  lines.push("  restrictions {");
  lines.push("    geo_restriction {");
  lines.push('      restriction_type = "none"');
  lines.push("    }");
  lines.push("  }");
  lines.push("");
  lines.push("  viewer_certificate {");
  lines.push("    cloudfront_default_certificate = true");
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
      hclOutput(`${name}_id`, `aws_cloudfront_distribution.${name}.id`, `ID of CloudFront ${resource.name}`),
      hclOutput(`${name}_domain`, `aws_cloudfront_distribution.${name}.domain_name`, `Domain of CloudFront ${resource.name}`),
    ],
  };
}
