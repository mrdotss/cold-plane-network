"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"

import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Home01Icon,
  ComputerTerminalIcon,
  ShieldIcon,
  SecurityCheckIcon,
  ChartRingIcon,
  SentIcon,
  CommandIcon,
  ArrowDataTransferHorizontalIcon,
  AiInnovation01Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

const navItems: {
  title: string
  url: string
  icon: IconSvgElement
}[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: Home01Icon,
  },
  {
    title: "Studio",
    url: "/dashboard/studio",
    icon: ComputerTerminalIcon,
  },
  {
    title: "Audit",
    url: "/dashboard/audit",
    icon: ShieldIcon,
  },
  {
    title: "Migration Advisor",
    url: "/dashboard/migration",
    icon: ArrowDataTransferHorizontalIcon,
  },
]

const aiToolsItems: {
  title: string
  url: string
  icon: IconSvgElement
}[] = [
  {
    title: "Sizing",
    url: "/dashboard/sizing",
    icon: AiInnovation01Icon,
  },
  {
    title: "CFM Analysis",
    url: "/dashboard/cfm",
    icon: AiInnovation01Icon,
  },
  {
    title: "CSP Analysis",
    url: "/dashboard/csp",
    icon: SecurityCheckIcon,
  },
]

const secondaryItems = [
  {
    title: "Support",
    url: "mailto:mayer@fatechid.com",
    icon: (
      <HugeiconsIcon icon={ChartRingIcon} strokeWidth={2} />
    ),
  },
  {
    title: "Feedback",
    url: "mailto:mayer@fatechid.com",
    icon: (
      <HugeiconsIcon icon={SentIcon} strokeWidth={2} />
    ),
  },
]

export function AppSidebar({ user, ...props }: React.ComponentProps<typeof Sidebar> & { user: { name: string; email: string } }) {
  const pathname = usePathname()

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/dashboard">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <HugeiconsIcon icon={CommandIcon} strokeWidth={2} className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Cold Plane Network</span>
                  <span className="truncate text-xs">Beta version</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarMenu>
            {navItems.map((item) => {
              const isActive =
                item.url === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.url)

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                    <Link href={item.url}>
                      <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>AI Tools</SidebarGroupLabel>
          <SidebarMenu>
            {aiToolsItems.map((item) => {
              const isActive = pathname.startsWith(item.url)

              return (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={item.title}>
                    <Link href={item.url}>
                      <HugeiconsIcon icon={item.icon} strokeWidth={2} />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
        <NavSecondary items={secondaryItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}
