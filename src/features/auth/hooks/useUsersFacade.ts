"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { UsersService } from "../services/UsersService";
import { useAuth } from "../context/AuthProvider";
import type { UserProfile, Role } from "../types";

export interface UseUsersFacadeReturn {
  users: UserProfile[];
  currentUserUid: string | undefined;
  toggleRole: (u: UserProfile) => Promise<void>;
}

export function useUsersFacade(): UseUsersFacadeReturn {
  const { user } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);

  useEffect(() => {
    return UsersService.subscribeToAllUsers(setUsers);
  }, []);

  const toggleRole = useCallback(async (u: UserProfile) => {
    const nextRole: Role = u.role === "admin" ? "merchant" : "admin";
    try {
      await UsersService.setUserRole(u.uid, nextRole);
      toast.success(`${u.email} is now ${nextRole}`);
    } catch (err) {
      console.error("Error setting user role:", err);
      toast.error("Failed to update user role");
    }
  }, []);

  return {
    users,
    currentUserUid: user?.uid,
    toggleRole,
  };
}
