"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AuthService } from "../services/AuthService";
import type { AuthMode } from "../types";

export interface UseLoginFacadeReturn {
  mode: AuthMode;
  setMode: (mode: AuthMode) => void;
  displayName: string;
  setDisplayName: (name: string) => void;
  email: string;
  setEmail: (email: string) => void;
  password: string;
  setPassword: (password: string) => void;
  submitting: boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  toggleMode: () => void;
}

export function useLoginFacade(): UseLoginFacadeReturn {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === "sign-in" ? "sign-up" : "sign-in"));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      try {
        if (mode === "sign-in") {
          await AuthService.signIn(email, password);
        } else {
          await AuthService.signUp(email, password, displayName);
        }
        router.replace("/parameters");
      } catch (error) {
        toast.error(AuthService.getErrorMessage(error));
      } finally {
        setSubmitting(false);
      }
    },
    [mode, email, password, displayName, router]
  );

  return {
    mode,
    setMode,
    displayName,
    setDisplayName,
    email,
    setEmail,
    password,
    setPassword,
    submitting,
    handleSubmit,
    toggleMode,
  };
}
