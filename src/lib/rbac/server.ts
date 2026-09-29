/**
 * Server-side helper to fetch role permissions from the database.
 * Used by login, /api/auth/me refresh, and API authorization checks.
 */
import { getPool } from "@/lib/db";
import type { SectionPermission } from "@/lib/rbac/permissions";
import { buildAdminPermissions, SECTION_ALIASES } from "@/lib/rbac/permissions";

/**
 * Fetch the permissions for a given role slug from `role_permissions` table.
 * Falls back gracefully if the RBAC tables haven't been migrated yet.
 */
export async function fetchPermissionsForRole(
  roleSlug: string,
): Promise<SectionPermission[]> {
  // Admin always gets full permissions (hardcoded safety net)
  if (roleSlug === "admin") {
    return buildAdminPermissions();
  }

  try {
    const pool = await getPool();

    // Check if roles table exists first (graceful fallback for pre-migration)
    const tableCheck = await pool.request().query(`
      SELECT 1 AS ok FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'roles'
    `);

    if (tableCheck.recordset.length === 0) {
      // RBAC tables not migrated yet — return empty permissions
      return [];
    }

    const result = await pool
      .request()
      .input("slug", roleSlug)
      .query<{
        section: string;
        canView: boolean;
        canCreate: boolean;
        canEdit: boolean;
        canDelete: boolean;
        canApprove: boolean;
      }>(`
        SELECT rp.section, rp.canView, rp.canCreate, rp.canEdit, rp.canDelete, rp.canApprove
        FROM role_permissions rp
        INNER JOIN roles r ON r.id = rp.roleId
        WHERE r.slug = @slug AND r.isActive = 1
      `);

    return result.recordset.map((row) => ({
      section: row.section,
      view: !!row.canView,
      create: !!row.canCreate,
      edit: !!row.canEdit,
      delete: !!row.canDelete,
      approve: !!row.canApprove,
    }));
  } catch (err) {
    console.error("[fetchPermissionsForRole] error:", err);
    // Fail open for admin, fail closed for others
    return [];
  }
}


/**
 * Server-side permission check for API routes.
 * Checks if the given session's permissions include the required action on a section.
 */
export function sessionCan(
  permissions: SectionPermission[] | undefined,
  section: string,
  action: "view" | "create" | "edit" | "delete" | "approve",
): boolean {
  if (!permissions || permissions.length === 0) return false;
  const targetKey = SECTION_ALIASES[section] || section;
  const entry = permissions.find(
    (p) => p.section === targetKey || p.section === section,
  );
  if (!entry) return false;
  if (entry[action] === true) return true;
  if (action === "view" && (entry.create || entry.edit || entry.delete || entry.approve)) {
    return true;
  }
  return false;
}

/**
 * Asynchronous server-side permission check for API routes.
 * Checks JWT token permissions first, and falls back to live database permissions
 * if token permissions are empty or stale (e.g. role modified in real-time).
 */
export async function checkSessionPermission(
  session: { role?: string; permissions?: SectionPermission[] } | null | undefined,
  section: string,
  action: "view" | "create" | "edit" | "delete" | "approve"
): Promise<boolean> {
  if (!session) return false;
  if (session.role === "admin") return true;

  // 1. Check permissions in session/JWT
  if (sessionCan(session.permissions, section, action)) {
    return true;
  }

  // 2. If not found in token, check live permissions for session.role from DB
  if (session.role) {
    const live = await fetchPermissionsForRole(session.role);
    if (sessionCan(live, section, action)) {
      return true;
    }
  }

  return false;
}
