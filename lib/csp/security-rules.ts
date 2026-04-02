import "server-only";

import type { CollectedSecurityData } from "./aws-security-collector";
import type { CspFindingInput, CspCategory, CspSeverity } from "./types";

/**
 * Deterministic rule engine for CSP security checks.
 * Produces base findings from collected AWS data — these are then enriched
 * by the AI agent with detailed remediation and CIS references.
 */
export function evaluateSecurityRules(
  data: CollectedSecurityData,
): CspFindingInput[] {
  const findings: CspFindingInput[] = [];

  findings.push(...checkIdentityAccess(data));
  findings.push(...checkNetworkSecurity(data));
  findings.push(...checkDataProtection(data));
  findings.push(...checkLogging(data));
  findings.push(...checkExternalAccess(data));

  return findings;
}

// ─── Identity & Access Checks ──────────────────────────────────────────────

function checkIdentityAccess(data: CollectedSecurityData): CspFindingInput[] {
  const findings: CspFindingInput[] = [];
  const { users, passwordPolicy, accountSummary } = data.identityAccess;

  // Root account MFA
  if (!accountSummary.rootAccountMfaEnabled) {
    findings.push({
      category: "identity_access",
      service: "IAM",
      resourceId: "root-account",
      resourceName: "Root Account",
      severity: "critical",
      finding: "Root account does not have MFA enabled",
      remediation: [
        "Sign in to the AWS Management Console as the root user.",
        "Go to the IAM Dashboard → click your account name (top-right) → Security credentials.",
        'Under "Multi-factor authentication (MFA)", click Assign MFA device.',
        "Choose a device type: Virtual MFA (e.g. Google Authenticator) or Hardware MFA key.",
        "Scan the QR code with your authenticator app and enter two consecutive codes to activate.",
        "Store backup codes securely — losing MFA access to root can lock the entire account.",
      ].join("\n"),
      cisReference: "1.5",
      metadata: {},
    });
  }

  // Root access keys
  if (accountSummary.accountAccessKeysPresent > 0) {
    findings.push({
      category: "identity_access",
      service: "IAM",
      resourceId: "root-account-keys",
      resourceName: "Root Account Access Keys",
      severity: "critical",
      finding: `Root account has ${accountSummary.accountAccessKeysPresent} active access key(s)`,
      remediation: [
        "Sign in to the AWS Console as the root user.",
        "Go to IAM → click your account name (top-right) → Security credentials.",
        'Scroll to "Access keys" section. Identify the active key(s).',
        "Click Actions → Deactivate on each key. Verify no services break.",
        "After confirming no impact, click Actions → Delete to permanently remove the key(s).",
        "For programmatic access, create an IAM user or role with least-privilege policies instead.",
      ].join("\n"),
      cisReference: "1.4",
      metadata: {
        keyCount: accountSummary.accountAccessKeysPresent,
      },
    });
  }

  // Password policy
  if (!passwordPolicy.exists) {
    findings.push({
      category: "identity_access",
      service: "IAM",
      resourceId: "password-policy",
      resourceName: "Account Password Policy",
      severity: "high",
      finding: "No custom IAM password policy is configured",
      remediation: [
        "Open the IAM Console → Account settings → Password policy.",
        'Click "Edit password policy".',
        "Set minimum length to 14 characters.",
        "Enable: uppercase, lowercase, numbers, and symbols requirements.",
        "Set password expiration to 90 days.",
        "Set password reuse prevention to 24 (prevents reusing last 24 passwords).",
        'Click "Save changes".',
      ].join("\n"),
      cisReference: "1.8",
      metadata: {},
    });
  } else {
    if (passwordPolicy.minLength && passwordPolicy.minLength < 14) {
      findings.push({
        category: "identity_access",
        service: "IAM",
        resourceId: "password-policy-length",
        resourceName: "Password Policy - Minimum Length",
        severity: "medium",
        finding: `Password minimum length is ${passwordPolicy.minLength} (recommended: 14+)`,
        remediation: [
          "Open the IAM Console → Account settings → Password policy.",
          'Click "Edit password policy".',
          `Change the minimum password length from ${passwordPolicy.minLength} to at least 14 characters.`,
          'Click "Save changes".',
          "Notify existing users to update their passwords to meet the new requirement.",
        ].join("\n"),
        cisReference: "1.8",
        metadata: { currentMinLength: passwordPolicy.minLength },
      });
    }
    if (!passwordPolicy.passwordReusePrevention || passwordPolicy.passwordReusePrevention < 24) {
      findings.push({
        category: "identity_access",
        service: "IAM",
        resourceId: "password-policy-reuse",
        resourceName: "Password Policy - Reuse Prevention",
        severity: "medium",
        finding: `Password reuse prevention is ${passwordPolicy.passwordReusePrevention ?? "not set"} (recommended: 24)`,
        remediation: [
          "Open the IAM Console → Account settings → Password policy.",
          'Click "Edit password policy".',
          `Set "Remember last N passwords" to 24 (currently: ${passwordPolicy.passwordReusePrevention ?? "not set"}).`,
          'Click "Save changes".',
        ].join("\n"),
        cisReference: "1.9",
        metadata: { current: passwordPolicy.passwordReusePrevention ?? 0 },
      });
    }
  }

  // Per-user checks
  const now = Date.now();
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

  for (const user of users) {
    // MFA check (skip console-less/service users with no password)
    if (!user.hasMfa) {
      findings.push({
        category: "identity_access",
        service: "IAM",
        resourceId: `user:${user.userName}`,
        resourceName: user.userName,
        severity: "high",
        finding: `IAM user "${user.userName}" does not have MFA enabled`,
        remediation: [
          `Open the IAM Console → Users → click on "${user.userName}".`,
          'Go to the "Security credentials" tab.',
          'Under "Multi-factor authentication (MFA)", click Assign MFA device.',
          "Choose Virtual MFA device (recommended: Google Authenticator or Authy).",
          "Scan the QR code and enter two consecutive codes to complete setup.",
        ].join("\n"),
        cisReference: "1.10",
        metadata: { userId: user.userId },
      });
    }

    // Stale access keys (>90 days)
    for (const key of user.accessKeys) {
      if (key.status !== "Active") continue;
      const keyAge = now - new Date(key.createDate).getTime();
      if (keyAge > NINETY_DAYS_MS) {
        const ageDays = Math.floor(keyAge / (24 * 60 * 60 * 1000));
        findings.push({
          category: "identity_access",
          service: "IAM",
          resourceId: `access-key:${key.accessKeyId}`,
          resourceName: `${user.userName} / ${key.accessKeyId}`,
          severity: "high",
          finding: `Access key ${key.accessKeyId} for user "${user.userName}" is ${ageDays} days old (>90 days)`,
          remediation: [
            `Open IAM Console → Users → "${user.userName}" → Security credentials tab.`,
            `Locate access key ${key.accessKeyId} (created ${ageDays} days ago).`,
            'Click "Create access key" to generate a new key pair.',
            "Update the new key in all applications/services that use it.",
            "Verify the new key works correctly in all environments.",
            `Click "Make inactive" on the old key ${key.accessKeyId}, then delete it after confirming no issues.`,
          ].join("\n"),
          cisReference: "1.14",
          metadata: {
            userName: user.userName,
            ageDays,
            createDate: key.createDate,
          },
        });
      }
    }

    // Overly permissive policies (AdministratorAccess)
    const hasAdminPolicy = user.attachedPolicies.some(
      (p) =>
        p.includes("AdministratorAccess") ||
        p.includes("arn:aws:iam::aws:policy/AdministratorAccess"),
    );
    if (hasAdminPolicy) {
      findings.push({
        category: "identity_access",
        service: "IAM",
        resourceId: `user-admin:${user.userName}`,
        resourceName: user.userName,
        severity: "high",
        finding: `IAM user "${user.userName}" has AdministratorAccess policy attached`,
        remediation: [
          `Open IAM Console → Users → "${user.userName}" → Permissions tab.`,
          'Find the "AdministratorAccess" managed policy and click Remove.',
          "Determine the minimum permissions this user actually needs.",
          "Create or attach a least-privilege policy granting only required actions.",
          "Consider using IAM roles with temporary credentials instead of long-lived user keys.",
        ].join("\n"),
        cisReference: "1.16",
        metadata: {
          attachedPolicies: user.attachedPolicies,
          inlinePolicyCount: user.inlinePolicyCount,
        },
      });
    }
  }

  return findings;
}

