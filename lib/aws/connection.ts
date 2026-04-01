import "server-only";

import {
  STSClient,
  AssumeRoleCommand,
  type Credentials,
} from "@aws-sdk/client-sts";

import type { TestConnectionResponse } from "@/lib/cfm/types";

/** Session duration scoped to scan lifetime (15 min — STS minimum) */
const SESSION_DURATION_SECONDS = 900;
const SESSION_NAME = "cpn-cfm-scan";

const stsClient = new STSClient({
  region: process.env.AWS_REGION ?? "ap-southeast-1",
});

/**
 * Map STS error codes to user-facing messages.
 * The test connection endpoint returns { success: false, error } — NOT HTTP error codes.
 */
function mapStsError(error: unknown): string {
  if (error instanceof Error) {
    const name = (error as { name?: string }).name ?? "";
    const message = error.message ?? "";

    if (
      name === "AccessDeniedException" ||
      name === "AccessDenied" ||
      message.includes("is not authorized to perform") ||
      message.includes("Access denied")
    ) {
      return "Cannot access this AWS account. Verify the IAM role trusts CPN's account and the ARN is correct.";
    }

    if (
      name === "MalformedPolicyDocumentException" ||
      name === "NoSuchEntityException" ||
      message.includes("is not found") ||
      message.includes("Not authorized to perform sts:AssumeRole") ||
      message.includes("does not exist")
    ) {
      return "IAM role not found. Check the Role ARN.";
    }

    if (name === "RegionDisabledException") {
      return "The specified AWS region is disabled. Enable it in your AWS account settings.";
    }

    if (name === "ExpiredTokenException") {
      return "Connection test failed. Session expired — please try again.";
    }
  }

  return "Connection test failed. Please try again.";
}

/**
 * Test the connection to an AWS account by attempting STS AssumeRole.
 * Returns a TestConnectionResponse — STS failures are mapped to user-facing messages,
 * NOT thrown as HTTP errors.
 */
export async function testConnection(
  roleArn: string,
  externalId: string | null
): Promise<TestConnectionResponse> {
  try {
    const params: {
      RoleArn: string;
      RoleSessionName: string;
      DurationSeconds: number;
      ExternalId?: string;
    } = {
      RoleArn: roleArn,
      RoleSessionName: `${SESSION_NAME}-test`,
      DurationSeconds: SESSION_DURATION_SECONDS,
    };

    if (externalId) {
      params.ExternalId = externalId;
    }

    const command = new AssumeRoleCommand(params);
    const response = await stsClient.send(command);

    // Extract account alias from the assumed role ARN if available
    const accountAlias = response.AssumedRoleUser?.Arn?.split(":")[4];

    return {
      success: true,
      accountAlias: accountAlias ?? undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: mapStsError(error),
    };
  }
}

/**
 * Assume the cross-account IAM role and return temporary credentials.
 * Credentials are session-scoped and NEVER persisted to DB or logs.
 */
export async function assumeRole(
  roleArn: string,
  externalId: string | null
): Promise<Credentials> {
  const params: {
    RoleArn: string;
    RoleSessionName: string;
    DurationSeconds: number;
    ExternalId?: string;
  } = {
    RoleArn: roleArn,
    RoleSessionName: SESSION_NAME,
    DurationSeconds: SESSION_DURATION_SECONDS,
  };

  if (externalId) {
    params.ExternalId = externalId;
  }

  const command = new AssumeRoleCommand(params);
  const response = await stsClient.send(command);

  if (!response.Credentials) {
    throw new Error("STS AssumeRole did not return credentials");
  }

  return response.Credentials;
}
