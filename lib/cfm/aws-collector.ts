import "server-only";

import type { Credentials } from "@aws-sdk/client-sts";
import {
  EC2Client,
  DescribeInstancesCommand,
  DescribeNatGatewaysCommand,
} from "@aws-sdk/client-ec2";
import {
  RDSClient,
  DescribeDBInstancesCommand,
} from "@aws-sdk/client-rds";
import { S3Client, ListBucketsCommand } from "@aws-sdk/client-s3";
import {
  LambdaClient,
  ListFunctionsCommand,
} from "@aws-sdk/client-lambda";
import {
  CloudWatchClient,
  GetMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import {
  CostExplorerClient,
  GetCostAndUsageCommand,
} from "@aws-sdk/client-cost-explorer";
import {
  CloudTrailClient,
  DescribeTrailsCommand,
} from "@aws-sdk/client-cloudtrail";
import {
  ECSClient,
  ListClustersCommand,
  DescribeClustersCommand,
} from "@aws-sdk/client-ecs";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CollectedAccountData {
  costByService: Record<string, number>;
  services: CollectedServiceData[];
}

export interface CollectedServiceData {
  service: string;
  region: string;
  resources: Record<string, unknown>[];
}

// ─── Credential Helper ─────────────────────────────────────────────────────

function makeCredentials(stsCreds: Credentials) {
  return {
    accessKeyId: stsCreds.AccessKeyId!,
    secretAccessKey: stsCreds.SecretAccessKey!,
    sessionToken: stsCreds.SessionToken!,
  };
}

// ─── CloudWatch Metric Batching ─────────────────────────────────────────────

interface MetricQuery {
  id: string;
  namespace: string;
  metricName: string;
  dimensions: Array<{ Name: string; Value: string }>;
}

async function getMetricAverages(
  cwClient: CloudWatchClient,
  queries: MetricQuery[],
  days = 14,
): Promise<Map<string, number>> {
  if (queries.length === 0) return new Map();

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - days * 86400000);
  const results = new Map<string, number>();

  // GetMetricData supports up to 500 queries per call
  for (let i = 0; i < queries.length; i += 500) {
    const batch = queries.slice(i, i + 500);
    try {
      const response = await cwClient.send(
        new GetMetricDataCommand({
          MetricDataQueries: batch.map((q) => ({
            Id: q.id,
            MetricStat: {
              Metric: {
                Namespace: q.namespace,
                MetricName: q.metricName,
                Dimensions: q.dimensions,
              },
              Period: 86400,
              Stat: "Average",
            },
          })),
          StartTime: startTime,
          EndTime: endTime,
        }),
      );

      for (const r of response.MetricDataResults ?? []) {
        if (r.Id && r.Values && r.Values.length > 0) {
          const avg = r.Values.reduce((a, b) => a + b, 0) / r.Values.length;
          results.set(r.Id, Math.round(avg * 100) / 100);
        }
      }
    } catch {
      // CloudWatch metrics are supplementary — skip on failure
    }
  }

  return results;
}

/** Sanitize metric query IDs (must be lowercase alphanumeric + underscore, start with letter) */
function metricId(prefix: string, resourceId: string): string {
  return (prefix + "_" + resourceId)
    .replace(/[^a-zA-Z0-9_]/g, "_")
    .toLowerCase()
    .slice(0, 255);
}

// ─── Cost Explorer ──────────────────────────────────────────────────────────

