"use client";

/**
 * Maps Azure resource type categories to colored hugeicons.
 * Used in the Migration Advisor dual-topology canvas for Azure resource nodes.
 */

import { HugeiconsIcon } from "@hugeicons/react";
import type { IconSvgElement } from "@hugeicons/react";
import {
  ComputerIcon,
  GlobeIcon,
  HardDriveIcon,
  ShieldIcon,
  ContainerTruckIcon,
  ChartLineData01Icon,
  Key01Icon,
  DatabaseIcon,
  CloudServerIcon,
} from "@hugeicons/core-free-icons";

/* ─── Category definitions ─── */

export interface AzureIconCategory {
  label: string;
  color: string;
  icon: IconSvgElement;
}

const CATEGORIES: Record<string, AzureIconCategory> = {
  compute:    { label: "Compute",    color: "#f97316", icon: ComputerIcon },
  networking: { label: "Networking", color: "#3b82f6", icon: GlobeIcon },
  storage:    { label: "Storage",    color: "#22c55e", icon: HardDriveIcon },
  security:   { label: "Security",   color: "#ef4444", icon: ShieldIcon },
  containers: { label: "Containers", color: "#14b8a6", icon: ContainerTruckIcon },
  monitoring: { label: "Monitoring", color: "#06b6d4", icon: ChartLineData01Icon },
  identity:   { label: "Identity",   color: "#a855f7", icon: Key01Icon },
  database:   { label: "Database",   color: "#10b981", icon: DatabaseIcon },
};

const DEFAULT_CATEGORY: AzureIconCategory = {
  label: "Other",
  color: "#6b7280",
  icon: CloudServerIcon,
};

/* ─── Azure resource type → category mapping ─── */

/**
 * Maps lowercased Azure resource type prefixes to category keys.
 * Order matters: more specific prefixes should come first.
 */
const TYPE_PREFIX_MAP: Array<[string, string]> = [
  // Compute — specific sub-types first (order matters: more specific before generic)
  ["microsoft.compute/disks", "storage"],
  ["microsoft.compute/snapshots", "storage"],
  ["microsoft.compute/images", "storage"],
  ["microsoft.compute/restorepointcollections", "storage"],
  ["microsoft.compute/virtualmachines", "compute"],
  ["microsoft.compute/virtualmachinescalesets", "compute"],
  ["microsoft.compute/availabilitysets", "compute"],
  ["microsoft.compute/proximityplacementgroups", "compute"],
  ["microsoft.compute/", "compute"],
  ["microsoft.classiccompute/", "compute"],
  ["microsoft.batch/", "compute"],
  ["microsoft.servicefabric/", "compute"],

  // Networking
  ["microsoft.network/", "networking"],
  ["microsoft.cdn/", "networking"],
  ["microsoft.relay/", "networking"],

  // Storage
  ["microsoft.storage/", "storage"],
  ["microsoft.classicstorage/", "storage"],
  ["microsoft.storagesync/", "storage"],
  ["microsoft.netapp/", "storage"],
  ["microsoft.recoveryservices/", "storage"],

  // Security
  ["microsoft.security/", "security"],
  ["microsoft.keyvault/", "security"],

  // Containers
  ["microsoft.containerservice/", "containers"],
  ["microsoft.containerregistry/", "containers"],
  ["microsoft.containerinstance/", "containers"],

  // Monitoring
  ["microsoft.insights/", "monitoring"],
  ["microsoft.operationalinsights/", "monitoring"],
  ["microsoft.operationsmanagement/", "monitoring"],
  ["microsoft.alertsmanagement/", "monitoring"],
  ["microsoft.devtestlab/", "monitoring"],
  ["microsoft.advisor/", "monitoring"],

  // Identity
  ["microsoft.managedidentity/", "identity"],
  ["microsoft.aad/", "identity"],
  ["microsoft.azureactivedirectory/", "identity"],
  ["microsoft.authorization/", "identity"],

  // Database
  ["microsoft.sql/", "database"],
  ["microsoft.dbformysql/", "database"],
  ["microsoft.dbforpostgresql/", "database"],
  ["microsoft.dbformariadb/", "database"],
  ["microsoft.documentdb/", "database"],
  ["microsoft.cache/", "database"],
];

/**
 * Resolve an Azure resource type string to its category.
 * Matches against known provider prefixes (case-insensitive).
 */
export function getAzureResourceCategory(
  azureResourceType: string,
): AzureIconCategory {
  const lower = azureResourceType.toLowerCase();
  for (const [prefix, categoryKey] of TYPE_PREFIX_MAP) {
    if (lower.startsWith(prefix)) {
      return CATEGORIES[categoryKey]!;
    }
  }
  return DEFAULT_CATEGORY;
}

/**
 * Render an Azure resource category icon at the given size with its category color.
 */
export function AzureResourceIcon({
  resourceType,
  size = 20,
  className,
}: {
  resourceType: string;
  size?: number;
  className?: string;
}) {
  const category = getAzureResourceCategory(resourceType);
  return (
    <HugeiconsIcon
      icon={category.icon}
      size={size}
      color={category.color}
      strokeWidth={2}
      className={className}
    />
  );
}

/** Re-export for external use */
export { CATEGORIES as AZURE_CATEGORIES };
