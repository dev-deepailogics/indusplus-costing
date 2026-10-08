import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPool } from "@/lib/db";
import { checkSessionPermission } from "@/lib/rbac/server";
import {
  SECTION_REGISTRY,
  buildDefaultPermissions,
  type SectionPermission,
} from "@/lib/rbac/permissions";
import type { ConnectionPool } from "mssql";

/**
 * Ensures roles and role_permissions tables exist and seeds default roles if empty.
 */
async function ensureRolesTables(pool: ConnectionPool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'roles')
    BEGIN
      CREATE TABLE roles (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        name        NVARCHAR(100) NOT NULL UNIQUE,
        slug        NVARCHAR(100) NOT NULL UNIQUE,
        description NVARCHAR(500) NULL,
        isSystem    BIT NOT NULL DEFAULT 0,
        isActive    BIT NOT NULL DEFAULT 1,
        createdAt   DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updatedAt   DATETIME2 NOT NULL DEFAULT GETUTCDATE()
      );
    END

    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'role_permissions')
    BEGIN
      CREATE TABLE role_permissions (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        roleId      INT NOT NULL,
        section     NVARCHAR(100) NOT NULL,
        canView     BIT NOT NULL DEFAULT 0,
        canCreate   BIT NOT NULL DEFAULT 0,
        canEdit     BIT NOT NULL DEFAULT 0,
        canDelete   BIT NOT NULL DEFAULT 0,
        canApprove  BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_role_permissions_roleId FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
        CONSTRAINT UQ_role_section UNIQUE (roleId, section)
      );
    END
  `);

  // Check if roles is empty
  const countRes = await pool.request().query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM roles`,
  );
  if (countRes.recordset[0]?.cnt === 0) {
    const defaultRoles = [
      { name: "Admin",                      slug: "admin",        description: "Full access to all sections and features.",      isSystem: true },
      { name: "Merchant (Costing Creator)", slug: "merchant",     description: "Creates and manages cost sheets.",               isSystem: false },
      { name: "CAD",                        slug: "cad",          description: "Approves CAD marker and pattern specs (Step 1).", isSystem: false },
      { name: "Fabric Head",                slug: "fabric_head",  description: "Approves fabric details on cost sheets.",        isSystem: false },
      { name: "MMC Head (Trims)",           slug: "mmc_head",     description: "Approves trims and accessories on cost sheets.", isSystem: false },
      { name: "IE Head (SAM)",              slug: "ie_head",      description: "Approves IE and SAM breakdowns.",                isSystem: false },
      { name: "Washing Head",               slug: "washing_head", description: "Approves washing rates and recipes.",             isSystem: false },
      { name: "Marketing",                  slug: "marketing",    description: "Reviews commercial FOB pricing.",                isSystem: false },
      { name: "Costing Head",               slug: "costing_head", description: "Verifies margins, overhead, and conversion.",    isSystem: false },
      { name: "Director",                   slug: "director",     description: "Final authorization that locks cost sheets.",     isSystem: false },
    ];

    for (const r of defaultRoles) {
      const ins = await pool
        .request()
        .input("name", r.name)
        .input("slug", r.slug)
        .input("description", r.description)
        .input("isSystem", r.isSystem)
        .query<{ id: number }>(
          `INSERT INTO roles (name, slug, description, isSystem)
           OUTPUT INSERTED.id
           VALUES (@name, @slug, @description, @isSystem)`
        );
      const roleId = ins.recordset[0]?.id;
      if (!roleId) continue;

      const perms = buildDefaultPermissions(r.slug);
      for (const p of perms) {
        await pool
          .request()
          .input("roleId", roleId)
          .input("section", p.section)
          .input("canView", p.view ? 1 : 0)
          .input("canCreate", p.create ? 1 : 0)
          .input("canEdit", p.edit ? 1 : 0)
          .input("canDelete", p.delete ? 1 : 0)
          .input("canApprove", p.approve ? 1 : 0)
          .query(
            `INSERT INTO role_permissions (roleId, section, canView, canCreate, canEdit, canDelete, canApprove)
             VALUES (@roleId, @section, @canView, @canCreate, @canEdit, @canDelete, @canApprove)`
          );
      }
    }
  }
}

