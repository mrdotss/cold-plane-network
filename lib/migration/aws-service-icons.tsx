"use client";

/**
 * Maps AWS service names (from the mapping catalog) to official AWS Architecture Icons.
 * Used in the Migration Advisor Canvas View.
 */

import type { ComponentType, SVGProps } from "react";

/* ─── Icon imports ─── */
import _Ec2 from "aws-react-icons/lib/icons/ArchitectureServiceAmazonEC2";
import _Ec2AutoScaling from "aws-react-icons/lib/icons/ArchitectureServiceAmazonEC2AutoScaling";
import _Lambda from "aws-react-icons/lib/icons/ArchitectureServiceAWSLambda";
import _S3 from "aws-react-icons/lib/icons/ArchitectureServiceAmazonSimpleStorageService";
import _Ebs from "aws-react-icons/lib/icons/ArchitectureServiceAmazonElasticBlockStore";
import _Efs from "aws-react-icons/lib/icons/ArchitectureServiceAmazonEFS";
import _Rds from "aws-react-icons/lib/icons/ArchitectureServiceAmazonRDS";
import _DynamoDB from "aws-react-icons/lib/icons/ArchitectureServiceAmazonDynamoDB";
import _Aurora from "aws-react-icons/lib/icons/ArchitectureServiceAmazonAurora";
import _ElastiCache from "aws-react-icons/lib/icons/ArchitectureServiceAmazonElastiCache";
import _VPC from "aws-react-icons/lib/icons/ArchitectureServiceAmazonVirtualPrivateCloud";
import _ELB from "aws-react-icons/lib/icons/ArchitectureServiceElasticLoadBalancing";
import _CloudFront from "aws-react-icons/lib/icons/ArchitectureServiceAmazonCloudFront";
import _Route53 from "aws-react-icons/lib/icons/ArchitectureServiceAmazonRoute53";
import _ApiGateway from "aws-react-icons/lib/icons/ArchitectureServiceAmazonAPIGateway";
import _DirectConnect from "aws-react-icons/lib/icons/ArchitectureServiceAWSDirectConnect";
import _NetworkFirewall from "aws-react-icons/lib/icons/ArchitectureServiceAWSNetworkFirewall";
import _WAF from "aws-react-icons/lib/icons/ArchitectureServiceAWSWAF";
import _ECS from "aws-react-icons/lib/icons/ArchitectureServiceAmazonElasticContainerService";
import _EKS from "aws-react-icons/lib/icons/ArchitectureServiceAmazonElasticKubernetesService";
import _ECR from "aws-react-icons/lib/icons/ArchitectureServiceAmazonElasticContainerRegistry";
import _Fargate from "aws-react-icons/lib/icons/ArchitectureServiceAWSFargate";
import _SQS from "aws-react-icons/lib/icons/ArchitectureServiceAmazonSimpleQueueService";
import _SNS from "aws-react-icons/lib/icons/ArchitectureServiceAmazonSimpleNotificationService";
import _EventBridge from "aws-react-icons/lib/icons/ArchitectureServiceAmazonEventBridge";
import _StepFunctions from "aws-react-icons/lib/icons/ArchitectureServiceAWSStepFunctions";
import _CloudWatch from "aws-react-icons/lib/icons/ArchitectureServiceAmazonCloudWatch";
import _CloudTrail from "aws-react-icons/lib/icons/ArchitectureServiceAWSCloudTrail";
import _XRay from "aws-react-icons/lib/icons/ArchitectureServiceAWSDistroforOpenTelemetry";
import _IAM from "aws-react-icons/lib/icons/ArchitectureServiceAWSIAMIdentityCenter";
import _SecretsManager from "aws-react-icons/lib/icons/ArchitectureServiceAWSSecretsManager";
import _KMS from "aws-react-icons/lib/icons/ArchitectureServiceAWSKeyManagementService";
import _SecurityHub from "aws-react-icons/lib/icons/ArchitectureServiceAWSSecurityHub";
import _CertificateManager from "aws-react-icons/lib/icons/ArchitectureServiceAWSCertificateManager";
import _SystemsManager from "aws-react-icons/lib/icons/ArchitectureServiceAWSSystemsManager";
import _Backup from "aws-react-icons/lib/icons/ArchitectureServiceAWSBackup";
import _CostExplorer from "aws-react-icons/lib/icons/ArchitectureServiceAWSCostExplorer";
import _TrustedAdvisor from "aws-react-icons/lib/icons/ArchitectureServiceAWSTrustedAdvisor";
import _AppRunner from "aws-react-icons/lib/icons/ArchitectureServiceAWSAppRunner";
import _Amplify from "aws-react-icons/lib/icons/ArchitectureServiceAWSAmplify";
import _AppSync from "aws-react-icons/lib/icons/ArchitectureServiceAWSAppSync";
import _Pinpoint from "aws-react-icons/lib/icons/ArchitectureServiceAmazonPinpoint";
import _Bedrock from "aws-react-icons/lib/icons/ArchitectureServiceAmazonBedrock";
import _SageMaker from "aws-react-icons/lib/icons/ArchitectureServiceAmazonSageMaker";
import _Kinesis from "aws-react-icons/lib/icons/ArchitectureServiceAmazonEventBridge"; // closest match
import _OpenSearch from "aws-react-icons/lib/icons/ArchitectureServiceAmazonOpenSearchService";
import _ResourceGroups from "aws-react-icons/lib/icons/ArchitectureGroupAWSAccount";
import _GenericAws from "aws-react-icons/lib/icons/ArchitectureGroupAWSCloudlogo";

