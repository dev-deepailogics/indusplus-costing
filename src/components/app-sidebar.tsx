"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, ListTree } from "lucide-react";

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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { PARAMETER_TABLES } from "@/lib/parameters/registry";
import { UserMenu } from "@/components/auth/user-menu";
import { useAuth } from "@/lib/auth/auth-provider";
import {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

export function AppSidebar() {
  const pathname = usePathname();
  const { role } = useAuth();
  const isAdmin = role === "admin";

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
        <SidebarGroup>
          <SidebarGroupLabel>Pre-Order Costing</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === "/style-master"}
                    render={<Link href="/style-master" />}
                  >
                    <span>Style Master</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/cost-sheet"}
                  render={<Link href="/cost-sheet" />}
                >
                  <span>Cost Sheet Calculator</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname === "/cost-sheets"}
                  render={<Link href="/cost-sheets" />}
                >
                  <span>Saved Cost Sheets</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    isActive={pathname === "/users"}
                    render={<Link href="/users" />}
                  >
                    <span>Manage Users</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel className="flex items-center gap-2">
              <ListTree className="size-4" />
              <span>POC Parameters</span>
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                
                {/* Grid Item and Dropdown */}
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full text-left outline-none">
                      <SidebarMenuButton
                        isActive={pathname.startsWith("/parameters/styles") || pathname.startsWith("/parameters/cut-to-ship-grid") || pathname.startsWith("/parameters/rejection-grid")}
                        className="w-full justify-between"
                      >
                        <span>Grid</span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-52 animate-none" side="right" align="start">
                      {["styles", "cut-to-ship-grid", "rejection-grid"].map((slug) => {
                        const table = PARAMETER_TABLES.find((t) => t.slug === slug);
                        if (!table) return null;
                        const href = `/parameters/${table.slug}`;
                        return (
                          <DropdownMenuItem key={table.slug} className="p-0">
                            <Link
                              href={href}
                              className={cn(
                                "w-full cursor-pointer px-2 py-1.5 text-xs rounded block",
                                pathname === href && "bg-accent font-semibold text-accent-foreground"
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

                {/* Value Item and Dropdown */}
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full text-left outline-none">
                      <SidebarMenuButton
                        isActive={[
                          "customer-commission",
                          "cost-as-percent-of-sales",
                          "direct-labour-foh",
                          "admin-selling",
                          "other-expenses",
                        ].some((slug) => pathname.startsWith(`/parameters/${slug}`))}
                        className="w-full justify-between"
                      >
                        <span>Value</span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-52 animate-none" side="right" align="start">
                      {[
                        "customer-commission",
                        "cost-as-percent-of-sales",
                        "direct-labour-foh",
                        "admin-selling",
                        "other-expenses",
                      ].map((slug) => {
                        const table = PARAMETER_TABLES.find((t) => t.slug === slug);
                        if (!table) return null;
                        const href = `/parameters/${table.slug}`;
                        return (
                          <DropdownMenuItem key={table.slug} className="p-0">
                            <Link
                              href={href}
                              className={cn(
                                "w-full cursor-pointer px-2 py-1.5 text-xs rounded block",
                                pathname === href && "bg-accent font-semibold text-accent-foreground"
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

                {/* Type Item and Dropdown */}
                <SidebarMenuItem>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="w-full text-left outline-none">
                      <SidebarMenuButton
                        isActive={pathname.startsWith("/parameters/order-type") || pathname.startsWith("/parameters/dropdown-lists")}
                        className="w-full justify-between"
                      >
                        <span>Type</span>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-52 animate-none" side="right" align="start">
                      {["order-type", "dropdown-lists"].map((slug) => {
                        const table = PARAMETER_TABLES.find((t) => t.slug === slug);
                        if (!table) return null;
                        const href = `/parameters/${table.slug}`;
                        return (
                          <DropdownMenuItem key={table.slug} className="p-0">
                            <Link
                              href={href}
                              className={cn(
                                "w-full cursor-pointer px-2 py-1.5 text-xs rounded block",
                                pathname === href && "bg-accent font-semibold text-accent-foreground"
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

              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <UserMenu />
    </Sidebar>
  );
}
