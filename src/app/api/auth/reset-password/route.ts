import { NextResponse } from "next/server";
import { getSession, createSession } from "@/lib/auth/session";
import { verifyPassword, hashPassword } from "@/lib/auth/password";
import { getPool, sql } from "@/lib/db";
import type { Role } from "@/features/auth/types";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (
      !body ||
      typeof body.currentPassword !== "string" ||
      typeof body.newPassword !== "string"
    ) {
      return NextResponse.json(
        { error: "Current password and new password are required." },
        { status: 400 },
      );
    }

    const { currentPassword, newPassword } = body;

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters." },
        { status: 400 },
      );
    }

    // Fetch current hash
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", session.userId)
      .query<{ passwordHash: string; role: string; displayName: string; email: string }>(
        `SELECT passwordHash, role, displayName, email FROM users WHERE id = @id AND isActive = 1`,
      );

    const user = result.recordset[0];
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Verify current password
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 },
      );
    }

    // Hash new password and update
    const newHash = await hashPassword(newPassword);
    await pool
      .request()
      .input("id", session.userId)
      .input("hash", newHash)
      .query(
        `UPDATE users SET passwordHash = @hash, mustResetPassword = 0, updatedAt = GETUTCDATE() WHERE id = @id`,
      );

    // Refresh session to reflect cleared mustResetPassword
    await createSession({
      userId: session.userId,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      permissions: session.permissions ?? [],
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Reset password error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
