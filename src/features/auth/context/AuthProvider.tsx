"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AuthService } from "../services/AuthService";
import type { SessionUser, Role, AuthContextValue } from "../types";
import type { SectionPermission } from "@/lib/rbac/permissions";
import { can as checkPermission } from "@/lib/rbac/permissions";

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  loading: true,
  permissions: [],
  can: () => false,
  login: () => Promise.reject(new Error("AuthProvider not mounted")),
  logout: () => Promise.reject(new Error("AuthProvider not mounted")),
  refreshUser: () => Promise.reject(new Error("AuthProvider not mounted")),
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [permissions, setPermissions] = useState<SectionPermission[]>([]);
  const [loading, setLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    let cancelled = false;
    AuthService.getMe()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setRole(u?.role ?? null);
        setPermissions(u?.permissions ?? []);
        setLoading(false);
      })
      .catch(() => {
        // Ensure we always exit loading state even on unexpected errors
        if (!cancelled) {
          setUser(null);
          setRole(null);
          setPermissions([]);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<SessionUser> => {
    const u = await AuthService.signIn(email, password);
    setUser(u);
    setRole(u.role);
    setPermissions(u.permissions ?? []);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await AuthService.signOut();
    setUser(null);
    setRole(null);
    setPermissions([]);
  }, []);

  const refreshUser = useCallback(async () => {
    const u = await AuthService.getMe();
    setUser(u);
    setRole(u?.role ?? null);
    setPermissions(u?.permissions ?? []);
  }, []);

  const can = useCallback(
    (section: string, action: "view" | "create" | "edit" | "delete" | "approve"): boolean => {
      // Admin always has full access (safety net)
      if (role === "admin") return true;
      return checkPermission(permissions, section, action);
    },
    [role, permissions],
  );

  return (
    <AuthContext.Provider value={{ user, role, loading, permissions, can, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
