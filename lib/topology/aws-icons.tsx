"use client";

/**
 * AWS Architecture Icons — official AWS icon set via aws-react-icons package.
 *
 * These are the OFFICIAL AWS Architecture Icons (SVG) with proper branding colors.
 * Each icon renders at `size` px with the official AWS service colors baked in.
 */

import type { ComponentType, SVGProps } from "react";

export interface AwsIconProps {
  size?: number;
  className?: string;
}

/* Import official AWS icons */
import _VpcIcon from "aws-react-icons/lib/icons/ArchitectureGroupVirtualprivatecloudVPC";
import _SubnetIcon from "aws-react-icons/lib/icons/ArchitectureGroupPrivatesubnet";
import _RouteTableIcon from "aws-react-icons/lib/icons/ResourceAmazonVPCFlowLogs";
import _SecurityGroupIcon from "aws-react-icons/lib/icons/ArchitectureServiceAWSNetworkFirewall";
import _NatGatewayIcon from "aws-react-icons/lib/icons/ResourceAmazonVPCNATGateway";
import _InternetGatewayIcon from "aws-react-icons/lib/icons/ResourceAmazonVPCInternetGateway";
import _VpnIcon from "aws-react-icons/lib/icons/ResourceAmazonVPCCustomerGateway";
import _PeeringIcon from "aws-react-icons/lib/icons/ResourceAmazonVPCElasticNetworkInterface";
import _EndpointIcon from "aws-react-icons/lib/icons/ResourceAmazonVPCEndpoints";
import _TransitGatewayIcon from "aws-react-icons/lib/icons/ArchitectureServiceAWSTransitGateway";
import _CloudFrontIcon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonCloudFront";
import _ApiGatewayIcon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonAPIGateway";
import _Route53Icon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonRoute53";
import _Ec2Icon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonEC2";
import _LambdaIcon from "aws-react-icons/lib/icons/ArchitectureServiceAWSLambda";
import _EcsIcon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonElasticContainerService";
import _FargateIcon from "aws-react-icons/lib/icons/ArchitectureServiceAWSFargate";
import _AutoScalingIcon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonEC2AutoScaling";
import _RdsIcon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonRDS";
import _DynamoDbIcon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonDynamoDB";
import _ElastiCacheIcon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonElastiCache";
import _AuroraIcon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonAurora";
import _S3Icon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonSimpleStorageService";
import _EfsIcon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonEFS";
import _EbsIcon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonElasticBlockStore";
import _AlbIcon from "aws-react-icons/lib/icons/ArchitectureServiceElasticLoadBalancing";
import _SqsIcon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonSimpleQueueService";
import _SnsIcon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonSimpleNotificationService";
import _EventBridgeIcon from "aws-react-icons/lib/icons/ArchitectureServiceAmazonEventBridge";
import _IamRoleIcon from "aws-react-icons/lib/icons/ArchitectureServiceAWSIAMIdentityCenter";
import _WafIcon from "aws-react-icons/lib/icons/ArchitectureServiceAWSWAF";
import _KmsIcon from "aws-react-icons/lib/icons/ArchitectureServiceAWSKeyManagementService";
import _GenericAwsIcon from "aws-react-icons/lib/icons/ArchitectureGroupAWSCloudlogo";
import _FirewallIcon from "aws-react-icons/lib/icons/ArchitectureServiceAWSNetworkFirewall";

/**
 * Wrapper that adapts an aws-react-icons component to our AwsIconProps interface.
 */
type AwsRawIcon = ComponentType<SVGProps<SVGElement> & { size?: number | string }>;

function wrap(Icon: AwsRawIcon): ComponentType<AwsIconProps> {
  const Wrapped = ({ size = 18, className }: AwsIconProps) => (
    <Icon size={size} className={className} />
  );
  Wrapped.displayName = (Icon as { displayName?: string }).displayName ?? "AwsIcon";
  return Wrapped;
}

/* ================================================================== */
/*  NETWORKING & CONTENT DELIVERY                                      */
/* ================================================================== */

export const VpcIcon = wrap(_VpcIcon);
export const SubnetIcon = wrap(_SubnetIcon);
export const RouteTableIcon = wrap(_RouteTableIcon);
export const SecurityGroupIcon = wrap(_SecurityGroupIcon);
export const NatGatewayIcon = wrap(_NatGatewayIcon);
export const InternetGatewayIcon = wrap(_InternetGatewayIcon);
export const VpnIcon = wrap(_VpnIcon);
export const PeeringIcon = wrap(_PeeringIcon);
export const EndpointIcon = wrap(_EndpointIcon);
export const TransitGatewayIcon = wrap(_TransitGatewayIcon);
export const CloudFrontIcon = wrap(_CloudFrontIcon);
export const ApiGatewayIcon = wrap(_ApiGatewayIcon);
export const Route53Icon = wrap(_Route53Icon);

/* ================================================================== */
/*  COMPUTE                                                            */
/* ================================================================== */

export const Ec2Icon = wrap(_Ec2Icon);
export const LambdaIcon = wrap(_LambdaIcon);
export const EcsIcon = wrap(_EcsIcon);
export const FargateIcon = wrap(_FargateIcon);
export const AutoScalingIcon = wrap(_AutoScalingIcon);

/* ================================================================== */
/*  DATABASE                                                           */
/* ================================================================== */

export const RdsIcon = wrap(_RdsIcon);
export const DynamoDbIcon = wrap(_DynamoDbIcon);
export const ElastiCacheIcon = wrap(_ElastiCacheIcon);
export const AuroraIcon = wrap(_AuroraIcon);

/* ================================================================== */
/*  STORAGE                                                            */
/* ================================================================== */

export const S3Icon = wrap(_S3Icon);
export const EfsIcon = wrap(_EfsIcon);
export const EbsIcon = wrap(_EbsIcon);

/* ================================================================== */
/*  LOAD BALANCING                                                     */
/* ================================================================== */

export const AlbIcon = wrap(_AlbIcon);
export const NlbIcon = wrap(_AlbIcon);
export const LoadbalancerIcon = wrap(_AlbIcon);

/* ================================================================== */
/*  APPLICATION INTEGRATION                                            */
/* ================================================================== */

export const SqsIcon = wrap(_SqsIcon);
export const SnsIcon = wrap(_SnsIcon);
export const EventBridgeIcon = wrap(_EventBridgeIcon);

/* ================================================================== */
/*  SECURITY & IDENTITY                                                */
/* ================================================================== */

export const IamRoleIcon = wrap(_IamRoleIcon);
export const WafIcon = wrap(_WafIcon);
export const KmsIcon = wrap(_KmsIcon);

/* ================================================================== */
/*  GENERAL / LEGACY / FALLBACK                                        */
/* ================================================================== */

export const GenericAwsIcon = wrap(_GenericAwsIcon);
export const ServerIcon = wrap(_Ec2Icon);
export const RouterIcon = wrap(_RouteTableIcon);
export const FirewallIcon = wrap(_FirewallIcon);
export const SwitchIcon = wrap(_PeeringIcon);
export const DnsIcon = wrap(_Route53Icon);
