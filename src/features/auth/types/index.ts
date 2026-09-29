import type { SectionPermission } from "@/lib/rbac/permissions";

/**
 * Role slug — plain string sourced dynamically from the `roles` table.
 */
export type Role = string;



export interface SessionUser {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  assignedCustomer?: string | null;
  teamCustomers?: string[];
  mustResetPassword: boolean;
  permissions: SectionPermission[];
}

export interface UserProfile {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  assignedCustomer?: string | null;
  teamCustomers?: string[];
  isActive: boolean;
  mustResetPassword: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthContextValue {
  user: SessionUser | null;
  role: Role | null;
  loading: boolean;
  permissions: SectionPermission[];
  /** Check if the current user has a specific permission. */
  can: (section: string, action: "view" | "create" | "edit" | "delete" | "approve") => boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}