type RawIcon = ComponentType<SVGProps<SVGElement> & { size?: number | string }>;

/**
 * Map of AWS service display names → official AWS icon component.
 * Keys must match the `awsService` field in the mapping catalog.
 */
const SERVICE_ICON_MAP: Record<string, RawIcon> = {
  // Compute
  "Amazon EC2": _Ec2,
  "EC2 Auto Scaling": _Ec2AutoScaling,
  "EC2 Launch Template": _Ec2,
  "AWS Lambda": _Lambda,
  "AWS App Runner": _AppRunner,
  "AWS Batch": _Lambda,
  "ECS on Fargate": _Fargate,

  // Containers
  "Amazon ECS": _ECS,
  "Amazon EKS": _EKS,
  "Amazon ECR": _ECR,
  "AWS Fargate": _Fargate,

  // Storage
  "Amazon S3": _S3,
  "Amazon EBS": _Ebs,
  "EBS Snapshots": _Ebs,
  "Amazon EFS": _Efs,
  "Amazon FSx": _Efs,

  // Database
  "Amazon RDS": _Rds,
  "Amazon RDS for SQL Server": _Rds,
  "Amazon RDS for PostgreSQL": _Rds,
  "Amazon RDS for MySQL": _Rds,
  "Amazon RDS for MariaDB": _Rds,
  "Amazon DynamoDB": _DynamoDB,
  "Amazon Aurora": _Aurora,
  "Amazon ElastiCache for Redis": _ElastiCache,
  "Amazon ElastiCache": _ElastiCache,

  // Networking
  "Amazon VPC": _VPC,
  "VPC Security Groups": _VPC,
  "VPC Route Tables": _VPC,
  "VPC Flow Logs": _VPC,
  "Elastic IP Address": _VPC,
  "Elastic Network Interface": _VPC,
  "NAT Gateway": _VPC,
  "AWS PrivateLink": _VPC,
  "Application Load Balancer": _ELB,
  "Network Load Balancer": _ELB,
  "Amazon CloudFront": _CloudFront,
  "Amazon Route 53": _Route53,
  "Route 53": _Route53,
  "Route 53 Private Hosted Zones": _Route53,
  "Amazon API Gateway": _ApiGateway,
  "AWS Direct Connect": _DirectConnect,
  "AWS Site-to-Site VPN": _VPC,
  "AWS Network Firewall": _NetworkFirewall,
  "AWS WAF": _WAF,
  "AWS Global Accelerator": _CloudFront,

  // Integration
  "Amazon SQS": _SQS,
  "Amazon SNS": _SNS,
  "Amazon EventBridge": _EventBridge,
  "Amazon Kinesis Data Streams": _Kinesis,
  "AWS Step Functions": _StepFunctions,
  "Amazon Pinpoint": _Pinpoint,
  "AWS AppSync": _AppSync,

  // Monitoring
  "Amazon CloudWatch": _CloudWatch,
  "Amazon CloudWatch Logs": _CloudWatch,
  "CloudWatch Alarms": _CloudWatch,
  "CloudWatch Dashboards": _CloudWatch,
  "CloudWatch Anomaly Detection": _CloudWatch,
  "AWS CloudTrail": _CloudTrail,
  "AWS X-Ray": _XRay,

  // Security
  "AWS IAM": _IAM,
  "IAM Roles": _IAM,
  "IAM Policies": _IAM,
  "AWS Secrets Manager": _SecretsManager,
  "AWS KMS": _KMS,
  "AWS Security Hub": _SecurityHub,
  "AWS Certificate Manager": _CertificateManager,

  // Management
  "AWS Systems Manager": _SystemsManager,
  "AWS Systems Manager Session Manager": _SystemsManager,
  "AWS Instance Scheduler": _SystemsManager,
  "AWS Backup": _Backup,
  "AWS Cost Explorer": _CostExplorer,
  "AWS Trusted Advisor": _TrustedAdvisor,

  // Serverless / Modern
  "AWS Amplify Hosting": _Amplify,
  "Amazon Bedrock": _Bedrock,
  "Amazon SageMaker": _SageMaker,

  // Search
  "Amazon OpenSearch Service": _OpenSearch,

  // Resource Management
  "AWS Resource Groups": _ResourceGroups,
};

/**
 * Get the official AWS icon component for a service name.
 * Falls back to the generic AWS cloud logo.
 */
export function getAwsServiceIcon(serviceName: string): RawIcon {
  return SERVICE_ICON_MAP[serviceName] ?? _GenericAws;
}

/**
 * Render an AWS service icon at the given size.
 */
export function AwsServiceIcon({
  service,
  size = 24,
  className,
}: {
  service: string;
  size?: number;
  className?: string;
}) {
  const Icon = getAwsServiceIcon(service);
  return <Icon size={size} className={className} />;
}
