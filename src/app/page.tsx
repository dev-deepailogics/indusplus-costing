"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-provider";

export default function Home() {
  const router = useRouter();
  const { role, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(role === "admin" ? "/parameters" : "/cost-sheet");
  }, [role, loading, router]);

  return null;
}
