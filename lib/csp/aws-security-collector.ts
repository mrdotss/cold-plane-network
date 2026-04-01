import "server-only";

import type { Credentials } from "@aws-sdk/client-sts";
import {
  IAMClient,
  ListUsersCommand,
  ListMFADevicesCommand,
  ListAccessKeysCommand,
  GetAccountPasswordPolicyCommand,
  GetAccountSummaryCommand,
  ListAttachedUserPoliciesCommand,
  ListUserPoliciesCommand,
} from "@aws-sdk/client-iam";
import {
  EC2Client,
  DescribeSecurityGroupsCommand,
  DescribeFlowLogsCommand,
  DescribeVpcsCommand,
} from "@aws-sdk/client-ec2";
import {
  S3Client,
  ListBucketsCommand,
  GetPublicAccessBlockCommand,
  GetBucketEncryptionCommand,
  GetBucketVersioningCommand,
  GetBucketLoggingCommand,
} from "@aws-sdk/client-s3";
import {
  CloudTrailClient,
  DescribeTrailsCommand,
  GetTrailStatusCommand,
} from "@aws-sdk/client-cloudtrail";
import {
  ConfigServiceClient,
  DescribeConfigurationRecordersCommand,
  DescribeConfigurationRecorderStatusCommand,
} from "@aws-sdk/client-config-service";
import {
  AccessAnalyzerClient,
  ListAnalyzersCommand,
  ListFindingsV2Command,
} from "@aws-sdk/client-accessanalyzer";
import type { CspCategory } from "./types";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface CollectedSecurityData {
  identityAccess: IdentityAccessData;
  network: NetworkSecurityData;
  dataProtection: DataProtectionData;
  logging: LoggingData;
  externalAccess: ExternalAccessData;
}

export interface IdentityAccessData {
  users: Array<{
    userName: string;
    userId: string;
    createDate: string;
    hasMfa: boolean;
    accessKeys: Array<{
      accessKeyId: string;
      status: string;
      createDate: string;
    }>;
    attachedPolicies: string[];
    inlinePolicyCount: number;
  }>;
  passwordPolicy: {
    exists: boolean;
    minLength?: number;
    requireSymbols?: boolean;
    requireNumbers?: boolean;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    maxAgeDays?: number;
    passwordReusePrevention?: number;
  };
  accountSummary: {
    rootAccountMfaEnabled: boolean;
    accountAccessKeysPresent: number;
  };
}

export interface NetworkSecurityData {
  securityGroups: Array<{
    groupId: string;
    groupName: string;
    vpcId: string;
    ingressRules: Array<{
      protocol: string;
      fromPort: number;
      toPort: number;
      cidrBlocks: string[];
      ipv6CidrBlocks: string[];
    }>;
  }>;
  vpcs: Array<{
    vpcId: string;
    hasFlowLogs: boolean;
  }>;
}

export interface DataProtectionData {
  buckets: Array<{
    name: string;
    createdAt: string;
    publicAccessBlocked: boolean | null;
    encryptionEnabled: boolean | null;
    versioningEnabled: boolean | null;
    loggingEnabled: boolean | null;
  }>;
}

export interface LoggingData {
  trails: Array<{
    name: string;
    isMultiRegion: boolean;
    hasLogFileValidation: boolean;
    s3BucketName: string;
    isLogging: boolean;
  }>;
  configRecorders: Array<{
    name: string;
    isRecording: boolean;
    allResourceTypes: boolean;
  }>;
}

export interface ExternalAccessData {
  analyzers: Array<{
    arn: string;
    name: string;
    type: string;
    status: string;
  }>;
  activeFindings: number;
}

type ProgressCallback = (category: CspCategory, detail: string) => void;

// ─── Credential Helper ─────────────────────────────────────────────────────

function makeCredentials(stsCreds: Credentials) {
  return {
    accessKeyId: stsCreds.AccessKeyId!,
    secretAccessKey: stsCreds.SecretAccessKey!,
    sessionToken: stsCreds.SessionToken!,
  };
}

// ─── Identity & Access Collector ───────────────────────────────────────────

