"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthService } from "../services/AuthService";
import { useAuth } from "../context/AuthProvider";
import { can as checkPermission } from "@/lib/rbac/permissions";

export interface UseLoginFacadeReturn {
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  submitting: boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  // Password reset dialog state
  resetOpen: boolean;
  setResetOpen: (open: boolean) => void;
  currentPassword: string;
  setCurrentPassword: (pw: string) => void;
  newPassword: string;
  setNewPassword: (pw: string) => void;
  confirmPassword: string;
  setConfirmPassword: (pw: string) => void;
  resetting: boolean;
  handleResetPassword: (e: React.FormEvent) => Promise<void>;
}

export function useLoginFacade(): UseLoginFacadeReturn {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Password reset state
  const [resetOpen, setResetOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        const user = await login(email, password);
        if (user.mustResetPassword) {
          setResetOpen(true);
          toast.info("You must reset your password before continuing.");
        } else {
          // Redirect based on permissions
          const canViewParams = user.role === "admin" || checkPermission(user.permissions ?? [], "parameters", "view");
          router.replace(canViewParams ? "/parameters" : "/cost-sheet");
        }
      } catch (error) {
        toast.error(AuthService.getErrorMessage(error));
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, login, router],
  );

  const handleResetPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (newPassword !== confirmPassword) {
        toast.error("New passwords do not match.");
        return;
      }
      if (newPassword.length < 6) {
        toast.error("New password must be at least 6 characters.");
        return;
      }

      setResetting(true);
      try {
        await AuthService.resetPassword(currentPassword, newPassword);
        toast.success("Password updated successfully.");
        setResetOpen(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        // Navigate after successful reset
        router.replace("/parameters");
      } catch (error) {
        toast.error(AuthService.getErrorMessage(error));
      } finally {
        setResetting(false);
      }
    },
    [currentPassword, newPassword, confirmPassword, router],
  );

  return {
    email,
    setEmail,
    password,
    setPassword,
    submitting,
    handleSubmit,
    resetOpen,
    setResetOpen,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    resetting,
    handleResetPassword,
  };
}
