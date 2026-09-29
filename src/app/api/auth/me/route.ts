import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPool } from "@/lib/db";
import { fetchPermissionsForRole } from "@/lib/rbac/server";
import { resolveTeamCustomers } from "@/lib/cost-sheet/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Fetch fresh user data from DB (with resilient fallback)
    const pool = await getPool();
    let user: {
      id: number;
      email: string;
      displayName: string;
      role: string;
      assignedCustomer?: string | null;
      isActive: boolean;
      mustResetPassword: boolean;
    } | undefined;

    try {
      const result = await pool
        .request()
        .input("id", session.userId)
        .query<{
          id: number;
          email: string;
          displayName: string;
          role: string;
          assignedCustomer: string | null;
          isActive: boolean;
          mustResetPassword: boolean;
        }>(
          `SELECT id, email, displayName, role, assignedCustomer, isActive, mustResetPassword
           FROM users
           WHERE id = @id`,
        );
      user = result.recordset[0];
    } catch {
      const fallbackResult = await pool
        .request()
        .input("id", session.userId)
        .query<{
          id: number;
          email: string;
          displayName: string;
          role: string;
          isActive: boolean;
          mustResetPassword: boolean;
        }>(
          `SELECT id, email, displayName, role, isActive, mustResetPassword
           FROM users
           WHERE id = @id`,
        );
      if (fallbackResult.recordset[0]) {
        user = {
          ...fallbackResult.recordset[0],
          assignedCustomer: null,
        };
      }
    }

    if (!user || !user.isActive) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Fetch fresh permissions for the user's role
    const permissions = await fetchPermissionsForRole(user.role);

    // Fetch team customers using the shared resolver (logs errors properly, no silent 403)
    const teamCustomers = await resolveTeamCustomers(pool, { role: user.role, userId: user.id });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        assignedCustomer: user.assignedCustomer ?? null,
        teamCustomers,
        mustResetPassword: user.mustResetPassword,
        permissions,
      },
    });
  } catch (err) {
    console.error("Session check error:", err);
    return NextResponse.json(
      { error: "Failed to verify session." },
      { status: 500 },
    );
  }
}
