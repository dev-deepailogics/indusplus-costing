import type { User } from "firebase/auth";

export type Role = "admin" | "merchant";

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: Role;
}

export interface AuthContextValue {
  user: User | null;
  role: Role | null;
  loading: boolean;
}

export type AuthMode = "sign-in" | "sign-up";
