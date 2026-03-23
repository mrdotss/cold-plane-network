"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { AwsIconProps } from "./aws-icons";
import {
  VpcIcon,
  SubnetIcon,
  RouteTableIcon,
  SecurityGroupIcon,
  NatGatewayIcon,
  InternetGatewayIcon,
  VpnIcon,
  PeeringIcon,
  EndpointIcon,
  TransitGatewayIcon,
  CloudFrontIcon,
  ApiGatewayIcon,
  Route53Icon,
  Ec2Icon,
  LambdaIcon,
  EcsIcon,
  FargateIcon,
  AutoScalingIcon,
  RdsIcon,
  DynamoDbIcon,
  ElastiCacheIcon,
  AuroraIcon,
  S3Icon,
  EfsIcon,
  EbsIcon,
  AlbIcon,
  NlbIcon,
  LoadbalancerIcon,
  SqsIcon,
  SnsIcon,
  EventBridgeIcon,
  IamRoleIcon,
  WafIcon,
  KmsIcon,
  GenericAwsIcon,
  ServerIcon,
  RouterIcon,
  FirewallIcon,
  SwitchIcon,
  DnsIcon,
} from "./aws-icons";

/**
 * Map resource types to official AWS icons.
 * Icons have their own branded colors baked in (orange for EC2, green for S3, etc.)
 * so we use a clean neutral background for the node card.
 */
const RESOURCE_STYLE_MAP: Record<
  string,
  { Icon: React.ComponentType<AwsIconProps> }
> = {
  // Networking
  vpc: { Icon: VpcIcon },
  subnet: { Icon: SubnetIcon },
  routetable: { Icon: RouteTableIcon },
  securitygroup: { Icon: SecurityGroupIcon },
  nat: { Icon: NatGatewayIcon },
  gateway: { Icon: InternetGatewayIcon },
  vpn: { Icon: VpnIcon },
  peering: { Icon: PeeringIcon },
  endpoint: { Icon: EndpointIcon },
  transitgateway: { Icon: TransitGatewayIcon },
  cloudfront: { Icon: CloudFrontIcon },
  apigateway: { Icon: ApiGatewayIcon },
  route53: { Icon: Route53Icon },
  // Load Balancing
  alb: { Icon: AlbIcon },
  nlb: { Icon: NlbIcon },
  loadbalancer: { Icon: LoadbalancerIcon },
  // Compute
  ec2: { Icon: Ec2Icon },
  lambda: { Icon: LambdaIcon },
  ecs: { Icon: EcsIcon },
  fargate: { Icon: FargateIcon },
  autoscaling: { Icon: AutoScalingIcon },
  // Database
  rds: { Icon: RdsIcon },
  dynamodb: { Icon: DynamoDbIcon },
  elasticache: { Icon: ElastiCacheIcon },
  aurora: { Icon: AuroraIcon },
  // Storage
  s3: { Icon: S3Icon },
  efs: { Icon: EfsIcon },
  ebs: { Icon: EbsIcon },
  // Integration
  sqs: { Icon: SqsIcon },
  sns: { Icon: SnsIcon },
  eventbridge: { Icon: EventBridgeIcon },
  // Security
  "iam-role": { Icon: IamRoleIcon },
  waf: { Icon: WafIcon },
  kms: { Icon: KmsIcon },
  // General / Legacy
  server: { Icon: ServerIcon },
  router: { Icon: RouterIcon },
  firewall: { Icon: FirewallIcon },
  switch: { Icon: SwitchIcon },
  dns: { Icon: DnsIcon },
};

const DEFAULT_STYLE = {
  Icon: GenericAwsIcon,
};

/** Get visual style for a resource type. */
export function getResourceStyle(type: string) {
  return RESOURCE_STYLE_MAP[type.toLowerCase()] ?? DEFAULT_STYLE;
}

/** Data shape for custom topology nodes. */
export interface TopologyNodeData {
  label: string;
  resourceType: string;
  meta: Record<string, unknown>;
  [key: string]: unknown;
}

/** Custom React Flow node for topology resources. */
const TopologyNode = memo(function TopologyNode({
  data,
  selected,
}: NodeProps & { data: TopologyNodeData }) {
  const style = getResourceStyle(data.resourceType);

  return (
    <div
      className={`
        flex items-center gap-2 rounded-lg border px-3 py-2
        bg-background
        ${selected ? "ring-2 ring-blue-400 border-blue-400" : "border-neutral-200 dark:border-neutral-700"}
        shadow-sm transition-shadow hover:shadow-md
      `}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-neutral-400" />
      <div className="flex-shrink-0">
        <style.Icon size={24} />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-medium truncate text-neutral-900 dark:text-neutral-100">
          {data.label}
        </span>
        <span className="text-[10px] text-neutral-500 truncate">
          {data.resourceType}
        </span>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-neutral-400" />
    </div>
  );
});

/** Node types map for React Flow. */
export const topologyNodeTypes = {
  topology: TopologyNode,
} as const;

export { TopologyNode };