async function collectIdentityAccess(
  credentials: ReturnType<typeof makeCredentials>,
  onProgress?: ProgressCallback,
): Promise<IdentityAccessData> {
  const iam = new IAMClient({ region: "us-east-1", credentials });

  onProgress?.("identity_access", "listing IAM users");

  // List users
  const usersResponse = await iam.send(new ListUsersCommand({ MaxItems: 200 }));
  const rawUsers = usersResponse.Users ?? [];

  onProgress?.("identity_access", `checking ${rawUsers.length} users`);

  const users = await Promise.all(
    rawUsers.map(async (user) => {
      const userName = user.UserName!;

      // MFA devices
      let hasMfa = false;
      try {
        const mfaResp = await iam.send(
          new ListMFADevicesCommand({ UserName: userName }),
        );
        hasMfa = (mfaResp.MFADevices ?? []).length > 0;
      } catch { /* insufficient perms */ }

      // Access keys
      let accessKeys: IdentityAccessData["users"][0]["accessKeys"] = [];
      try {
        const keysResp = await iam.send(
          new ListAccessKeysCommand({ UserName: userName }),
        );
        accessKeys = (keysResp.AccessKeyMetadata ?? []).map((k) => ({
          accessKeyId: k.AccessKeyId ?? "",
          status: k.Status ?? "unknown",
          createDate: k.CreateDate?.toISOString() ?? "",
        }));
      } catch { /* insufficient perms */ }

      // Attached policies
      let attachedPolicies: string[] = [];
      try {
        const polResp = await iam.send(
          new ListAttachedUserPoliciesCommand({ UserName: userName }),
        );
        attachedPolicies = (polResp.AttachedPolicies ?? []).map(
          (p) => p.PolicyArn ?? p.PolicyName ?? "",
        );
      } catch { /* insufficient perms */ }

      // Inline policy count
      let inlinePolicyCount = 0;
      try {
        const inlineResp = await iam.send(
          new ListUserPoliciesCommand({ UserName: userName }),
        );
        inlinePolicyCount = (inlineResp.PolicyNames ?? []).length;
      } catch { /* insufficient perms */ }

      return {
        userName,
        userId: user.UserId ?? "",
        createDate: user.CreateDate?.toISOString() ?? "",
        hasMfa,
        accessKeys,
        attachedPolicies,
        inlinePolicyCount,
      };
    }),
  );

  // Password policy
  onProgress?.("identity_access", "checking password policy");
  let passwordPolicy: IdentityAccessData["passwordPolicy"] = { exists: false };
  try {
    const ppResp = await iam.send(new GetAccountPasswordPolicyCommand({}));
    const pp = ppResp.PasswordPolicy;
    if (pp) {
      passwordPolicy = {
        exists: true,
        minLength: pp.MinimumPasswordLength,
        requireSymbols: pp.RequireSymbols,
        requireNumbers: pp.RequireNumbers,
        requireUppercase: pp.RequireUppercaseCharacters,
        requireLowercase: pp.RequireLowercaseCharacters,
        maxAgeDays: pp.MaxPasswordAge,
        passwordReusePrevention: pp.PasswordReusePrevention,
      };
    }
  } catch {
    // NoSuchEntity = no custom policy set
  }

  // Account summary (root MFA)
  onProgress?.("identity_access", "checking account summary");
  let accountSummary: IdentityAccessData["accountSummary"] = {
    rootAccountMfaEnabled: false,
    accountAccessKeysPresent: 0,
  };
  try {
    const summResp = await iam.send(new GetAccountSummaryCommand({}));
    const map = summResp.SummaryMap ?? {};
    accountSummary = {
      rootAccountMfaEnabled: (map.AccountMFAEnabled ?? 0) > 0,
      accountAccessKeysPresent: map.AccountAccessKeysPresent ?? 0,
    };
  } catch { /* insufficient perms */ }

  return { users, passwordPolicy, accountSummary };
}

// ─── Network Security Collector ────────────────────────────────────────────