async function collectCostData(
  credentials: ReturnType<typeof makeCredentials>,
): Promise<Record<string, number>> {
  const client = new CostExplorerClient({
    region: "us-east-1", // Cost Explorer is always us-east-1
    credentials,
  });

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 30 * 86400000);

  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  try {
    const response = await client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: fmt(startDate), End: fmt(endDate) },
        Granularity: "MONTHLY",
        Metrics: ["BlendedCost"],
        GroupBy: [{ Type: "DIMENSION", Key: "SERVICE" }],
      }),
    );

    const costs: Record<string, number> = {};
    for (const group of response.ResultsByTime?.[0]?.Groups ?? []) {
      const serviceName = group.Keys?.[0] ?? "Unknown";
      const amount = Number(group.Metrics?.BlendedCost?.Amount ?? 0);
      if (amount > 0.01) {
        costs[serviceName] = Math.round(amount * 100) / 100;
      }
    }
    return costs;
  } catch (err) {
    console.warn("[CFM Collector] Cost Explorer failed:", (err as Error).message);
    return {};
  }
}

// ─── EC2 Collector ──────────────────────────────────────────────────────────

async function collectEC2(
  credentials: ReturnType<typeof makeCredentials>,
  cwClient: CloudWatchClient,
  region: string,
): Promise<Record<string, unknown>[]> {
  const ec2 = new EC2Client({ region, credentials });

  try {
    const response = await ec2.send(new DescribeInstancesCommand({}));
    const instances: Array<{
      id: string;
      type: string;
      state: string;
      name: string;
      launchTime: string;
      avgCpu?: number;
    }> = [];

    for (const reservation of response.Reservations ?? []) {
      for (const inst of reservation.Instances ?? []) {
        if (!inst.InstanceId) continue;
        const nameTag = inst.Tags?.find((t) => t.Key === "Name")?.Value;
        instances.push({
          id: inst.InstanceId,
          type: inst.InstanceType ?? "unknown",
          state: inst.State?.Name ?? "unknown",
          name: nameTag ?? "",
          launchTime: inst.LaunchTime?.toISOString() ?? "",
        });
      }
    }

    // Batch-fetch CPU metrics
    if (instances.length > 0) {
      const queries: MetricQuery[] = instances
        .filter((i) => i.state === "running")
        .slice(0, 200) // Cap to avoid huge CloudWatch queries
        .map((i) => ({
          id: metricId("ec2cpu", i.id),
          namespace: "AWS/EC2",
          metricName: "CPUUtilization",
          dimensions: [{ Name: "InstanceId", Value: i.id }],
        }));

      const cpuMetrics = await getMetricAverages(cwClient, queries);

      for (const inst of instances) {
        const key = metricId("ec2cpu", inst.id);
        if (cpuMetrics.has(key)) {
          inst.avgCpu = cpuMetrics.get(key);
        }
      }
    }

    return instances;
  } catch (err) {
    console.warn(`[CFM Collector] EC2 ${region} failed:`, (err as Error).message);
    return [];
  }
}

// ─── RDS Collector ──────────────────────────────────────────────────────────

async function collectRDS(
  credentials: ReturnType<typeof makeCredentials>,
  cwClient: CloudWatchClient,
  region: string,
): Promise<Record<string, unknown>[]> {
  const rds = new RDSClient({ region, credentials });

  try {
    const response = await rds.send(new DescribeDBInstancesCommand({}));
    const instances: Array<{
      id: string;
      class: string;
      engine: string;
      status: string;
      multiAz: boolean;
      storageGb: number;
      avgConnections?: number;
      avgCpu?: number;
    }> = [];

    for (const db of response.DBInstances ?? []) {
      if (!db.DBInstanceIdentifier) continue;
      instances.push({
        id: db.DBInstanceIdentifier,
        class: db.DBInstanceClass ?? "unknown",
        engine: `${db.Engine ?? "unknown"} ${db.EngineVersion ?? ""}`.trim(),
        status: db.DBInstanceStatus ?? "unknown",
        multiAz: db.MultiAZ ?? false,
        storageGb: db.AllocatedStorage ?? 0,
      });
    }

    // Batch-fetch metrics
    if (instances.length > 0) {
      const queries: MetricQuery[] = [];
      for (const inst of instances.slice(0, 100)) {
        queries.push({
          id: metricId("rdsconn", inst.id),
          namespace: "AWS/RDS",
          metricName: "DatabaseConnections",
          dimensions: [{ Name: "DBInstanceIdentifier", Value: inst.id }],
        });
        queries.push({
          id: metricId("rdscpu", inst.id),
          namespace: "AWS/RDS",
          metricName: "CPUUtilization",
          dimensions: [{ Name: "DBInstanceIdentifier", Value: inst.id }],
        });
      }

      const metrics = await getMetricAverages(cwClient, queries);

      for (const inst of instances) {
        const connKey = metricId("rdsconn", inst.id);
        const cpuKey = metricId("rdscpu", inst.id);
        if (metrics.has(connKey)) inst.avgConnections = metrics.get(connKey);
        if (metrics.has(cpuKey)) inst.avgCpu = metrics.get(cpuKey);
      }
    }

    return instances;
  } catch (err) {
    console.warn(`[CFM Collector] RDS ${region} failed:`, (err as Error).message);
    return [];
  }
}

