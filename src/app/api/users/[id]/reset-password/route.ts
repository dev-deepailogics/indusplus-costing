import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { getPool } from "@/lib/db";
import { checkSessionPermission } from "@/lib/rbac/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/users/[id]/reset-password — admin/authorized user resets another user's password
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const hasPerm = await checkSessionPermission(session, "users", "edit");
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.newPassword !== "string") {
      return NextResponse.json(
        { error: "New password is required." },
        { status: 400 },
      );
    }

    if (body.newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(body.newPassword);
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", id)
      .input("hash", passwordHash)
      .query(
        `UPDATE users SET passwordHash = @hash, mustResetPassword = 1, updatedAt = GETUTCDATE() WHERE id = @id`,
      );

    if (result.rowsAffected[0] === 0) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Admin reset password error:", err);
    return NextResponse.json(
      { error: "Failed to reset password." },
      { status: 500 },
    );
  }
}
