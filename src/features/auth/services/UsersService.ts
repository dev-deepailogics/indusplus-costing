import type { UserProfile, Role } from "../types";

export class UsersService {
  /**
   * Fetch all users (admin only).
   */
  public static async fetchAllUsers(): Promise<UserProfile[]> {
    const res = await fetch("/api/users");
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to fetch users.");
    }
    const data = await res.json();
    return data.users as UserProfile[];
  }

  /**
   * Create a new user (admin only).
   */
  public static async createUser(payload: {
    email: string;
    displayName: string;
    password: string;
    role: Role;
    assignedCustomer?: string | null;
  }): Promise<UserProfile> {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Failed to create user.");
    }

    return data.user as UserProfile;
  }

  /**
   * Update a user's role (admin only).
   */
  public static async setUserRole(id: number, role: Role): Promise<void> {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to update role.");
    }
  }

  /**
   * Update a user's assigned customer (admin only).
   */
  public static async setUserCustomer(id: number, assignedCustomer: string | null): Promise<void> {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedCustomer }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to update customer assignment.");
    }
  }

  /**
   * Toggle a user's active status (admin only).
   */
  public static async toggleActive(id: number, isActive: boolean): Promise<void> {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to update user status.");
    }
  }

  /**
   * Admin resets another user's password (admin only).
   */
  public static async adminResetPassword(id: number, newPassword: string): Promise<void> {
    const res = await fetch(`/api/users/${id}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to reset password.");
    }
  }

  /**
   * Delete a user (admin only).
   */
  public static async deleteUser(id: number): Promise<void> {
    const res = await fetch(`/api/users/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Failed to delete user.");
    }
  }
}
