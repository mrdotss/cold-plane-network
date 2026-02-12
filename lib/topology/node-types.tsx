"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  CloudIcon,
  GridIcon,
  RouterIcon,
  FirewallIcon,
  HierarchyIcon,
  CloudServerIcon,
  BalanceScaleIcon,
  ApiGatewayIcon,
  GlobeIcon,
  SecurityWifiIcon,
  ConnectIcon,
  FlowConnectionIcon,
  Route01Icon,
  ShieldIcon,
  DatabaseIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

/** Map resource types to hugeicons and colors. */
const RESOURCE_STYLE_MAP: Record<
  string,
  { icon: IconSvgElement; color: string; bg: string }
> = {
  vpc: { icon: CloudIcon, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950" },
  subnet: { icon: GridIcon, color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-950" },
  router: { icon: RouterIcon, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-950" },
  firewall: { icon: FirewallIcon, color: "text-red-500", bg: "bg-red-50 dark:bg-red-950" },
  switch: { icon: HierarchyIcon, color: "text-purple-500", bg: "bg-purple-50 dark:bg-purple-950" },
  server: { icon: CloudServerIcon, color: "text-green-500", bg: "bg-green-50 dark:bg-green-950" },
  loadbalancer: { icon: BalanceScaleIcon, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-950" },
  gateway: { icon: ApiGatewayIcon, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-950" },
  dns: { icon: GlobeIcon, color: "text-teal-500", bg: "bg-teal-50 dark:bg-teal-950" },
  vpn: { icon: SecurityWifiIcon, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950" },
  nat: { icon: ConnectIcon, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950" },
  peering: { icon: FlowConnectionIcon, color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-950" },
  endpoint: { icon: DatabaseIcon, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950" },
  securitygroup: { icon: ShieldIcon, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-950" },
  routetable: { icon: Route01Icon, color: "text-sky-500", bg: "bg-sky-50 dark:bg-sky-950" },
};

const DEFAULT_STYLE = {
  icon: HierarchyIcon,
  color: "text-neutral-500",
  bg: "bg-neutral-50 dark:bg-neutral-950",
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
        flex items-center gap-2 rounded-md border px-3 py-2
        ${style.bg}
        ${selected ? "ring-2 ring-blue-400 border-blue-400" : "border-neutral-200 dark:border-neutral-800"}
        shadow-sm transition-shadow hover:shadow-md
      `}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-neutral-400" />
      <div className={`flex-shrink-0 ${style.color}`}>
        <HugeiconsIcon icon={style.icon} size={18} />
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