async function collectNetworkSecurity(
  credentials: ReturnType<typeof makeCredentials>,
  regions: string[],
  onProgress?: ProgressCallback,
): Promise<NetworkSecurityData> {
  const allSgs: NetworkSecurityData["securityGroups"] = [];
  const allVpcs: NetworkSecurityData["vpcs"] = [];

  for (const region of regions) {
    onProgress?.("network", `checking ${region}`);
    const ec2 = new EC2Client({ region, credentials });

    // Security groups
    try {
      const sgResp = await ec2.send(new DescribeSecurityGroupsCommand({}));
      for (const sg of sgResp.SecurityGroups ?? []) {
        allSgs.push({
          groupId: sg.GroupId ?? "",
          groupName: sg.GroupName ?? "",
          vpcId: sg.VpcId ?? "",
          ingressRules: (sg.IpPermissions ?? []).map((perm) => ({
            protocol: perm.IpProtocol ?? "all",
            fromPort: perm.FromPort ?? -1,
            toPort: perm.ToPort ?? -1,
            cidrBlocks: (perm.IpRanges ?? []).map((r) => r.CidrIp ?? ""),
            ipv6CidrBlocks: (perm.Ipv6Ranges ?? []).map(
              (r) => r.CidrIpv6 ?? "",
            ),
          })),
        });
      }
    } catch {
      console.warn(`[CSP Collector] SGs ${region} failed`);
    }

    // VPCs + flow logs
    try {
      const vpcResp = await ec2.send(new DescribeVpcsCommand({}));
      const vpcIds = (vpcResp.Vpcs ?? []).map((v) => v.VpcId ?? "");

      let flowLogVpcs = new Set<string>();
      if (vpcIds.length > 0) {
        try {
          const flResp = await ec2.send(
            new DescribeFlowLogsCommand({
              Filter: [{ Name: "resource-id", Values: vpcIds }],
            }),
          );
          flowLogVpcs = new Set(
            (flResp.FlowLogs ?? []).map((fl) => fl.ResourceId ?? ""),
          );
        } catch { /* insufficient perms for flow logs */ }
      }

      for (const vpcId of vpcIds) {
        allVpcs.push({
          vpcId,
          hasFlowLogs: flowLogVpcs.has(vpcId),
        });
      }
    } catch {
      console.warn(`[CSP Collector] VPCs ${region} failed`);
    }
  }

  return { securityGroups: allSgs, vpcs: allVpcs };
}

// ─── Data Protection Collector ─────────────────────────────────────────────

async function collectDataProtection(
  credentials: ReturnType<typeof makeCredentials>,
  onProgress?: ProgressCallback,
): Promise<DataProtectionData> {
  const s3 = new S3Client({ region: "us-east-1", credentials });

  onProgress?.("data_protection", "listing S3 buckets");

  let bucketNames: Array<{ name: string; createdAt: string }> = [];
  try {
    const listResp = await s3.send(new ListBucketsCommand({}));
    bucketNames = (listResp.Buckets ?? []).map((b) => ({
      name: b.Name ?? "",
      createdAt: b.CreationDate?.toISOString() ?? "",
    }));
  } catch {
    return { buckets: [] };
  }

  onProgress?.("data_protection", `checking ${bucketNames.length} buckets`);

  const buckets = await Promise.all(
    bucketNames.map(async (bucket) => {
      let publicAccessBlocked: boolean | null = null;
      let encryptionEnabled: boolean | null = null;
      let versioningEnabled: boolean | null = null;
      let loggingEnabled: boolean | null = null;

      // Public access block
      try {
        const pabResp = await s3.send(
          new GetPublicAccessBlockCommand({ Bucket: bucket.name }),
        );
        const config = pabResp.PublicAccessBlockConfiguration;
        publicAccessBlocked = !!(
          config?.BlockPublicAcls &&
          config?.BlockPublicPolicy &&
          config?.IgnorePublicAcls &&
          config?.RestrictPublicBuckets
        );
      } catch (err) {
        if ((err as { name?: string }).name === "NoSuchPublicAccessBlockConfiguration") {
          publicAccessBlocked = false;
        }
      }

      // Encryption
      try {
        await s3.send(new GetBucketEncryptionCommand({ Bucket: bucket.name }));
        encryptionEnabled = true;
      } catch (err) {
        if (
          (err as { name?: string }).name ===
          "ServerSideEncryptionConfigurationNotFoundError"
        ) {
          encryptionEnabled = false;
        }
      }

      // Versioning
      try {
        const verResp = await s3.send(
          new GetBucketVersioningCommand({ Bucket: bucket.name }),
        );
        versioningEnabled = verResp.Status === "Enabled";
      } catch { /* insufficient perms */ }

      // Logging
      try {
        const logResp = await s3.send(
          new GetBucketLoggingCommand({ Bucket: bucket.name }),
        );
        loggingEnabled = !!logResp.LoggingEnabled;
      } catch { /* insufficient perms */ }

      return {
        name: bucket.name,
        createdAt: bucket.createdAt,
        publicAccessBlocked,
        encryptionEnabled,
        versioningEnabled,
        loggingEnabled,
      };
    }),
  );

  return { buckets };
}

