import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPool } from "@/lib/db";
import { checkSessionPermission } from "@/lib/rbac/server";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/users/[id] — update user fields (admin or users:edit)
 * Supports: role, displayName, isActive, assignedCustomer
 */
export async function PATCH(request: Request, context: RouteContext) {
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
    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const updates: string[] = [];
    const pool = await getPool();
    const req = pool.request().input("id", id);

    // Validate role against the roles table (dynamic)
    if (typeof body.role === "string" && body.role.trim()) {
      // Cannot demote yourself from admin
      if (id === session.userId && body.role !== "admin") {
        return NextResponse.json(
          { error: "You cannot change your own role." },
          { status: 400 },
        );
      }
      // Check role exists
      const roleCheck = await pool
        .request()
        .input("roleSlug", body.role.trim())
        .query<{ slug: string }>(`SELECT slug FROM roles WHERE slug = @roleSlug AND isActive = 1`);
      if (roleCheck.recordset.length > 0) {
        req.input("role", body.role.trim());
        updates.push("role = @role");
      }
    }

    if (typeof body.displayName === "string" && body.displayName.trim()) {
      req.input("displayName", body.displayName.trim());
      updates.push("displayName = @displayName");
    }

    if ("assignedCustomer" in body) {
      let assignedCustomer: string | null = null;
      if (Array.isArray(body.assignedCustomer)) {
        assignedCustomer =
          body.assignedCustomer
            .map((c: unknown) => String(c).trim())
            .filter(Boolean)
            .join(", ") || null;
      } else if (typeof body.assignedCustomer === "string" && body.assignedCustomer.trim()) {
        assignedCustomer = body.assignedCustomer.trim();
      }
      req.input("assignedCustomer", assignedCustomer);
      updates.push("assignedCustomer = @assignedCustomer");
    }

    if (typeof body.isActive === "boolean") {
      // Cannot deactivate yourself
      if (id === session.userId && !body.isActive) {
        return NextResponse.json(
          { error: "You cannot deactivate your own account." },
          { status: 400 },
        );
      }
      req.input("isActive", body.isActive);
      updates.push("isActive = @isActive");
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    updates.push("updatedAt = GETUTCDATE()");
    const setClause = updates.join(", ");

    const result = await req.query(`UPDATE users SET ${setClause} WHERE id = @id`);

    if (result.rowsAffected[0] === 0) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Update user error:", err);
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
  }
}

/**
 * DELETE /api/users/[id] — delete user (admin or users:delete)
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const hasPerm = await checkSessionPermission(session, "users", "delete");
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid user ID." }, { status: 400 });
    }

    if (id === session.userId) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 },
      );
    }

    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", id)
      .query(`DELETE FROM users WHERE id = @id`);

    if (result.rowsAffected[0] === 0) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete user error:", err);
    return NextResponse.json({ error: "Failed to delete user." }, { status: 500 });
  }
}
