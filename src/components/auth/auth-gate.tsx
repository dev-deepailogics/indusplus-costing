"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";
import { AuthService } from "@/features/auth/services/AuthService";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, LogOut, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

const PUBLIC_ROUTES = ["/login"];

/**
 * Check if a route is allowed for the user based on their permissions.
 */
function isRouteAllowed(
  pathname: string,
  can: (section: string, action: "view" | "create" | "edit" | "delete" | "approve") => boolean,
): boolean {
  if (PUBLIC_ROUTES.includes(pathname)) return true;
  if (pathname === "/" || pathname === "") return true;

  // /cost-sheet can be viewed if user has view permission on ANY cost sheet section, approval, or cost_sheets page
  if (pathname === "/cost-sheet" || pathname.startsWith("/cost-sheet/")) {
    return (
      can("page_cost_sheets", "view") ||
      can("cost_sheets", "view") ||
      can("section_header", "view") ||
      can("cost_sheet_editor", "view") ||
      can("section_fabric", "view") ||
      can("section_pocket_lining", "view") ||
      can("section_trims", "view") ||
      can("section_chemicals", "view") ||
      can("section_special_charges", "view") ||
      can("section_sam_labor", "view") ||
      can("section_profitability", "view") ||
      can("approval_fabric", "view") ||
      can("approval_mmc", "view") ||
      can("approval_ie", "view") ||
      can("approval_washing", "view") ||
      can("approval_marketing", "view") ||
      can("approval_costing_head", "view") ||
      can("approval_director", "view")
    );
  }

  if (pathname === "/cost-sheets" || pathname.startsWith("/cost-sheets/")) {
    return can("page_cost_sheets", "view") || can("cost_sheets", "view");
  }

  if (pathname.startsWith("/parameters")) {
    return can("page_parameters", "view") || can("parameters", "view");
  }

  if (pathname === "/users" || pathname.startsWith("/users/")) {
    return can("page_users", "view") || can("users", "view");
  }

  if (pathname === "/roles" || pathname.startsWith("/roles/")) {
    return can("page_roles", "view") || can("roles", "view");
  }

  if (pathname === "/teams" || pathname.startsWith("/teams/")) {
    return can("page_teams", "view") || can("teams", "view");
  }

  return true;
}

/**
 * Find default landing route for user based on their permissions.
 */
function getDefaultLandingRoute(
  can: (section: string, action: "view" | "create" | "edit" | "delete" | "approve") => boolean,
): string {
  if (can("page_cost_sheets", "view") || can("cost_sheets", "view")) return "/cost-sheets";
  if (can("page_parameters", "view") || can("parameters", "view")) return "/parameters";
  if (can("section_header", "view") || can("cost_sheet_editor", "view")) return "/cost-sheet";
  if (can("page_roles", "view") || can("roles", "view")) return "/roles";
  if (can("page_users", "view") || can("users", "view")) return "/users";
  if (can("page_teams", "view") || can("teams", "view")) return "/teams";
  return "/cost-sheets";
}

// ─── Force Password Reset Form (when mustResetPassword is true) ───────
function ForcePasswordResetModal({ onComplete }: { onComplete: () => void }) {
  const { user, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await AuthService.resetPassword(currentPassword, newPassword);
      toast.success("Password updated successfully! Welcome to Indus Plus Costing.");
      onComplete();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <Card className="w-full max-w-md shadow-2xl border-indigo-100 dark:border-slate-800 animate-in fade-in-0 zoom-in-95 duration-200">
        <CardHeader className="text-center pb-3">
          <div className="mx-auto mb-2 p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 w-fit">
            <Lock className="size-7" />
          </div>
          <CardTitle className="text-xl font-bold">Password Reset Required</CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-1">
            Hello <span className="font-semibold text-foreground">{user?.displayName || user?.email}</span>. As a security requirement for your account, you must change your temporary password before proceeding.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleReset} className="space-y-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="force-current-pwd" className="text-xs font-semibold">
                Current Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="force-current-pwd"
                type="password"
                required
                placeholder="Enter current / temporary password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="force-new-pwd" className="text-xs font-semibold">
                New Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="force-new-pwd"
                type="password"
                required
                minLength={6}
                placeholder="Enter new password (min. 6 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="force-confirm-pwd" className="text-xs font-semibold">
                Confirm New Password <span className="text-red-500">*</span>
              </Label>
              <Input
                id="force-confirm-pwd"
                type="password"
                required
                minLength={6}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="text-sm"
              />
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs font-semibold"
              >
                {loading ? "Updating Password…" : "Set New Password & Continue"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => logout()}
                className="w-full text-xs text-muted-foreground hover:text-red-600"
              >
                <LogOut className="size-3.5 mr-1" />
                Sign Out
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main AuthGate Component ──────────────────────────────────────────
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, role, loading, can, refreshUser } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  const allowed = isRouteAllowed(pathname, can);
  const isForbidden = !!user && !isPublicRoute && !allowed;

  useEffect(() => {
    if (loading) return;

    if (!user && !isPublicRoute) {
      router.replace("/login");
    } else if (user && isPublicRoute && !user.mustResetPassword) {
      const target = getDefaultLandingRoute(can);
      router.replace(target);
    } else if (isForbidden && !user.mustResetPassword) {
      const target = getDefaultLandingRoute(can);
      router.replace(target);
    }
  }, [user, role, loading, isPublicRoute, isForbidden, router, can]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
    );
  }

  if (!user && !isPublicRoute) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
    );
  }

  // If user is authenticated but MUST reset their password, show force reset modal
  if (user && user.mustResetPassword) {
    return (
      <>
        <ForcePasswordResetModal
          onComplete={async () => {
            await refreshUser();
            const target = getDefaultLandingRoute(can);
            router.replace(target);
          }}
        />
        {/* Render child background softly blurred */}
        <div className="opacity-30 pointer-events-none select-none">{children}</div>
      </>
    );
  }

  if (user && isPublicRoute) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
    );
  }

  if (isForbidden) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
        <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-600">
          <ShieldAlert className="size-8" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Access Restricted</h2>
          <p className="text-sm text-muted-foreground max-w-sm mt-1">
            Your role does not have permission to view this section.
          </p>
        </div>
        <Button onClick={() => router.replace(getDefaultLandingRoute(can))}>
          Go to Dashboard
        </Button>
      </div>
    );
  }

  return <>{children}</>;
}
