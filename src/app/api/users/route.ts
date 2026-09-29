import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { getPool } from "@/lib/db";
import { checkSessionPermission } from "@/lib/rbac/server";

/**
 * GET /api/users — list all users (admin or users:view)
 */
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const hasPerm = await checkSessionPermission(session, "users", "view");
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pool = await getPool();


    const result = await pool.request().query(
      `SELECT id, email, displayName, role, assignedCustomer, isActive, mustResetPassword, createdAt, updatedAt
       FROM users
       ORDER BY createdAt ASC`,
    );

    return NextResponse.json({ users: result.recordset });
  } catch (err) {
    console.error("Fetch users error:", err);
    return NextResponse.json({ error: "Failed to fetch users." }, { status: 500 });
  }
}

/**
 * POST /api/users — create a new user (admin or users:create)
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const hasPerm = await checkSessionPermission(session, "users", "create");
    if (!hasPerm) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const email = (typeof body.email === "string" ? body.email : "").trim().toLowerCase();
    const displayName = (typeof body.displayName === "string" ? body.displayName : "").trim();
    const password = typeof body.password === "string" ? body.password : "";
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
    const pool = await getPool();

    // Ensure column exists
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'assignedCustomer'
      )
      BEGIN
        ALTER TABLE users ADD assignedCustomer NVARCHAR(1000) NULL;
      END
    `);

    // Validate role slug exists in the roles table (graceful fallback)
    let role = typeof body.role === "string" ? body.role.trim() : "merchant";
    try {
      const roleCheck = await pool
        .request()
        .input("slug", role)
        .query<{ slug: string }>(`SELECT slug FROM roles WHERE slug = @slug AND isActive = 1`);
      if (roleCheck.recordset.length === 0) {
        role = "merchant"; // fallback
      }
    } catch {
      // If roles table doesn't exist yet (pre-migration), accept any string
    }

    // Validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }
    if (!displayName) {
      return NextResponse.json({ error: "Display name is required." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 },
      );
    }

    // Check uniqueness
    const existing = await pool
      .request()
      .input("email", email)
      .query<{ id: number }>(`SELECT id FROM users WHERE email = @email`);

    if (existing.recordset.length > 0) {
      return NextResponse.json(
        { error: "A user with this email already exists." },
        { status: 409 },
      );
    }

    // Hash & insert
    const passwordHash = await hashPassword(password);
    const insert = await pool
      .request()
      .input("email", email)
      .input("displayName", displayName)
      .input("passwordHash", passwordHash)
      .input("role", role)
      .input("assignedCustomer", assignedCustomer)
      .query<{ id: number }>(
        `INSERT INTO users (email, displayName, passwordHash, role, assignedCustomer, mustResetPassword)
         OUTPUT INSERTED.id
         VALUES (@email, @displayName, @passwordHash, @role, @assignedCustomer, 1)`,
      );

    const newId = insert.recordset[0]?.id;

    return NextResponse.json(
      {
        user: {
          id: newId,
          email,
          displayName,
          role,
          assignedCustomer,
          isActive: true,
          mustResetPassword: true,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Create user error:", err);
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }
}
