import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPool } from "@/lib/db";
import { checkSessionPermission } from "@/lib/rbac/server";
import type { ConnectionPool } from "mssql";

/**
 * Ensures teams and team_members tables exist.
 */
export async function ensureTeamsTables(pool: ConnectionPool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'teams')
    BEGIN
      CREATE TABLE teams (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        name        NVARCHAR(200) NOT NULL,
        description NVARCHAR(500) NULL,
        customers   NVARCHAR(MAX) NOT NULL DEFAULT '[]',
        isActive    BIT NOT NULL DEFAULT 1,
        createdAt   DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        updatedAt   DATETIME2 NOT NULL DEFAULT GETUTCDATE()
      );
      CREATE INDEX IX_teams_isActive ON teams (isActive);
    END

    IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'team_members')
    BEGIN
      CREATE TABLE team_members (
        id          INT IDENTITY(1,1) PRIMARY KEY,
        teamId      INT NOT NULL,
        userId      INT NOT NULL,
        roleSlug    NVARCHAR(100) NOT NULL,
        notes       NVARCHAR(255) NULL,
        createdAt   DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_team_members_teamId FOREIGN KEY (teamId) REFERENCES teams(id) ON DELETE CASCADE,
        CONSTRAINT FK_team_members_userId FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT UQ_team_user_role UNIQUE (teamId, userId, roleSlug)
      );
      CREATE INDEX IX_team_members_teamId ON team_members (teamId);
      CREATE INDEX IX_team_members_userId ON team_members (userId);
    END
  `);
}

export interface TeamMemberDto {
  id: number;
  userId: number;
  userEmail: string;
  userDisplayName: string;
  userDefaultRole: string;
  roleSlug: string;
  roleName: string;
  notes?: string | null;
  createdAt: string;
}

export interface TeamDto {
  id: number;
  name: string;
  description: string | null;
  customers: string[];
  isActive: boolean;
  memberCount: number;
  members: TeamMemberDto[];
  createdAt: string;
  updatedAt: string;
}

/**
 * GET /api/teams — list all teams with their members and assigned customers
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm = await checkSessionPermission(session, "teams", "view");
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
        m.roleSlug,
        m.notes,
        m.createdAt AS memberCreatedAt,
        u.email AS userEmail,
        u.displayName AS userDisplayName,
        u.role AS userDefaultRole,
        COALESCE(r.name, m.roleSlug) AS roleName
      FROM teams t
      LEFT JOIN team_members m ON m.teamId = t.id
      LEFT JOIN users u ON u.id = m.userId
      LEFT JOIN roles r ON r.slug = m.roleSlug
      ORDER BY t.createdAt DESC, m.id ASC
    `;

    const result = await pool.request().query(query);

    const teamsMap = new Map<number, TeamDto>();

    for (const row of result.recordset) {
      if (!teamsMap.has(row.id)) {
        let parsedCustomers: string[] = [];
        try {
          if (row.customers) {
            if (row.customers.startsWith("[")) {
              parsedCustomers = JSON.parse(row.customers);
            } else {
              parsedCustomers = row.customers.split(",").map((s: string) => s.trim()).filter(Boolean);
            }
          }
        } catch {
          parsedCustomers = [];
        }

        teamsMap.set(row.id, {
          id: row.id,
          name: row.name,
          description: row.description ?? null,
          customers: parsedCustomers,
          isActive: Boolean(row.isActive),
          memberCount: 0,
          members: [],
          createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : "",
          updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : "",
        });
      }

      const team = teamsMap.get(row.id)!;
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

    const teams = Array.from(teamsMap.values()).map((t) => ({
      ...t,
      memberCount: t.members.length,
    }));

    return NextResponse.json({ teams });
  } catch (err) {
    console.error("[GET /api/teams] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch teams", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/teams — create a new team with customer portfolio and member assignments
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm = await checkSessionPermission(session, "teams", "create");
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Team name is required." }, { status: 400 });
    }

    const description = typeof body.description === "string" ? body.description.trim() : null;
    const isActive = body.isActive !== undefined ? Boolean(body.isActive) : true;

    // Format customers as clean JSON array of strings
    let customersList: string[] = [];
    if (Array.isArray(body.customers)) {
      customersList = body.customers.map((c: unknown) => String(c).trim()).filter(Boolean);
    } else if (typeof body.customers === "string" && body.customers.trim()) {
      customersList = body.customers.split(",").map((c: string) => c.trim()).filter(Boolean);
    }
    const customersJson = JSON.stringify(customersList);

    const members: { userId: number; roleSlug: string; notes?: string }[] = Array.isArray(body.members)
      ? body.members
      : [];

    const pool = await getPool();
    await ensureTeamsTables(pool);

    // Insert team
    const insertTeamRes = await pool
      .request()
      .input("name", name)
      .input("description", description)
      .input("customers", customersJson)
      .input("isActive", isActive ? 1 : 0)
      .query<{ id: number }>(`
        INSERT INTO teams (name, description, customers, isActive, createdAt, updatedAt)
        OUTPUT INSERTED.id
        VALUES (@name, @description, @customers, @isActive, GETUTCDATE(), GETUTCDATE())
      `);

    const newTeamId = insertTeamRes.recordset[0]?.id;
    if (!newTeamId) {
      throw new Error("Failed to create team record.");
    }

    // Insert members
    for (const m of members) {
      if (!m.userId || !m.roleSlug) continue;
      try {
        await pool
          .request()
          .input("teamId", newTeamId)
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
        console.warn(`[POST /api/teams] Error adding member ${m.userId}:`, memberErr);
      }
    }

    return NextResponse.json({
      success: true,
      teamId: newTeamId,
      message: `Team "${name}" created successfully.`,
    });
  } catch (err) {
    console.error("[POST /api/teams] Error:", err);
    return NextResponse.json(
      { error: "Failed to create team", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
