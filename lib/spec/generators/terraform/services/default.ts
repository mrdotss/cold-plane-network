import type { SpecResource } from "../../../schema";
import type { ResourceHclOutput } from "../types";
import { terraformName, hclValue, tagsBlock } from "../hcl-utils";

/**
 * Legacy and unmapped resource type → Terraform resource type.
 */
const LEGACY_TYPE_MAP: Record<string, string> = {
  router: "aws_route_table",
  firewall: "aws_network_firewall_firewall",
  gateway: "aws_internet_gateway",
  nat: "aws_nat_gateway",
  routetable: "aws_route_table",
  vpn: "aws_vpn_gateway",
  peering: "aws_vpc_peering_connection",
  endpoint: "aws_vpc_endpoint",
  transitgateway: "aws_ec2_transit_gateway",
  apigateway: "aws_api_gateway_rest_api",
  route53: "aws_route53_zone",
  server: "aws_instance",
  switch: "aws_network_interface",
  fargate: "aws_ecs_task_definition",
  autoscaling: "aws_autoscaling_group",
  nlb: "aws_lb",
  loadbalancer: "aws_lb",
  elasticache: "aws_elasticache_cluster",
  aurora: "aws_rds_cluster",
  efs: "aws_efs_file_system",
  ebs: "aws_ebs_volume",
  eventbridge: "aws_cloudwatch_event_rule",
  "iam-role": "aws_iam_role",
  waf: "aws_wafv2_web_acl",
  kms: "aws_kms_key",
  dns: "aws_route53_zone",
};

/**
 * Fallback generator for resource types without a dedicated service generator.
 * Produces a basic resource block with tags and properties as comments.
 */
export function generateDefaultHcl(resource: SpecResource): ResourceHclOutput {
  const tfType = LEGACY_TYPE_MAP[resource.type.toLowerCase()];
  const name = terraformName(resource.name);

  if (!tfType) {
    return {
      mainBlock: `# Unsupported resource type: ${resource.type} (${resource.name})`,
      variableBlocks: [],
      outputBlocks: [],
    };
  }

  const lines = [`resource "${tfType}" "${name}" {`];

  // Properties as comments
  const props = resource.properties;
  if (Object.keys(props).length > 0) {
    lines.push("  # Properties from spec:");
    for (const [key, value] of Object.entries(props)) {
      lines.push(`  # ${key} = ${hclValue(value)}`);
    }
    lines.push("");
  }

  lines.push(tagsBlock(resource.name));
  lines.push("}");

  return {
    mainBlock: lines.join("\n"),
    variableBlocks: [],
    outputBlocks: [],
  };
}
