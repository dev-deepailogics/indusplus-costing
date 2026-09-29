"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { UsersService } from "../services/UsersService";
import { useAuth } from "../context/AuthProvider";
import type { UserProfile, Role } from "../types";

export interface UseUsersFacadeReturn {
  users: UserProfile[];
  currentUserId: number | undefined;
  loading: boolean;
  refreshUsers: () => Promise<void>;
  updateRole: (userId: number, role: Role) => Promise<void>;
  updateCustomer: (userId: number, assignedCustomer: string | null) => Promise<void>;
  toggleActive: (u: UserProfile) => Promise<void>;
  deleteUser: (userId: number) => Promise<void>;
  createUser: (data: {
    email: string;
    displayName: string;
    password: string;
    role: Role;
    assignedCustomer?: string | null;
  }) => Promise<void>;
  adminResetPassword: (userId: number, newPassword: string) => Promise<void>;
}

export function useUsersFacade(): UseUsersFacadeReturn {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshUsers = useCallback(async () => {
    try {
      const data = await UsersService.fetchAllUsers();
      setUsers(data);
    } catch (err) {
      console.error("Error fetching users:", err);
      toast.error("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUsers();
  }, [refreshUsers]);

  const updateRole = useCallback(
    async (userId: number, role: Role) => {
      try {
        await UsersService.setUserRole(userId, role);
        toast.success(`Role updated successfully.`);
        await refreshUsers();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update role.");
      }
    },
    [refreshUsers],
  );

  const updateCustomer = useCallback(
    async (userId: number, assignedCustomer: string | null) => {
      try {
        await UsersService.setUserCustomer(userId, assignedCustomer);
        toast.success(`Customer assignment updated.`);
        await refreshUsers();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update customer.");
      }
    },
    [refreshUsers],
  );


  const toggleActive = useCallback(
    async (u: UserProfile) => {
      try {
        await UsersService.toggleActive(u.id, !u.isActive);
        toast.success(`${u.email} is now ${u.isActive ? "deactivated" : "activated"}`);
        await refreshUsers();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to update status.");
      }
    },
    [refreshUsers],
  );

  const deleteUser = useCallback(
    async (userId: number) => {
      await UsersService.deleteUser(userId);
      toast.success("User deleted successfully.");
      await refreshUsers();
    },
    [refreshUsers],
  );

  const createUser = useCallback(
    async (data: {
      email: string;
      displayName: string;
      password: string;
      role: Role;
      assignedCustomer?: string | null;
    }) => {
      await UsersService.createUser(data);
      toast.success(`User ${data.email} created.`);
      await refreshUsers();
    },
    [refreshUsers],
  );

  const adminResetPassword = useCallback(
    async (userId: number, newPassword: string) => {
      await UsersService.adminResetPassword(userId, newPassword);
      toast.success("Password has been reset.");
      await refreshUsers();
    },
    [refreshUsers],
  );

  return {
    users,
    currentUserId: user?.id,
    loading,
    refreshUsers,
    updateRole,
    updateCustomer,
    toggleActive,
    deleteUser,
    createUser,
    adminResetPassword,
  };
}