// ─── S3 Collector ───────────────────────────────────────────────────────────

async function collectS3(
  credentials: ReturnType<typeof makeCredentials>,
): Promise<Record<string, unknown>[]> {
  // S3 ListBuckets is global — use us-east-1
  const s3 = new S3Client({ region: "us-east-1", credentials });

  try {
    const response = await s3.send(new ListBucketsCommand({}));
    return (response.Buckets ?? []).map((b) => ({
      name: b.Name ?? "unknown",
      createdAt: b.CreationDate?.toISOString() ?? "",
    }));
  } catch (err) {
    console.warn("[CFM Collector] S3 failed:", (err as Error).message);
    return [];
  }
}

// ─── Lambda Collector ───────────────────────────────────────────────────────

async function collectLambda(
  credentials: ReturnType<typeof makeCredentials>,
  cwClient: CloudWatchClient,
  region: string,
): Promise<Record<string, unknown>[]> {
  const lambda = new LambdaClient({ region, credentials });

  try {
    const response = await lambda.send(new ListFunctionsCommand({}));
    const functions: Array<{
      name: string;
      runtime: string;
      memoryMb: number;
      codeSizeBytes: number;
      lastModified: string;
      avgDuration?: number;
      invocations?: number;
    }> = [];

    for (const fn of response.Functions ?? []) {
      if (!fn.FunctionName) continue;
      functions.push({
        name: fn.FunctionName,
        runtime: fn.Runtime ?? "unknown",
        memoryMb: fn.MemorySize ?? 128,
        codeSizeBytes: Number(fn.CodeSize ?? 0),
        lastModified: fn.LastModified ?? "",
      });
    }

    // Batch-fetch metrics
    if (functions.length > 0) {
      const queries: MetricQuery[] = [];
      for (const fn of functions.slice(0, 100)) {
        queries.push({
          id: metricId("lamdur", fn.name),
          namespace: "AWS/Lambda",
          metricName: "Duration",
          dimensions: [{ Name: "FunctionName", Value: fn.name }],
        });
        queries.push({
          id: metricId("laminv", fn.name),
          namespace: "AWS/Lambda",
          metricName: "Invocations",
          dimensions: [{ Name: "FunctionName", Value: fn.name }],
        });
      }

      const metrics = await getMetricAverages(cwClient, queries);

      for (const fn of functions) {
        const durKey = metricId("lamdur", fn.name);
        const invKey = metricId("laminv", fn.name);
        if (metrics.has(durKey)) fn.avgDuration = metrics.get(durKey);
        if (metrics.has(invKey)) fn.invocations = metrics.get(invKey);
      }
    }

    return functions;
  } catch (err) {
    console.warn(`[CFM Collector] Lambda ${region} failed:`, (err as Error).message);
    return [];
  }
}

// ─── NAT Gateway Collector ──────────────────────────────────────────────────

