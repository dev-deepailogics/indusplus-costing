"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import {
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "../context/AuthProvider";
import { AuthService } from "../services/AuthService";

function initialsFor(user: { displayName: string | null; email: string | null }) {
  if (user.displayName) {
    return user.displayName
      .split(" ")
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  return user.email?.[0]?.toUpperCase() ?? "?";
}

export function UserMenu() {
  const { user } = useAuth();
  const router = useRouter();

  if (!user) return null;

  async function handleSignOut() {
    try {
      await AuthService.signOut();
      router.replace("/login");
      toast.success("Signed out");
    } catch (err) {
      console.error("Sign out error:", err);
      toast.error("Failed to sign out");
    }
  }

  return (
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton size="lg">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                    {initialsFor(user)}
                  </span>
                  <span className="flex flex-col overflow-hidden text-left">
                    <span className="truncate text-sm font-medium">
                      {user.displayName ?? user.email}
                    </span>
                    {user.displayName && (
                      <span className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    )}
                  </span>
                </SidebarMenuButton>
              }
            />
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 size-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}