// ─── Network Security Checks ──────────────────────────────────────────────

const SENSITIVE_PORTS = new Set([22, 3389, 3306, 5432, 1433, 27017, 6379]);
const SENSITIVE_PORT_NAMES: Record<number, string> = {
  22: "SSH",
  3389: "RDP",
  3306: "MySQL",
  5432: "PostgreSQL",
  1433: "MSSQL",
  27017: "MongoDB",
  6379: "Redis",
};

function checkNetworkSecurity(data: CollectedSecurityData): CspFindingInput[] {
  const findings: CspFindingInput[] = [];

  // Open security groups
  for (const sg of data.network.securityGroups) {
    for (const rule of sg.ingressRules) {
      const hasOpenCidr =
        rule.cidrBlocks.includes("0.0.0.0/0") ||
        rule.ipv6CidrBlocks.includes("::/0");
      if (!hasOpenCidr) continue;

      // Check if any sensitive port is in the range
      for (const port of SENSITIVE_PORTS) {
        if (
          (rule.fromPort <= port && rule.toPort >= port) ||
          rule.fromPort === -1 // all traffic
        ) {
          const portName = SENSITIVE_PORT_NAMES[port] ?? `port ${port}`;
          const severity: CspSeverity =
            port === 22 || port === 3389 ? "critical" : "high";

          findings.push({
            category: "network",
            service: "EC2",
            resourceId: `sg:${sg.groupId}:${port}`,
            resourceName: `${sg.groupName} (${sg.groupId})`,
            severity,
            finding: `Security group "${sg.groupName}" allows ${portName} (port ${port}) from 0.0.0.0/0`,
            remediation: [
              `Open the EC2 Console → Security Groups → search for "${sg.groupId}".`,
              `Click the security group → Inbound rules tab → Edit inbound rules.`,
              `Find the rule allowing port ${port} (${portName}) with source 0.0.0.0/0.`,
              `Change the source from 0.0.0.0/0 to specific IP ranges (e.g. your office CIDR, VPN range, or bastion host SG).`,
              `If this port is not needed, delete the rule entirely.`,
              `Click "Save rules" and verify connectivity from authorized sources.`,
            ].join("\n"),
            cisReference: port === 22 ? "5.2" : port === 3389 ? "5.3" : undefined,
            metadata: {
              groupId: sg.groupId,
              vpcId: sg.vpcId,
              port,
              protocol: rule.protocol,
            },
          });
        }
      }

      // All traffic open (protocol -1)
      if (rule.protocol === "-1" || rule.fromPort === -1) {
        findings.push({
          category: "network",
          service: "EC2",
          resourceId: `sg:${sg.groupId}:all`,
          resourceName: `${sg.groupName} (${sg.groupId})`,
          severity: "critical",
          finding: `Security group "${sg.groupName}" allows ALL traffic from 0.0.0.0/0`,
          remediation: [
            `Open the EC2 Console → Security Groups → search for "${sg.groupId}".`,
            `Click the security group → Inbound rules tab → Edit inbound rules.`,
            `Find and delete the rule allowing "All traffic" with source 0.0.0.0/0.`,
            `Add specific rules for only the ports and protocols you need (e.g. HTTPS 443, SSH 22 from your IP).`,
            `Click "Save rules". Verify applications still work correctly.`,
          ].join("\n"),
          metadata: { groupId: sg.groupId, vpcId: sg.vpcId },
        });
      }
    }
  }

  // VPC flow logs
  for (const vpc of data.network.vpcs) {
    if (!vpc.hasFlowLogs) {
      findings.push({
        category: "network",
        service: "VPC",
        resourceId: `vpc:${vpc.vpcId}`,
        resourceName: vpc.vpcId,
        severity: "medium",
        finding: `VPC ${vpc.vpcId} does not have flow logs enabled`,
        remediation: [
          `Open the VPC Console → Your VPCs → select ${vpc.vpcId}.`,
          `Click the "Flow logs" tab → Create flow log.`,
          `Set Filter to "All" to capture accepted and rejected traffic.`,
          `Choose destination: CloudWatch Logs group or S3 bucket.`,
          `If using CloudWatch, create a log group (e.g. /vpc/flow-logs/${vpc.vpcId}).`,
          `Set an IAM role that allows publishing to the destination.`,
          `Click "Create flow log" and verify logs start appearing.`,
        ].join("\n"),
        cisReference: "3.9",
        metadata: { vpcId: vpc.vpcId },
      });
    }
  }

  return findings;
}