// ─── Logging & Monitoring Collector ────────────────────────────────────────

async function collectLogging(
  credentials: ReturnType<typeof makeCredentials>,
  regions: string[],
  onProgress?: ProgressCallback,
): Promise<LoggingData> {
  const trails: LoggingData["trails"] = [];
  const configRecorders: LoggingData["configRecorders"] = [];

  // CloudTrail (check from us-east-1 — trails are often multi-region)
  onProgress?.("logging", "checking CloudTrail");
  const ct = new CloudTrailClient({ region: "us-east-1", credentials });
  try {
    const trailResp = await ct.send(new DescribeTrailsCommand({}));
    for (const trail of trailResp.trailList ?? []) {
      let isLogging = false;
      try {
        const statusResp = await ct.send(
          new GetTrailStatusCommand({ Name: trail.TrailARN }),
        );
        isLogging = statusResp.IsLogging ?? false;
      } catch { /* insufficient perms */ }

      trails.push({
        name: trail.Name ?? "",
        isMultiRegion: trail.IsMultiRegionTrail ?? false,
        hasLogFileValidation: trail.LogFileValidationEnabled ?? false,
        s3BucketName: trail.S3BucketName ?? "",
        isLogging,
      });
    }
  } catch {
    console.warn("[CSP Collector] CloudTrail failed");
  }

  // AWS Config (check primary region)
  onProgress?.("logging", "checking AWS Config");
  const primaryRegion = regions[0] ?? "us-east-1";
  const config = new ConfigServiceClient({
    region: primaryRegion,
    credentials,
  });
  try {
    const recResp = await config.send(
      new DescribeConfigurationRecordersCommand({}),
    );
    const statResp = await config.send(
      new DescribeConfigurationRecorderStatusCommand({}),
    );

    const statusMap = new Map(
      (statResp.ConfigurationRecordersStatus ?? []).map((s) => [
        s.name,
        s.recording,
      ]),
    );

    for (const rec of recResp.ConfigurationRecorders ?? []) {
      configRecorders.push({
        name: rec.name ?? "",
        isRecording: statusMap.get(rec.name ?? "") ?? false,
        allResourceTypes:
          rec.recordingGroup?.allSupported ?? false,
      });
    }
  } catch {
    console.warn("[CSP Collector] AWS Config failed");
  }

  return { trails, configRecorders };
}

// ─── External Access Collector ─────────────────────────────────────────────

