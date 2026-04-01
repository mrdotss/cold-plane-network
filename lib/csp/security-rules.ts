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
      remediation:
        "Enable MFA for the root account using a hardware or virtual MFA device",
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
      remediation:
        "Delete root account access keys and use IAM users or roles instead",
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
      remediation:
        "Set a password policy requiring minimum 14 characters, uppercase, lowercase, numbers, and symbols",
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
        remediation: "Increase minimum password length to at least 14 characters",
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
        remediation: "Set password reuse prevention to 24",
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
        remediation: `Enable MFA for user "${user.userName}"`,
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
          remediation: `Rotate access key ${key.accessKeyId} for user "${user.userName}"`,
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
        remediation: `Review and restrict permissions for user "${user.userName}" to follow least privilege`,
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
            remediation: `Restrict ${portName} access in security group "${sg.groupName}" to specific IP ranges`,
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
          remediation: `Review and restrict all inbound rules in security group "${sg.groupName}"`,
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
        remediation: `Enable VPC flow logs for ${vpc.vpcId} to monitor network traffic`,
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
        remediation: `Enable "Block all public access" on bucket "${bucket.name}"`,
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
        remediation: `Enable default server-side encryption (SSE-S3 or SSE-KMS) on bucket "${bucket.name}"`,
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
        remediation: `Enable versioning on bucket "${bucket.name}" for data recovery`,
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
        remediation: `Enable server access logging on bucket "${bucket.name}"`,
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
      remediation: "Create a multi-region CloudTrail trail with log file validation",
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
        remediation: "Enable multi-region logging on at least one CloudTrail trail",
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
        remediation: "Start logging on at least one CloudTrail trail",
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
          remediation: `Enable log file validation on trail "${trail.name}"`,
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
      remediation: "Enable AWS Config to record resource configuration changes",
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
          remediation: `Start recording on Config recorder "${rec.name}"`,
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
          remediation: `Enable recording of all resource types on Config recorder "${rec.name}"`,
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
      remediation:
        "Create an IAM Access Analyzer to identify resources shared with external entities",
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
      remediation:
        "Review and resolve external access findings in IAM Access Analyzer",
      metadata: { activeCount: data.externalAccess.activeFindings },
    });
  }

  return findings;
}