// ─── Data Protection Checks ───────────────────────────────────────────────

function checkDataProtection(data: CollectedSecurityData): CspFindingInput[] {
  const findings: CspFindingInput[] = [];

  for (const bucket of data.dataProtection.buckets) {
    // Public access block
    if (bucket.publicAccessBlocked === false) {
      findings.push({
        category: "data_protection",
        service: "S3",
        resourceId: `s3:${bucket.name}:public-access`,
        resourceName: bucket.name,
        severity: "critical",
        finding: `S3 bucket "${bucket.name}" does not have public access blocked`,
        remediation: [
          `Open the S3 Console → click on bucket "${bucket.name}".`,
          `Go to the "Permissions" tab → Block public access (bucket settings).`,
          `Click "Edit" and check all four options: Block public ACLs, Block public bucket policies, Ignore public ACLs, Restrict public buckets.`,
          `Click "Save changes" and type "confirm" when prompted.`,
          `If this bucket intentionally serves public content (e.g. website hosting), use CloudFront with OAI/OAC instead.`,
        ].join("\n"),
        cisReference: "2.1.5",
        metadata: { bucketName: bucket.name },
      });
    }

    // Encryption
    if (bucket.encryptionEnabled === false) {
      findings.push({
        category: "data_protection",
        service: "S3",
        resourceId: `s3:${bucket.name}:encryption`,
        resourceName: bucket.name,
        severity: "high",
        finding: `S3 bucket "${bucket.name}" does not have default encryption enabled`,
        remediation: [
          `Open the S3 Console → click on bucket "${bucket.name}".`,
          `Go to the "Properties" tab → Default encryption section.`,
          `Click "Edit" and select SSE-S3 (free) or SSE-KMS (if you need key management audit trail).`,
          `Optionally enable Bucket Key to reduce KMS costs.`,
          `Click "Save changes". New objects will be encrypted automatically.`,
        ].join("\n"),
        cisReference: "2.1.1",
        metadata: { bucketName: bucket.name },
      });
    }

    // Versioning
    if (bucket.versioningEnabled === false) {
      findings.push({
        category: "data_protection",
        service: "S3",
        resourceId: `s3:${bucket.name}:versioning`,
        resourceName: bucket.name,
        severity: "low",
        finding: `S3 bucket "${bucket.name}" does not have versioning enabled`,
        remediation: [
          `Open the S3 Console → click on bucket "${bucket.name}".`,
          `Go to the "Properties" tab → Bucket Versioning section.`,
          `Click "Edit", select "Enable", and click "Save changes".`,
          `Consider adding a lifecycle rule to expire old object versions after a set period to manage storage costs.`,
        ].join("\n"),
        metadata: { bucketName: bucket.name },
      });
    }

    // Logging
    if (bucket.loggingEnabled === false) {
      findings.push({
        category: "data_protection",
        service: "S3",
        resourceId: `s3:${bucket.name}:logging`,
        resourceName: bucket.name,
        severity: "low",
        finding: `S3 bucket "${bucket.name}" does not have access logging enabled`,
        remediation: [
          `Open the S3 Console → click on bucket "${bucket.name}".`,
          `Go to the "Properties" tab → Server access logging section.`,
          `Click "Edit" and select "Enable".`,
          `Choose a target bucket for storing logs (create one if needed, e.g. "${bucket.name}-logs").`,
          `Set a target prefix (e.g. "access-logs/") to organize log files.`,
          `Click "Save changes".`,
        ].join("\n"),
        cisReference: "2.1.3",
        metadata: { bucketName: bucket.name },
      });
    }
  }

  return findings;
}

