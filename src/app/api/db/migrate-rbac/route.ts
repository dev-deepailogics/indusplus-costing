import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPool } from "@/lib/db";
import {
  SECTION_REGISTRY,
  buildDefaultPermissions,
} from "@/lib/rbac/permissions";

/**
 * Migration runner:
 * 1. Creates `roles` and `role_permissions` tables (IF NOT EXISTS)
 * 2. Seeds the 9 default roles
 * 3. Backfills / syncs permissions for any newly added sections into existing roles
 *
 * Idempotent — safe to run multiple times.
 */
async function runMigration() {
  const pool = await getPool();

  // ── 0. Ensure users.assignedCustomer column exists ──
  await pool.request().query(`
    IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users')
    BEGIN
      IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'assignedCustomer'
      )
      BEGIN
        ALTER TABLE users ADD assignedCustomer NVARCHAR(255) NULL;
      END
    END
  `);

  // ── 1. Create roles table ──
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
  `);

  // ── 2. Create role_permissions table ──
  await pool.request().query(`
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

  // ── 3. Seed / sync default roles ──
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

  let seededRolesCount = 0;
  let syncedPermsCount = 0;

  for (const role of defaultRoles) {
    let roleId: number;

    const exists = await pool
      .request()
      .input("slug", role.slug)
      .query<{ id: number }>(`SELECT id FROM roles WHERE slug = @slug`);

    if (exists.recordset.length > 0) {
      roleId = exists.recordset[0].id;
    } else {
      const insertResult = await pool
        .request()
        .input("name", role.name)
        .input("slug", role.slug)
        .input("description", role.description)
        .input("isSystem", role.isSystem)
        .query<{ id: number }>(
          `INSERT INTO roles (name, slug, description, isSystem)
           OUTPUT INSERTED.id
           VALUES (@name, @slug, @description, @isSystem)`
        );

      roleId = insertResult.recordset[0]?.id;
      if (!roleId) continue;
      seededRolesCount++;
    }

    // Sync / backfill permissions for every section in the registry
    const defaultPerms = buildDefaultPermissions(role.slug);
    for (const perm of defaultPerms) {
      const permCheck = await pool
        .request()
        .input("roleId", roleId)
        .input("section", perm.section)
        .query<{ id: number }>(
          `SELECT id FROM role_permissions WHERE roleId = @roleId AND section = @section`
        );

      if (permCheck.recordset.length === 0) {
        await pool
          .request()
          .input("roleId", roleId)
          .input("section", perm.section)
          .input("canView", perm.view)
          .input("canCreate", perm.create)
          .input("canEdit", perm.edit)
          .input("canDelete", perm.delete)
          .input("canApprove", perm.approve)
          .query(
            `INSERT INTO role_permissions (roleId, section, canView, canCreate, canEdit, canDelete, canApprove)
             VALUES (@roleId, @section, @canView, @canCreate, @canEdit, @canDelete, @canApprove)`
          );
        syncedPermsCount++;
      }
    }
  }

  return {
    ok: true,
    message: `RBAC migration successful. ${seededRolesCount} role(s) created, ${syncedPermsCount} permission row(s) synced.`,
    totalSections: SECTION_REGISTRY.length,
  };
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const result = await runMigration();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[POST /api/db/migrate-rbac] error:", err);
    return NextResponse.json(
      {
        error: "Migration failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Forbidden. Admin session required." }, { status: 403 });
    }
    const result = await runMigration();
    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/db/migrate-rbac] error:", err);
    return NextResponse.json(
      {
        error: "Migration failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