async function collectNATGateway(
  credentials: ReturnType<typeof makeCredentials>,
  region: string,
): Promise<Record<string, unknown>[]> {
  const ec2 = new EC2Client({ region, credentials });

  try {
    const response = await ec2.send(new DescribeNatGatewaysCommand({}));
    return (response.NatGateways ?? []).map((ngw) => ({
      id: ngw.NatGatewayId ?? "unknown",
      state: ngw.State ?? "unknown",
      subnetId: ngw.SubnetId ?? "",
      vpcId: ngw.VpcId ?? "",
      type: ngw.ConnectivityType ?? "public",
    }));
  } catch (err) {
    console.warn(`[CFM Collector] NAT Gateway ${region} failed:`, (err as Error).message);
    return [];
  }
}

// ─── CloudTrail Collector ───────────────────────────────────────────────────

async function collectCloudTrail(
  credentials: ReturnType<typeof makeCredentials>,
  region: string,
): Promise<Record<string, unknown>[]> {
  const ct = new CloudTrailClient({ region, credentials });

  try {
    const response = await ct.send(new DescribeTrailsCommand({}));
    return (response.trailList ?? []).map((trail) => ({
      name: trail.Name ?? "unknown",
      isMultiRegion: trail.IsMultiRegionTrail ?? false,
      s3BucketName: trail.S3BucketName ?? "",
      hasLogFileValidation: trail.LogFileValidationEnabled ?? false,
    }));
  } catch (err) {
    console.warn(`[CFM Collector] CloudTrail ${region} failed:`, (err as Error).message);
    return [];
  }
}

// ─── ECS Collector ──────────────────────────────────────────────────────────

async function collectECS(
  credentials: ReturnType<typeof makeCredentials>,
  region: string,
): Promise<Record<string, unknown>[]> {
  const ecs = new ECSClient({ region, credentials });

  try {
    const listResponse = await ecs.send(new ListClustersCommand({}));
    const clusterArns = listResponse.clusterArns ?? [];
    if (clusterArns.length === 0) return [];

    const descResponse = await ecs.send(
      new DescribeClustersCommand({ clusters: clusterArns }),
    );
    return (descResponse.clusters ?? []).map((c) => ({
      name: c.clusterName ?? "unknown",
      status: c.status ?? "unknown",
      runningTasks: c.runningTasksCount ?? 0,
      activeServices: c.activeServicesCount ?? 0,
      registeredInstances: c.registeredContainerInstancesCount ?? 0,
    }));
  } catch (err) {
    console.warn(`[CFM Collector] ECS ${region} failed:`, (err as Error).message);
    return [];
  }
}

// ─── CloudWatch Collector (alarms summary) ──────────────────────────────────

async function collectCloudWatch(
  cwClient: CloudWatchClient,
  region: string,
): Promise<Record<string, unknown>[]> {
  try {
    // Import DescribeAlarmsCommand here to avoid adding to top-level imports
    const { DescribeAlarmsCommand } = await import("@aws-sdk/client-cloudwatch");
    const response = await cwClient.send(
      new DescribeAlarmsCommand({ MaxRecords: 100 }),
    );

    const alarms = (response.MetricAlarms ?? []).map((a) => ({
      name: a.AlarmName ?? "unknown",
      namespace: a.Namespace ?? "",
      metricName: a.MetricName ?? "",
      state: a.StateValue ?? "unknown",
    }));

    return alarms;
  } catch (err) {
    console.warn(`[CFM Collector] CloudWatch ${region} failed:`, (err as Error).message);
    return [];
  }
}

// ─── Service Collector Router ───────────────────────────────────────────────

const SERVICE_MAP: Record<
  string,
  (
    credentials: ReturnType<typeof makeCredentials>,
    cwClient: CloudWatchClient,
    region: string,
  ) => Promise<Record<string, unknown>[]>
> = {
  EC2: collectEC2,
  RDS: collectRDS,
  Lambda: collectLambda,
  "NAT Gateway": (creds, _cw, region) => collectNATGateway(creds, region),
  CloudTrail: (creds, _cw, region) => collectCloudTrail(creds, region),
  ECS: (creds, _cw, region) => collectECS(creds, region),
  CloudWatch: (_creds, cwClient, region) =>
    collectCloudWatch(cwClient, region),
};

