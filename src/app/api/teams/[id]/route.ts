import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPool } from "@/lib/db";
import { checkSessionPermission } from "@/lib/rbac/server";
import { ensureTeamsTables, type TeamDto } from "../route";

/**
 * GET /api/teams/[id] — get a single team by ID
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm = await checkSessionPermission(session, "teams", "view");
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    const teamId = parseInt(resolvedParams.id, 10);
    if (isNaN(teamId)) {
      return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
    }

    const pool = await getPool();
    await ensureTeamsTables(pool);

    const query = `
      SELECT 
        t.id,
        t.name,
        t.description,
        t.customers,
        t.isActive,
        t.createdAt,
        t.updatedAt,
        m.id AS memberId,
        m.userId,
        COALESCE(u.role, m.roleSlug) AS roleSlug,
        m.notes,
        m.createdAt AS memberCreatedAt,
        u.email AS userEmail,
        u.displayName AS userDisplayName,
        u.role AS userDefaultRole,
        COALESCE(r.name, u.role, m.roleSlug) AS roleName
      FROM teams t
      LEFT JOIN team_members m ON m.teamId = t.id
      LEFT JOIN users u ON u.id = m.userId
      LEFT JOIN roles r ON r.slug = COALESCE(u.role, m.roleSlug)
      WHERE t.id = @teamId
      ORDER BY m.id ASC
    `;

    const result = await pool.request().input("teamId", teamId).query(query);

    if (result.recordset.length === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const first = result.recordset[0];
    let parsedCustomers: string[] = [];
    try {
      if (first.customers) {
        if (first.customers.startsWith("[")) {
          parsedCustomers = JSON.parse(first.customers);
        } else {
          parsedCustomers = first.customers.split(",").map((s: string) => s.trim()).filter(Boolean);
        }
      }
    } catch {
      parsedCustomers = [];
    }

    const team: TeamDto = {
      id: first.id,
      name: first.name,
      description: first.description ?? null,
      customers: parsedCustomers,
      isActive: Boolean(first.isActive),
      memberCount: 0,
      members: [],
      createdAt: first.createdAt ? new Date(first.createdAt).toISOString() : "",
      updatedAt: first.updatedAt ? new Date(first.updatedAt).toISOString() : "",
    };

    for (const row of result.recordset) {
      if (row.memberId && row.userId) {
        team.members.push({
          id: row.memberId,
          userId: row.userId,
          userEmail: row.userEmail ?? "",
          userDisplayName: row.userDisplayName || row.userEmail || `User #${row.userId}`,
          userDefaultRole: row.userDefaultRole ?? "merchant",
          roleSlug: row.roleSlug,
          roleName: row.roleName || row.roleSlug,
          notes: row.notes ?? null,
          createdAt: row.memberCreatedAt ? new Date(row.memberCreatedAt).toISOString() : "",
        });
      }
    }
    team.memberCount = team.members.length;

    return NextResponse.json({ team });
  } catch (err) {
    console.error("[GET /api/teams/[id]] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch team", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/teams/[id] — update team details and sync members
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm = await checkSessionPermission(session, "teams", "edit");
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    const teamId = parseInt(resolvedParams.id, 10);
    if (isNaN(teamId)) {
      return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const pool = await getPool();
    await ensureTeamsTables(pool);

    // Verify team exists
    const checkTeam = await pool
      .request()
      .input("id", teamId)
      .query(`SELECT id FROM teams WHERE id = @id`);

    if (checkTeam.recordset.length === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    // Update team fields if provided
    if (
      body.name !== undefined ||
      body.description !== undefined ||
      body.customers !== undefined ||
      body.isActive !== undefined
    ) {
      const updates: string[] = ["updatedAt = GETUTCDATE()"];
      const req = pool.request().input("id", teamId);

      if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (!name) {
          return NextResponse.json({ error: "Team name cannot be empty" }, { status: 400 });
        }
        updates.push("name = @name");
        req.input("name", name);
      }

      if (body.description !== undefined) {
        updates.push("description = @description");
        req.input("description", body.description ? String(body.description).trim() : null);
      }

      if (body.customers !== undefined) {
        let customersList: string[] = [];
        if (Array.isArray(body.customers)) {
          customersList = body.customers.map((c: unknown) => String(c).trim()).filter(Boolean);
        } else if (typeof body.customers === "string" && body.customers.trim()) {
          customersList = body.customers.split(",").map((c: string) => c.trim()).filter(Boolean);
        }
        updates.push("customers = @customers");
        req.input("customers", JSON.stringify(customersList));
      }

      if (body.isActive !== undefined) {
        updates.push("isActive = @isActive");
        req.input("isActive", body.isActive ? 1 : 0);
      }

      await req.query(`UPDATE teams SET ${updates.join(", ")} WHERE id = @id`);
    }

    // If members array provided, synchronize members (replace team members)
    if (Array.isArray(body.members)) {
      // Remove current members
      await pool
        .request()
        .input("teamId", teamId)
        .query(`DELETE FROM team_members WHERE teamId = @teamId`);

      // Insert new members
      for (const m of body.members) {
        if (!m.userId || !m.roleSlug) continue;
        try {
          await pool
            .request()
            .input("teamId", teamId)
            .input("userId", Number(m.userId))
            .input("roleSlug", String(m.roleSlug).trim())
            .input("notes", m.notes ? String(m.notes).trim() : null)
            .query(`
              IF NOT EXISTS (
                SELECT 1 FROM team_members WHERE teamId = @teamId AND userId = @userId AND roleSlug = @roleSlug
              )
              BEGIN
                INSERT INTO team_members (teamId, userId, roleSlug, notes, createdAt)
                VALUES (@teamId, @userId, @roleSlug, @notes, GETUTCDATE())
              END
            `);
        } catch (memberErr) {
          console.warn(`[PATCH /api/teams/[id]] Member sync error for user ${m.userId}:`, memberErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Team updated successfully.",
    });
  } catch (err) {
    console.error("[PATCH /api/teams/[id]] Error:", err);
    return NextResponse.json(
      { error: "Failed to update team", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/teams/[id] — delete a team
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm = await checkSessionPermission(session, "teams", "delete");
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const resolvedParams = await params;
    const teamId = parseInt(resolvedParams.id, 10);
    if (isNaN(teamId)) {
      return NextResponse.json({ error: "Invalid team ID" }, { status: 400 });
    }

    const pool = await getPool();
    await ensureTeamsTables(pool);

    // Delete members first to be safe, then team
    await pool
      .request()
      .input("teamId", teamId)
      .query(`DELETE FROM team_members WHERE teamId = @teamId`);

    const delRes = await pool
      .request()
      .input("id", teamId)
      .query(`DELETE FROM teams WHERE id = @id`);

    if (delRes.rowsAffected[0] === 0) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Team deleted successfully.",
    });
  } catch (err) {
    console.error("[DELETE /api/teams/[id]] Error:", err);
    return NextResponse.json(
      { error: "Failed to delete team", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