// ─── Logging & Monitoring Checks ──────────────────────────────────────────

function checkLogging(data: CollectedSecurityData): CspFindingInput[] {
  const findings: CspFindingInput[] = [];

  // No CloudTrail at all
  if (data.logging.trails.length === 0) {
    findings.push({
      category: "logging",
      service: "CloudTrail",
      resourceId: "cloudtrail:none",
      resourceName: "CloudTrail",
      severity: "critical",
      finding: "No CloudTrail trail is configured",
      remediation: [
        "Open the CloudTrail Console → Trails → Create trail.",
        "Enter a trail name (e.g. \"management-events-trail\").",
        "Choose to create a new S3 bucket or use an existing one for log storage.",
        "Enable log file validation (ensures logs aren't tampered with).",
        "Enable the trail for all regions (multi-region).",
        "Under \"Event type\", ensure Management events are selected with Read/Write = All.",
        'Click "Create trail".',
      ].join("\n"),
      cisReference: "3.1",
      metadata: {},
    });
  } else {
    // Check each trail
    const hasMultiRegion = data.logging.trails.some((t) => t.isMultiRegion);
    const hasActiveTrail = data.logging.trails.some((t) => t.isLogging);

    if (!hasMultiRegion) {
      findings.push({
        category: "logging",
        service: "CloudTrail",
        resourceId: "cloudtrail:multi-region",
        resourceName: "CloudTrail Multi-Region",
        severity: "high",
        finding: "No multi-region CloudTrail trail is configured",
        remediation: [
          "Open the CloudTrail Console → Trails.",
          "Select an existing trail and click Edit.",
          'Under "General details", enable "Apply trail to all regions".',
          "Click Save. This ensures API activity in all regions is logged.",
        ].join("\n"),
        cisReference: "3.1",
        metadata: { trailCount: data.logging.trails.length },
      });
    }

    if (!hasActiveTrail) {
      findings.push({
        category: "logging",
        service: "CloudTrail",
        resourceId: "cloudtrail:inactive",
        resourceName: "CloudTrail Logging",
        severity: "critical",
        finding: "No CloudTrail trail is actively logging",
        remediation: [
          "Open the CloudTrail Console → Trails.",
          "Select the trail that should be active.",
          'If the trail is stopped, click "Start logging" to resume.',
          "Check the S3 bucket and IAM role permissions if logging fails to start.",
          "Verify logs are being delivered by checking the S3 bucket for recent log files.",
        ].join("\n"),
        cisReference: "3.1",
        metadata: {},
      });
    }

    for (const trail of data.logging.trails) {
      if (!trail.hasLogFileValidation) {
        findings.push({
          category: "logging",
          service: "CloudTrail",
          resourceId: `cloudtrail:${trail.name}:validation`,
          resourceName: trail.name,
          severity: "medium",
          finding: `CloudTrail trail "${trail.name}" does not have log file validation enabled`,
          remediation: [
            `Open the CloudTrail Console → Trails → click on "${trail.name}".`,
            'Click "Edit" in the General details section.',
            "Enable \"Log file validation\" — this creates digest files that let you detect if logs are modified or deleted.",
            'Click "Save changes".',
          ].join("\n"),
          cisReference: "3.2",
          metadata: { trailName: trail.name },
        });
      }
    }
  }

  // AWS Config
  if (data.logging.configRecorders.length === 0) {
    findings.push({
      category: "logging",
      service: "Config",
      resourceId: "config:none",
      resourceName: "AWS Config",
      severity: "high",
      finding: "AWS Config recorder is not configured",
      remediation: [
        "Open the AWS Config Console → Get started / Settings.",
        "Click \"1-click setup\" or configure manually.",
        'Select "Record all resource types supported in this region".',
        "Choose an S3 bucket for configuration snapshots.",
        "Create or select an IAM role for AWS Config.",
        'Click "Confirm" to start recording.',
      ].join("\n"),
      cisReference: "3.5",
      metadata: {},
    });
  } else {
    for (const rec of data.logging.configRecorders) {
      if (!rec.isRecording) {
        findings.push({
          category: "logging",
          service: "Config",
          resourceId: `config:${rec.name}:inactive`,
          resourceName: rec.name,
          severity: "high",
          finding: `AWS Config recorder "${rec.name}" is not recording`,
          remediation: [
            "Open the AWS Config Console → Settings.",
            `Locate recorder "${rec.name}" and click "Start recording".`,
            "If it fails, check the IAM role permissions and S3 bucket access.",
            "Verify recording is active by checking for recent configuration items.",
          ].join("\n"),
          cisReference: "3.5",
          metadata: { recorderName: rec.name },
        });
      }
      if (!rec.allResourceTypes) {
        findings.push({
          category: "logging",
          service: "Config",
          resourceId: `config:${rec.name}:partial`,
          resourceName: rec.name,
          severity: "medium",
          finding: `AWS Config recorder "${rec.name}" is not recording all resource types`,
          remediation: [
            "Open the AWS Config Console → Settings.",
            'Click "Edit" on the recording settings.',
            'Select "Record all resource types supported in this region".',
            'Click "Save" to apply the change.',
          ].join("\n"),
          metadata: { recorderName: rec.name },
        });
      }
    }
  }

  return findings;
}

