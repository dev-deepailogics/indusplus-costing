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
import { PARAMETER_TABLES } from "@/lib/parameters/registry";
import { UserMenu } from "@/components/auth/user-menu";

export function AppSidebar() {
  const pathname = usePathname();

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
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel
              render={
                <CollapsibleTrigger className="flex w-full items-center gap-2">
                  <ListTree />
                  <span>POC Parameters</span>
                  <ChevronRight className="ml-auto transition-transform group-data-[panel-open]/collapsible:rotate-90" />
                </CollapsibleTrigger>
              }
            />
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {PARAMETER_TABLES.map((table) => {
                    const href = `/parameters/${table.slug}`;
                    return (
                      <SidebarMenuItem key={table.slug}>
                        <SidebarMenuButton
                          isActive={pathname === href}
                          render={<Link href={href} />}
                        >
                          <span>{table.title}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>
      <UserMenu />
    </Sidebar>
  );
}
