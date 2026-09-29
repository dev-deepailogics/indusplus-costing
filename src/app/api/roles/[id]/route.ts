import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPool } from "@/lib/db";
import { checkSessionPermission } from "@/lib/rbac/server";
import { SECTION_REGISTRY } from "@/lib/rbac/permissions";
import type { SectionPermission } from "@/lib/rbac/permissions";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/roles/[id] — get a single role with permissions
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm = await checkSessionPermission(session, "roles", "view");
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid role ID." }, { status: 400 });
    }

    const pool = await getPool();

    const roleResult = await pool
      .request()
      .input("id", id)
      .query(
        `SELECT id, name, slug, description, isSystem, isActive, createdAt, updatedAt
         FROM roles WHERE id = @id`,
      );

    if (roleResult.recordset.length === 0) {
      return NextResponse.json({ error: "Role not found." }, { status: 404 });
    }

    const r = roleResult.recordset[0];

    const permsResult = await pool
      .request()
      .input("roleId", id)
      .query<{
        section: string;
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canApprove: boolean;
      }>(
        `SELECT section, canView, canCreate, canEdit, canDelete, canApprove
         FROM role_permissions WHERE roleId = @roleId`,
      );

    const permissions: SectionPermission[] = permsResult.recordset.map((row) => ({
      section: row.section,
      view: !!row.canView,
      create: !!row.canCreate,
      edit: !!row.canEdit,
      delete: !!row.canDelete,
      approve: !!row.canApprove,
    }));

    return NextResponse.json({
      role: {
        id: r.id,
        name: r.name,
        slug: r.slug,
        description: r.description,
        isSystem: !!r.isSystem,
        isActive: !!r.isActive,
        permissions,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      },
    });
  } catch (err) {
    console.error("Fetch role error:", err);
    return NextResponse.json({ error: "Failed to fetch role." }, { status: 500 });
  }
}

/**
 * PATCH /api/roles/[id] — update role name, description, and permissions
 */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm = await checkSessionPermission(session, "roles", "edit");
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid role ID." }, { status: 400 });
    }

    const pool = await getPool();

    // Check if role exists and is not system (admin)
    const existing = await pool
      .request()
      .input("id", id)
      .query<{ isSystem: boolean; slug: string }>(
        `SELECT isSystem, slug FROM roles WHERE id = @id`,
      );

    if (existing.recordset.length === 0) {
      return NextResponse.json({ error: "Role not found." }, { status: 404 });
    }

    if (existing.recordset[0].isSystem) {
      return NextResponse.json(
        { error: "System roles cannot be modified." },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    // Update role metadata
    const updates: string[] = [];
    const req = pool.request().input("id", id);

    if (typeof body.name === "string" && body.name.trim()) {
      req.input("name", body.name.trim());
      updates.push("name = @name");
    }

    if (typeof body.description === "string") {
      req.input("description", body.description.trim() || null);
      updates.push("description = @description");
    }

    if (updates.length > 0) {
      updates.push("updatedAt = GETUTCDATE()");
      await req.query(`UPDATE roles SET ${updates.join(", ")} WHERE id = @id`);
    }

    // Update permissions if provided in a single batch query
    if (Array.isArray(body.permissions)) {
      const permissions: SectionPermission[] = body.permissions;

      // 1. Delete all existing permissions for this role in ONE atomic query
      await pool
        .request()
        .input("roleId", id)
        .query("DELETE FROM role_permissions WHERE roleId = @roleId");

      // 2. Build single batch insert query
      const validPerms = permissions.filter((perm) =>
        SECTION_REGISTRY.some((s) => s.key === perm.section)
      );

      if (validPerms.length > 0) {
        const insertReq = pool.request().input("roleId", id);
        const valueClauses = validPerms.map((perm, i) => {
          insertReq.input(`sec_${i}`, perm.section);
          insertReq.input(`view_${i}`, perm.view ? 1 : 0);
          insertReq.input(`create_${i}`, perm.create ? 1 : 0);
          insertReq.input(`edit_${i}`, perm.edit ? 1 : 0);
          insertReq.input(`delete_${i}`, perm.delete ? 1 : 0);
          insertReq.input(`approve_${i}`, perm.approve ? 1 : 0);
          return `(@roleId, @sec_${i}, @view_${i}, @create_${i}, @edit_${i}, @delete_${i}, @approve_${i})`;
        });

        await insertReq.query(`
          INSERT INTO role_permissions (roleId, section, canView, canCreate, canEdit, canDelete, canApprove)
          VALUES ${valueClauses.join(",\n")}
        `);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Update role error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update role." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/roles/[id] — soft-delete a role (set isActive = 0)
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm = await checkSessionPermission(session, "roles", "delete");
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id: rawId } = await context.params;
    const id = parseInt(rawId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid role ID." }, { status: 400 });
    }

    const pool = await getPool();

    // Check if role is system
    const existing = await pool
      .request()
      .input("id", id)
      .query<{ isSystem: boolean; slug: string }>(
        `SELECT isSystem, slug FROM roles WHERE id = @id`,
      );

    if (existing.recordset.length === 0) {
      return NextResponse.json({ error: "Role not found." }, { status: 404 });
    }

    if (existing.recordset[0].isSystem) {
      return NextResponse.json(
        { error: "System roles cannot be deleted." },
        { status: 400 },
      );
    }

    // Check if any active users have this role
    const usersWithRole = await pool
      .request()
      .input("slug", existing.recordset[0].slug)
      .query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM users WHERE role = @slug AND isActive = 1`,
      );

    if (usersWithRole.recordset[0]?.cnt > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete this role — ${usersWithRole.recordset[0].cnt} active user(s) are assigned to it. Reassign them first.`,
        },
        { status: 400 },
      );
    }

    await pool
      .request()
      .input("id", id)
      .query(`UPDATE roles SET isActive = 0, updatedAt = GETUTCDATE() WHERE id = @id`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Delete role error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete role." },
      { status: 500 },
    );
  }
}