// ─── External Access Checks ───────────────────────────────────────────────

function checkExternalAccess(data: CollectedSecurityData): CspFindingInput[] {
  const findings: CspFindingInput[] = [];

  // No analyzer exists
  if (data.externalAccess.analyzers.length === 0) {
    findings.push({
      category: "external_access",
      service: "AccessAnalyzer",
      resourceId: "access-analyzer:none",
      resourceName: "IAM Access Analyzer",
      severity: "high",
      finding: "No IAM Access Analyzer is configured",
      remediation: [
        "Open the IAM Console → Access Analyzer → Create analyzer.",
        'Set the zone of trust to "Current account" (or "Organization" if using AWS Organizations).',
        "Enter a name (e.g. \"account-analyzer\") and click Create.",
        "Review the generated findings — each one represents a resource shared with an external entity.",
        "Resolve each finding by either archiving (if intentional) or removing the external access.",
      ].join("\n"),
      cisReference: "1.20",
      metadata: {},
    });
  }

  // Active external access findings
  if (data.externalAccess.activeFindings > 0) {
    findings.push({
      category: "external_access",
      service: "AccessAnalyzer",
      resourceId: "access-analyzer:findings",
      resourceName: "External Access Findings",
      severity: "high",
      finding: `${data.externalAccess.activeFindings} active external access finding(s) detected`,
      remediation: [
        "Open the IAM Console → Access Analyzer → Findings.",
        `Review each of the ${data.externalAccess.activeFindings} active finding(s).`,
        "For each finding, determine if the external access is intentional.",
        "If intentional: click Archive to acknowledge the finding.",
        "If unintentional: navigate to the resource and remove the external access (e.g. update S3 bucket policy, remove cross-account role trust).",
        "Set up EventBridge rules to get notified of new Access Analyzer findings.",
      ].join("\n"),
      metadata: { activeCount: data.externalAccess.activeFindings },
    });
  }

  return findings;
}