async function collectExternalAccess(
  credentials: ReturnType<typeof makeCredentials>,
  regions: string[],
  onProgress?: ProgressCallback,
): Promise<ExternalAccessData> {
  const analyzers: ExternalAccessData["analyzers"] = [];
  let activeFindings = 0;

  onProgress?.("external_access", "checking Access Analyzer");

  // Check primary region for analyzer
  const primaryRegion = regions[0] ?? "us-east-1";
  const aa = new AccessAnalyzerClient({
    region: primaryRegion,
    credentials,
  });

  try {
    const listResp = await aa.send(new ListAnalyzersCommand({}));
    for (const analyzer of listResp.analyzers ?? []) {
      analyzers.push({
        arn: analyzer.arn ?? "",
        name: analyzer.name ?? "",
        type: analyzer.type ?? "",
        status: analyzer.status ?? "",
      });

      // Count active findings for each analyzer
      if (analyzer.status === "ACTIVE") {
        try {
          const findingsResp = await aa.send(
            new ListFindingsV2Command({
              analyzerArn: analyzer.arn,
              maxResults: 100,
            }),
          );
          activeFindings += (findingsResp.findings ?? []).filter(
            (f) => f.status === "ACTIVE",
          ).length;
        } catch { /* insufficient perms */ }
      }
    }
  } catch {
    console.warn("[CSP Collector] Access Analyzer failed");
  }

  return { analyzers, activeFindings };
}

// ─── Main Collector ────────────────────────────────────────────────────────

/**
 * Pre-fetch security posture data from free AWS APIs.
 * Collects IAM, SGs, S3, CloudTrail, Config, and Access Analyzer data.
 */
export async function collectSecurityData(
  stsCreds: Credentials,
  regions: string[],
  onProgress?: ProgressCallback,
): Promise<CollectedSecurityData> {
  const credentials = makeCredentials(stsCreds);

  const [identityAccess, network, dataProtection, logging, externalAccess] =
    await Promise.all([
      collectIdentityAccess(credentials, onProgress),
      collectNetworkSecurity(credentials, regions, onProgress),
      collectDataProtection(credentials, onProgress),
      collectLogging(credentials, regions, onProgress),
      collectExternalAccess(credentials, regions, onProgress),
    ]);

  return { identityAccess, network, dataProtection, logging, externalAccess };
}

/**
 * Format collected security data as markdown for agent context.
 */
export function formatSecurityData(data: CollectedSecurityData): string {
  const sections: string[] = [];

  // Identity & Access
  sections.push("### Identity & Access Management");
  sections.push(`${data.identityAccess.users.length} IAM users found:`);
  sections.push("```json");
  sections.push(JSON.stringify(data.identityAccess.users, null, 2));
  sections.push("```");
  sections.push("**Password Policy:**");
  sections.push("```json");
  sections.push(JSON.stringify(data.identityAccess.passwordPolicy, null, 2));
  sections.push("```");
  sections.push("**Account Summary:**");
  sections.push(
    `- Root MFA: ${data.identityAccess.accountSummary.rootAccountMfaEnabled ? "Enabled" : "DISABLED"}`,
  );
  sections.push(
    `- Root Access Keys: ${data.identityAccess.accountSummary.accountAccessKeysPresent}`,
  );

  // Network
  sections.push("\n### Network Security");
  sections.push(
    `${data.network.securityGroups.length} security groups, ${data.network.vpcs.length} VPCs:`,
  );
  sections.push("**Security Groups:**");
  sections.push("```json");
  sections.push(JSON.stringify(data.network.securityGroups, null, 2));
  sections.push("```");
  sections.push("**VPC Flow Logs:**");
  sections.push("```json");
  sections.push(JSON.stringify(data.network.vpcs, null, 2));
  sections.push("```");

  // Data Protection
  sections.push("\n### Data Protection (S3)");
  sections.push(`${data.dataProtection.buckets.length} buckets:`);
  sections.push("```json");
  sections.push(JSON.stringify(data.dataProtection.buckets, null, 2));
  sections.push("```");

  // Logging
  sections.push("\n### Logging & Monitoring");
  sections.push("**CloudTrail:**");
  sections.push("```json");
  sections.push(JSON.stringify(data.logging.trails, null, 2));
  sections.push("```");
  sections.push("**AWS Config:**");
  sections.push("```json");
  sections.push(JSON.stringify(data.logging.configRecorders, null, 2));
  sections.push("```");

  // External Access
  sections.push("\n### External Access");
  sections.push(
    `${data.externalAccess.analyzers.length} Access Analyzer(s), ${data.externalAccess.activeFindings} active findings:`,
  );
  sections.push("```json");
  sections.push(JSON.stringify(data.externalAccess.analyzers, null, 2));
  sections.push("```");

  return sections.join("\n");
}
