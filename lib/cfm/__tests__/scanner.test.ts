import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// Mock server-only and external dependencies
vi.mock("server-only", () => ({}));
vi.mock("@/lib/cfm/aws-connection", () => ({
  assumeRole: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/cfm/queries", () => ({
  updateScanStatus: vi.fn().mockResolvedValue({}),
  insertRecommendations: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/chat/agent-client", () => ({
  createConversation: vi.fn().mockResolvedValue("conv-123"),
}));
vi.mock("@/lib/sizing/agent-client", () => ({
  getBearerToken: vi.fn().mockResolvedValue("mock-token"),
}));
vi.mock("@/lib/db/client", () => ({
  db: { update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }) },
}));
vi.mock("@/lib/db/schema", () => ({
  cfmScans: { id: "id" },
  cfmAccounts: { id: "id" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
}));

import {
  buildScanPrompt,
  buildDeepDiveChatPrompt,
  parseScanResults,
  buildSummary,
  isValidTransition,
} from "@/lib/cfm/scanner";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generate a valid 12-digit AWS account ID. */
const arbAwsAccountId = fc.stringMatching(/^\d{12}$/);

/** Generate a list of AWS region codes. */
const arbRegions = fc.uniqueArray(
  fc.constantFrom(
    "us-east-1", "us-west-2", "eu-west-1", "ap-southeast-1",
    "ap-southeast-3", "eu-central-1", "sa-east-1",
  ),
  { minLength: 1, maxLength: 4 },
);

/** Generate a list of AWS service names. */
const arbServices = fc.uniqueArray(
  fc.constantFrom("EC2", "RDS", "S3", "Lambda", "CloudWatch", "NAT Gateway", "CloudTrail", "ECS"),
  { minLength: 1, maxLength: 6 },
);

/** Known CFM MCP tool names from aws-samples/sample-cfm-tips-mcp that must NOT appear in prompts. */
const CFM_MCP_TOOL_NAMES = [
  "get_ec2_instances", "check_ec2_utilization", "get_ec2_rightsizing",
  "check_s3_lifecycle", "get_s3_storage_class", "analyze_s3_access_patterns",
  "get_s3_intelligent_tiering", "check_s3_versioning", "get_s3_inventory",
  "check_s3_multipart_uploads", "get_s3_request_metrics", "check_s3_replication",
  "get_s3_object_lock", "analyze_s3_costs", "get_rds_instances",
  "check_rds_utilization", "get_rds_recommendations", "get_lambda_functions",
  "check_lambda_utilization", "get_cloudwatch_costs", "check_cloudwatch_alarms",
  "get_cloudwatch_logs_costs", "check_cloudwatch_dashboards",
  "get_nat_gateway_usage", "check_nat_gateway_idle", "get_cost_explorer_data",
  "get_cost_forecast", "get_savings_plans", "get_reserved_instances",
  "get_trusted_advisor_checks", "get_compute_optimizer_recommendations",
  "check_cloudtrail_config", "get_ecs_services", "check_ecs_utilization",
  "get_cost_optimization_hub", "get_ebs_volumes", "check_ebs_utilization",
];

/** Generate a valid agent response with JSON blocks for given services. */
function buildMockAgentResponse(services: string[]): string {
  return services.map((service) => {
    const block = JSON.stringify({
      service,
      resources_analyzed: 5,
      recommendations: [
        {
          resourceId: `i-${Math.random().toString(36).slice(2, 10)}`,
          resourceName: `test-${service.toLowerCase()}`,
          priority: "medium",
          recommendation: `Right-size ${service} resources`,
          currentCost: 100,
          estimatedSavings: 30,
          effort: "low",
          metadata: {},
        },
      ],
    }, null, 2);
    return `Here is the analysis for ${service}:\n\`\`\`json\n${block}\n\`\`\``;
  }).join("\n\n");
}

// ─── Property 4: Scan prompt does not reference specific MCP tools ───────────

describe("Property 4: Scan prompt does not reference specific MCP tools", () => {
  /**
   * For any set of account details (account ID, regions, services),
   * the generated scan analysis prompt should not contain any CFM MCP tool names.
   * The agent autonomously selects tools.
   *
   * Validates: Requirements 3.3
   */

  it("generated prompt contains no CFM MCP tool names for any account details", () => {
    fc.assert(
      fc.property(
        arbAwsAccountId,
        arbRegions,
        arbServices,
        (awsAccountId, regions, services) => {
          const prompt = buildScanPrompt({ awsAccountId, regions, services });
          const promptLower = prompt.toLowerCase();

          for (const toolName of CFM_MCP_TOOL_NAMES) {
            expect(promptLower).not.toContain(toolName.toLowerCase());
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("prompt includes all requested services and regions", () => {
    fc.assert(
      fc.property(
        arbAwsAccountId,
        arbRegions,
        arbServices,
        (awsAccountId, regions, services) => {
          const prompt = buildScanPrompt({ awsAccountId, regions, services });

          // Account ID is present
          expect(prompt).toContain(awsAccountId);

          // All regions are present
          for (const region of regions) {
            expect(prompt).toContain(region);
          }

          // All services are present
          for (const service of services) {
            expect(prompt).toContain(service);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 5: Partial failure resilience ──────────────────────────────────

describe("Property 5: Partial failure resilience", () => {
  /**
   * For any set of selected services where a non-empty subset fails during scanning,
   * the scan should still complete with status "completed" (not "failed"),
   * and the results should contain recommendations for all services that succeeded.
   *
   * We test this via parseScanResults + buildSummary: if the agent returns results
   * for only a subset of services, the summary still reflects the successful ones.
   *
   * Validates: Requirements 3.5, 12.1
   */

  it("partial agent response produces summary with results for successful services only", () => {
    fc.assert(
      fc.property(
        arbServices.filter((s) => s.length >= 2),
        (services) => {
          // Agent returns results for only the first half of services
          const successfulServices = services.slice(0, Math.ceil(services.length / 2));
          const agentResponse = buildMockAgentResponse(successfulServices);

          const results = parseScanResults(agentResponse);
          const summary = buildSummary(results);

          // Summary should have results for successful services
          expect(summary.serviceBreakdown.length).toBe(successfulServices.length);
          expect(summary.recommendationCount).toBeGreaterThan(0);

          // Each successful service should appear in the breakdown
          const breakdownServices = summary.serviceBreakdown.map((b) => b.service);
          for (const service of successfulServices) {
            expect(breakdownServices).toContain(service);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("empty agent response produces zero-recommendation summary", () => {
    const results = parseScanResults("");
    const summary = buildSummary(results);

    expect(summary.recommendationCount).toBe(0);
    expect(summary.totalMonthlySpend).toBe(0);
    expect(summary.totalPotentialSavings).toBe(0);
    expect(summary.serviceBreakdown).toHaveLength(0);
  });

  it("malformed JSON blocks are skipped without crashing", () => {
    const response = `
Here is EC2 analysis:
\`\`\`json
{ this is not valid json }
\`\`\`

Here is S3 analysis:
\`\`\`json
${JSON.stringify({
  service: "S3",
  resources_analyzed: 3,
  recommendations: [{
    resourceId: "bucket-1",
    resourceName: "my-bucket",
    priority: "low",
    recommendation: "Change storage class to Glacier",
    currentCost: 50,
    estimatedSavings: 20,
    effort: "low",
    metadata: {},
  }],
})}
\`\`\`
`;

    const results = parseScanResults(response);
    expect(results).toHaveLength(1);
    expect(results[0].service).toBe("S3");
  });
});

// ─── Property 6: Completed scan persists all required data ───────────────────

describe("Property 6: Completed scan persists all required data", () => {
  /**
   * For any completed scan, the persisted record should have:
   * - a non-null summary with totalMonthlySpend, totalPotentialSavings,
   *   recommendationCount, and priorityBreakdown
   * - recommendations with all required fields (service, resourceId, priority,
   *   recommendation, currentCost, estimatedSavings, effort)
   *
   * We test this by generating arbitrary service results and verifying
   * buildSummary + parseScanResults produce complete data.
   *
   * Validates: Requirements 3.6, 3.7, 3.8
   */

  /** Generate an arbitrary valid recommendation. */
  const arbRecommendation = fc.record({
    resourceId: fc.string({ minLength: 1, maxLength: 30 }),
    resourceName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: undefined }),
    priority: fc.constantFrom("critical", "medium", "low"),
    recommendation: fc.string({ minLength: 1, maxLength: 200 }),
    currentCost: fc.float({ min: 0, max: 10000, noNaN: true }),
    estimatedSavings: fc.float({ min: 0, max: 10000, noNaN: true }),
    effort: fc.constantFrom("low", "medium", "high"),
    metadata: fc.constant({}),
  });

  /** Generate an arbitrary service result block. */
  const arbServiceResult = fc.record({
    service: fc.constantFrom("EC2", "RDS", "S3", "Lambda", "CloudWatch"),
    resources_analyzed: fc.integer({ min: 1, max: 100 }),
    recommendations: fc.array(arbRecommendation, { minLength: 1, maxLength: 5 }),
  });

  it("buildSummary produces complete summary with all required fields", () => {
    fc.assert(
      fc.property(
        fc.array(arbServiceResult, { minLength: 1, maxLength: 4 }),
        (serviceResults) => {
          const summary = buildSummary(serviceResults);

          // Summary has all required top-level fields
          expect(typeof summary.totalMonthlySpend).toBe("number");
          expect(typeof summary.totalPotentialSavings).toBe("number");
          expect(typeof summary.recommendationCount).toBe("number");
          expect(summary.priorityBreakdown).toBeDefined();
          expect(typeof summary.priorityBreakdown.critical).toBe("number");
          expect(typeof summary.priorityBreakdown.medium).toBe("number");
          expect(typeof summary.priorityBreakdown.low).toBe("number");

          // Recommendation count matches sum of all recommendations
          const totalRecs = serviceResults.reduce(
            (sum, r) => sum + r.recommendations.length, 0,
          );
          expect(summary.recommendationCount).toBe(totalRecs);

          // Priority breakdown sums to total recommendation count
          const prioritySum =
            summary.priorityBreakdown.critical +
            summary.priorityBreakdown.medium +
            summary.priorityBreakdown.low;
          expect(prioritySum).toBe(summary.recommendationCount);

          // Service breakdown has entries
          expect(summary.serviceBreakdown.length).toBeGreaterThan(0);

          // Each service breakdown has required fields
          for (const sb of summary.serviceBreakdown) {
            expect(typeof sb.service).toBe("string");
            expect(typeof sb.currentSpend).toBe("number");
            expect(typeof sb.potentialSavings).toBe("number");
            expect(typeof sb.recommendationCount).toBe("number");
            expect(typeof sb.resourceCount).toBe("number");
            expect(typeof sb.hasCritical).toBe("boolean");
            expect(Array.isArray(sb.recommendationTypes)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("parseScanResults extracts recommendations with all required fields", () => {
    fc.assert(
      fc.property(
        arbServices,
        (services) => {
          const agentResponse = buildMockAgentResponse(services);
          const results = parseScanResults(agentResponse);

          expect(results.length).toBe(services.length);

          for (const result of results) {
            expect(typeof result.service).toBe("string");
            expect(result.service.length).toBeGreaterThan(0);

            for (const rec of result.recommendations) {
              expect(typeof rec.resourceId).toBe("string");
              expect(typeof rec.priority).toBe("string");
              expect(["critical", "medium", "low"]).toContain(rec.priority);
              expect(typeof rec.recommendation).toBe("string");
              expect(typeof rec.currentCost).toBe("number");
              expect(typeof rec.estimatedSavings).toBe("number");
              expect(typeof rec.effort).toBe("string");
              expect(["low", "medium", "high"]).toContain(rec.effort);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 15: Scan state machine validity ────────────────────────────────

describe("Property 15: Scan state machine validity", () => {
  /**
   * Only valid transitions occur, terminal states never transition.
   * Valid: pending → running, pending → failed, running → completed, running → failed.
   * Invalid: completed → *, failed → *, running → pending, etc.
   *
   * Validates: Requirements 3.1, 8.2
   */

  const allStates = ["pending", "running", "completed", "failed"];

  it("valid transitions are accepted", () => {
    const validTransitions: [string, string][] = [
      ["pending", "running"],
      ["pending", "failed"],
      ["running", "completed"],
      ["running", "failed"],
    ];

    for (const [from, to] of validTransitions) {
      expect(isValidTransition(from, to)).toBe(true);
    }
  });

  it("terminal states (completed, failed) never transition to any state", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allStates),
        (targetState) => {
          expect(isValidTransition("completed", targetState)).toBe(false);
          expect(isValidTransition("failed", targetState)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("no invalid transitions are accepted", () => {
    const invalidTransitions: [string, string][] = [
      ["running", "pending"],
      ["completed", "pending"],
      ["completed", "running"],
      ["completed", "failed"],
      ["failed", "pending"],
      ["failed", "running"],
      ["failed", "completed"],
      ["pending", "completed"],  // must go through running first
    ];

    for (const [from, to] of invalidTransitions) {
      expect(isValidTransition(from, to)).toBe(false);
    }
  });

  it("for any pair of states, transition validity is deterministic", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allStates),
        fc.constantFrom(...allStates),
        (from, to) => {
          const result1 = isValidTransition(from, to);
          const result2 = isValidTransition(from, to);
          expect(result1).toBe(result2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("unknown states are rejected", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }).filter(
          (s) => !allStates.includes(s),
        ),
        fc.constantFrom(...allStates),
        (unknownState, validState) => {
          expect(isValidTransition(unknownState, validState)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 8: Deep dive chat prompt includes service context ──────────────

describe("Property 8: Deep dive chat prompt includes service context", () => {
  /**
   * For any service name and non-empty recommendations set, verify the generated
   * system prompt contains the service name and JSON representation of recommendations.
   *
   * Validates: Requirements 6.5
   */

  /** Generate an arbitrary recommendation for the chat prompt. */
  const arbChatRecommendation = fc.record({
    resourceId: fc.string({ minLength: 1, maxLength: 30 }),
    resourceName: fc.option(fc.string({ minLength: 1, maxLength: 50 }), { nil: null }),
    priority: fc.constantFrom("critical", "medium", "low"),
    recommendation: fc.string({ minLength: 1, maxLength: 200 }),
    currentCost: fc.float({ min: 0, max: 10000, noNaN: true }),
    estimatedSavings: fc.float({ min: 0, max: 10000, noNaN: true }),
    effort: fc.constantFrom("low", "medium", "high"),
    metadata: fc.constant({}),
  });

  it("prompt contains the service name for any service and non-empty recommendations", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("EC2", "RDS", "S3", "Lambda", "CloudWatch", "NAT Gateway", "CloudTrail", "ECS"),
        fc.array(arbChatRecommendation, { minLength: 1, maxLength: 5 }),
        arbAwsAccountId,
        arbRegions,
        (serviceName, recommendations, awsAccountId, regions) => {
          const prompt = buildDeepDiveChatPrompt({
            accountName: "Test Account",
            awsAccountId,
            serviceName,
            regions,
            recommendations,
          });

          // Service name appears in the prompt
          expect(prompt).toContain(serviceName);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("prompt contains JSON representation of each recommendation's resourceId", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("EC2", "RDS", "S3", "Lambda", "CloudWatch"),
        fc.array(arbChatRecommendation, { minLength: 1, maxLength: 3 }),
        arbAwsAccountId,
        arbRegions,
        (serviceName, recommendations, awsAccountId, regions) => {
          const prompt = buildDeepDiveChatPrompt({
            accountName: "Test Account",
            awsAccountId,
            serviceName,
            regions,
            recommendations,
          });

          // Each recommendation's resourceId should appear in the JSON-encoded output
          for (const rec of recommendations) {
            // Use JSON.stringify to get the escaped form of the resourceId
            const escapedId = JSON.stringify(rec.resourceId);
            expect(prompt).toContain(escapedId);
          }

          // The prompt should contain the full JSON block of recommendations
          const jsonStr = JSON.stringify(recommendations, null, 2);
          expect(prompt).toContain(jsonStr);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("prompt includes account context (account name, AWS account ID, regions)", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("EC2", "RDS", "S3"),
        fc.array(arbChatRecommendation, { minLength: 1, maxLength: 2 }),
        arbAwsAccountId,
        arbRegions,
        fc.string({ minLength: 1, maxLength: 50 }),
        (serviceName, recommendations, awsAccountId, regions, accountName) => {
          const prompt = buildDeepDiveChatPrompt({
            accountName,
            awsAccountId,
            serviceName,
            regions,
            recommendations,
          });

          expect(prompt).toContain(accountName);
          expect(prompt).toContain(awsAccountId);
          for (const region of regions) {
            expect(prompt).toContain(region);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
