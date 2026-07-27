"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

const PUBLIC_ROUTES = ["/login"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublicRoute) {
      router.replace("/login");
    } else if (user && isPublicRoute) {
      router.replace("/parameters");
    }
  }, [user, loading, isPublicRoute, router]);

  if (loading || (!user && !isPublicRoute) || (user && isPublicRoute)) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <Skeleton className="h-8 w-32 rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}
