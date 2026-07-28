"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ensureUserProfile, subscribeToUserRole } from "./users-firestore";
import type { Role } from "./roles";

type AuthContextValue = {
  user: User | null;
  role: Role | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({ user: null, role: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setRole(null);
      setLoading(!nextUser ? false : true);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    let unsubRole = () => {};
    ensureUserProfile(user).finally(() => {
      unsubRole = subscribeToUserRole(user.uid, (nextRole) => {
        setRole(nextRole);
        setLoading(false);
      });
    });
    return () => unsubRole();
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, role, loading }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