// ─── Main Collector ─────────────────────────────────────────────────────────

/**
 * Pre-fetch AWS resource data using assumed role credentials.
 * Collects resource inventories and CloudWatch metrics per service/region.
 * Failures per service are logged but don't block the overall collection.
 */
export async function collectAccountData(
  stsCreds: Credentials,
  regions: string[],
  services: string[],
  onProgress?: (service: string, status: string) => void,
): Promise<CollectedAccountData> {
  const credentials = makeCredentials(stsCreds);

  // 1. Cost Explorer data (always from us-east-1, not region-specific)
  onProgress?.("Cost Explorer", "collecting");
  const costByService = await collectCostData(credentials);
  onProgress?.("Cost Explorer", "done");

  // 2. S3 is global (not per-region) — collect once
  let s3Data: Record<string, unknown>[] = [];
  if (services.some((s) => s.toUpperCase() === "S3")) {
    onProgress?.("S3", "collecting");
    s3Data = await collectS3(credentials);
    onProgress?.("S3", "done");
  }

  // 3. Collect per-service data across all regions in parallel
  const serviceDataResults: CollectedServiceData[] = [];

  const regionPromises = regions.map(async (region) => {
    const cwClient = new CloudWatchClient({ region, credentials });
    const regionResults: CollectedServiceData[] = [];

    const servicePromises = services
      .filter((s) => s.toUpperCase() !== "S3") // S3 already collected
      .map(async (service) => {
        const collector = SERVICE_MAP[service];
        if (!collector) {
          console.warn(`[CFM Collector] No collector for service: ${service}`);
          return;
        }

        onProgress?.(service, `collecting (${region})`);
        const resources = await collector(credentials, cwClient, region);
        onProgress?.(service, `done (${region})`);

        if (resources.length > 0) {
          regionResults.push({ service, region, resources });
        }
      });

    await Promise.all(servicePromises);
    return regionResults;
  });

  const allRegionResults = await Promise.all(regionPromises);
  for (const regionResults of allRegionResults) {
    serviceDataResults.push(...regionResults);
  }

  // Add S3 data (global, not region-specific)
  if (s3Data.length > 0) {
    serviceDataResults.push({
      service: "S3",
      region: "global",
      resources: s3Data,
    });
  }

  return { costByService, services: serviceDataResults };
}

/**
 * Format collected data as a concise text block for inclusion in the agent prompt.
 */
export function formatCollectedData(data: CollectedAccountData): string {
  const sections: string[] = [];

  // Cost summary
  if (Object.keys(data.costByService).length > 0) {
    const sortedCosts = Object.entries(data.costByService)
      .sort(([, a], [, b]) => b - a);
    const totalCost = sortedCosts.reduce((sum, [, v]) => sum + v, 0);

    sections.push(
      "### Monthly Cost by Service (Last 30 Days)",
      `Total: $${totalCost.toFixed(2)}`,
      "```json",
      JSON.stringify(Object.fromEntries(sortedCosts), null, 2),
      "```",
    );
  } else {
    sections.push(
      "### Monthly Cost by Service",
      "Cost Explorer data unavailable (insufficient permissions or no spend in period).",
    );
  }

  // Resource data per service
  for (const svc of data.services) {
    const header =
      svc.region === "global"
        ? `### ${svc.service} Resources`
        : `### ${svc.service} Resources (${svc.region})`;

    sections.push(
      header,
      `${svc.resources.length} resource(s) found:`,
      "```json",
      JSON.stringify(svc.resources, null, 2),
      "```",
    );
  }

  if (data.services.length === 0) {
    sections.push(
      "### Resource Inventory",
      "No resources found across the analyzed services and regions.",
    );
  }

  return sections.join("\n");
}
