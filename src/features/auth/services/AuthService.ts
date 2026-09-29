import type { SessionUser } from "../types";

export class AuthService {
  /**
   * Sign in via the login API. Returns the authenticated user.
   */
  public static async signIn(email: string, password: string): Promise<SessionUser> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Login failed.");
    }

    return data.user as SessionUser;
  }

  /**
   * Sign out by destroying the server-side session.
   */
  public static async signOut(): Promise<void> {
    const res = await fetch("/api/auth/logout", { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Sign out failed.");
    }
  }

  /**
   * Get the current session user, or null if not authenticated.
   */
  public static async getMe(): Promise<SessionUser | null> {
    try {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return null;
      const data = await res.json();
      return data.user ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Reset the current user's password.
   */
  public static async resetPassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || "Password reset failed.");
    }
  }

  /**
   * Extract a user-friendly error message.
   */
  public static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return "An unexpected error occurred. Please try again.";
  }
}
