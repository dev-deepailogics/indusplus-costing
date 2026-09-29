"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronRight,
  ListTree,
  FileSpreadsheet,
  Grid3X3,
  DollarSign,
  Layers,
  Users,
  UserCog,
  UsersRound,
  Shield,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { PARAMETER_TABLES } from "@/lib/parameters/registry";
import { UserMenu } from "@/components/auth/user-menu";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function AppSidebar() {
  const pathname = usePathname();
  const { can } = useAuth();

  const canViewParams = can("parameters", "view");
  const canViewUsers = can("users", "view");
  const canViewRoles = can("roles", "view");
  const canViewTeams = can("teams", "view");
  const canViewCostSheets = can("cost_sheets", "view");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/parameters"
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-sidebar-accent"
        >
          <Image
            src="/logo-icon.png"
            alt="Indus Plus"
            width={28}
            height={28}
            className="shrink-0"
            priority
          />
          <span className="truncate text-sm font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Indus Plus Costing
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {/* Cost Sheets — visible to anyone who can view them */}
        {canViewCostSheets && (
          <SidebarGroup>
            <SidebarGroupLabel>Pre-Order Costing</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Cost Sheets"
                    isActive={pathname === "/cost-sheets"}
                    render={<Link href="/cost-sheets" />}
                  >
                    <FileSpreadsheet className="size-4 shrink-0" />
                    <span>Cost Sheets</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Parameters — visible to users with parameters:view */}
        {canViewParams && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-2">
              <ListTree className="size-4 shrink-0" />
              <span>POC Parameters</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Grid Item and Dropdown */}
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full text-left outline-none">
                      <SidebarMenuButton
                        tooltip="Grid Parameters"
                        isActive={
                          pathname.startsWith("/parameters/styles") ||
                          pathname.startsWith(
                            "/parameters/cut-to-ship-grid",
                          ) ||
                          pathname.startsWith("/parameters/rejection-grid")
                        }
                        className="w-full justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <Grid3X3 className="size-4 shrink-0" />
                          <span>Grid</span>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="w-52 animate-none"
                      side="right"
                      align="start"
                    >
                      {["styles", "cut-to-ship-grid", "rejection-grid"].map(
                        (slug) => {
                          const table = PARAMETER_TABLES.find(
                            (t) => t.slug === slug,
                          );
                          if (!table) return null;
                          const href = `/parameters/${table.slug}`;
                          return (
                            <DropdownMenuItem
                              key={table.slug}
                              className="p-0"
                            >
                              <Link
                                href={href}
                                className={cn(
                                  "w-full cursor-pointer px-2 py-1.5 text-xs rounded block",
                                  pathname === href &&
                                    "bg-accent font-semibold text-accent-foreground",
                                )}
                              >
                                {table.title}
                              </Link>
                            </DropdownMenuItem>
                          );
                        },
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>

                {/* Value Item and Dropdown */}
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full text-left outline-none">
                      <SidebarMenuButton
                        tooltip="Value Parameters"
                        isActive={[
                          "customer-commission",
                          "cost-as-percent-of-sales",
                          "direct-labour-foh",
                          "admin-selling",
                          "other-expenses",
                        ].some((slug) =>
                          pathname.startsWith(`/parameters/${slug}`),
                        )}
                        className="w-full justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <DollarSign className="size-4 shrink-0" />
                          <span>Value</span>
                        </div>
                        <ChevronRight className="size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      className="w-52 animate-none"
                      side="right"
                      align="start"
                    >
                      {[
                        "customer-commission",
                        "cost-as-percent-of-sales",
                        "direct-labour-foh",
                        "admin-selling",
                        "other-expenses",
                      ].map((slug) => {
                        const table = PARAMETER_TABLES.find(
                          (t) => t.slug === slug,
                        );
                        if (!table) return null;
                        const href = `/parameters/${table.slug}`;
                        return (
                          <DropdownMenuItem key={table.slug} className="p-0">
                            <Link
                              href={href}
                              className={cn(
                                "w-full cursor-pointer px-2 py-1.5 text-xs rounded block",
                                pathname === href &&
                                  "bg-accent font-semibold text-accent-foreground",
                              )}
                            >
                              {table.title}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </SidebarMenuItem>

                {/* Dropdown Lists */}
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="Dropdown Lists"
                    isActive={pathname.startsWith("/parameters/dropdown-lists")}
                    render={<Link href="/parameters/dropdown-lists" />}
                  >
                    <Layers className="size-4 shrink-0" />
                    <span>Dropdown Lists</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Management section — Users, Roles, and Teams */}
        {(canViewUsers || canViewRoles || canViewTeams) && (
          <SidebarGroup>
            <SidebarGroupLabel>Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {canViewUsers && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Manage Users"
                      isActive={pathname === "/users"}
                      render={<Link href="/users" />}
                    >
                      <UserCog className="size-4 shrink-0" />
                      <span>Manage Users</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {canViewRoles && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Manage Roles"
                      isActive={pathname === "/roles"}
                      render={<Link href="/roles" />}
                    >
                      <Shield className="size-4 shrink-0" />
                      <span>Manage Roles</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
                {canViewTeams && (
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip="Manage Teams"
                      isActive={pathname === "/teams"}
                      render={<Link href="/teams" />}
                    >
                      <UsersRound className="size-4 shrink-0" />
                      <span>Manage Teams</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <UserMenu />
    </Sidebar>
  );
}
