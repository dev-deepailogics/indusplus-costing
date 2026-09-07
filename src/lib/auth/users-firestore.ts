import { UsersService } from "@/features/auth";
import type { UserProfile, Role } from "@/features/auth";

export type { UserProfile };

export function ensureUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
}): Promise<Role> {
  return UsersService.ensureUserProfile(user);
}

export function subscribeToUserRole(uid: string, onRole: (role: Role) => void): () => void {
  return UsersService.subscribeToUserRole(uid, onRole);
}

export function subscribeToAllUsers(onUsers: (users: UserProfile[]) => void): () => void {
  return UsersService.subscribeToAllUsers(onUsers);
}

export function setUserRole(uid: string, role: Role): Promise<void> {
  return UsersService.setUserRole(uid, role);
}