/**
 * GET /api/roles — list all roles with their permissions
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm =
      (await checkSessionPermission(session, "roles", "view")) ||
      (await checkSessionPermission(session, "users", "view"));
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pool = await getPool();
    await ensureRolesTables(pool);

    // Fetch all roles
    const rolesResult = await pool.request().query(
      `SELECT id, name, slug, description, isSystem, isActive, createdAt, updatedAt
       FROM roles
       WHERE isActive = 1
       ORDER BY isSystem DESC, name ASC`,
    );

    // Fetch all permissions in one query
    const permsResult = await pool.request().query<{
      roleId: number;
      section: string;
      canView: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
      canApprove: boolean;
    }>(
      `SELECT rp.roleId, rp.section, rp.canView, rp.canCreate, rp.canEdit, rp.canDelete, rp.canApprove
       FROM role_permissions rp
       INNER JOIN roles r ON r.id = rp.roleId
       WHERE r.isActive = 1`,
    );

    // Group permissions by roleId
    const permsByRole = new Map<number, SectionPermission[]>();
    for (const row of permsResult.recordset) {
      if (!permsByRole.has(row.roleId)) {
        permsByRole.set(row.roleId, []);
      }
      permsByRole.get(row.roleId)!.push({
        section: row.section,
        view: !!row.canView,
        create: !!row.canCreate,
        edit: !!row.canEdit,
        delete: !!row.canDelete,
        approve: !!row.canApprove,
      });
    }

    const roles = rolesResult.recordset.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      description: r.description,
      isSystem: !!r.isSystem,
      isActive: !!r.isActive,
      permissions: permsByRole.get(r.id) || [],
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json({ roles });
  } catch (err) {
    console.error("Fetch roles error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch roles." },
      { status: 500 },
    );
  }
}

/**
 * POST /api/roles — create a new role with permissions
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm = await checkSessionPermission(session, "roles", "create");
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const name = (typeof body.name === "string" ? body.name : "").trim();
    const description = (typeof body.description === "string" ? body.description : "").trim() || null;
    const permissions: SectionPermission[] = Array.isArray(body.permissions) ? body.permissions : [];

    if (!name) {
      return NextResponse.json({ error: "Role name is required." }, { status: 400 });
    }

    // Auto-generate slug from name
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");

    if (!slug) {
      return NextResponse.json({ error: "Invalid role name (cannot generate slug)." }, { status: 400 });
    }

    const pool = await getPool();
    await ensureRolesTables(pool);

    // Check uniqueness (slug or name)
    const existing = await pool
      .request()
      .input("slug", slug)
      .input("name", name)
      .query<{ id: number }>(`SELECT id FROM roles WHERE slug = @slug OR name = @name`);

    if (existing.recordset.length > 0) {
      return NextResponse.json(
        { error: "A role with this name already exists." },
        { status: 409 },
      );
    }

    // Insert role
    const insertResult = await pool
      .request()
      .input("name", name)
      .input("slug", slug)
      .input("description", description)
      .query<{ id: number }>(
        `INSERT INTO roles (name, slug, description)
         OUTPUT INSERTED.id
         VALUES (@name, @slug, @description)`,
      );

    const roleId = insertResult.recordset[0]?.id;
    if (!roleId) {
      return NextResponse.json({ error: "Failed to create role." }, { status: 500 });
    }

    // Insert permissions for all sections in ONE single batch query
    const insertPermsReq = pool.request().input("roleId", roleId);
    const valueClauses = SECTION_REGISTRY.map((sectionDef, i) => {
      const perm = permissions.find((p) => p.section === sectionDef.key);
      insertPermsReq.input(`sec_${i}`, sectionDef.key);
      insertPermsReq.input(`view_${i}`, perm?.view ? 1 : 0);
      insertPermsReq.input(`create_${i}`, perm?.create ? 1 : 0);
      insertPermsReq.input(`edit_${i}`, perm?.edit ? 1 : 0);
      insertPermsReq.input(`delete_${i}`, perm?.delete ? 1 : 0);
      insertPermsReq.input(`approve_${i}`, perm?.approve ? 1 : 0);
      return `(@roleId, @sec_${i}, @view_${i}, @create_${i}, @edit_${i}, @delete_${i}, @approve_${i})`;
    });

    await insertPermsReq.query(`
      INSERT INTO role_permissions (roleId, section, canView, canCreate, canEdit, canDelete, canApprove)
      VALUES ${valueClauses.join(",\n")}
    `);

    return NextResponse.json(
      {
        role: {
          id: roleId,
          name,
          slug,
          description,
          isSystem: false,
          isActive: true,
          permissions,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Create role error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create role." },
      { status: 500 },
    );
  }
}
