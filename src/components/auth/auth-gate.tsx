"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";
import { canAccessRoute } from "@/lib/auth/roles";
import { Skeleton } from "@/components/ui/skeleton";

const PUBLIC_ROUTES = ["/login"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
  const isForbidden = !!user && !!role && !isPublicRoute && !canAccessRoute(role, pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublicRoute) {
      router.replace("/login");
    } else if (user && isPublicRoute) {
      router.replace(role === "admin" ? "/parameters" : "/cost-sheet");
    } else if (isForbidden) {
      router.replace("/cost-sheet");
    }
  }, [user, role, loading, isPublicRoute, isForbidden, router]);

  if (loading || (!user && !isPublicRoute) || (user && isPublicRoute) || isForbidden) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}
