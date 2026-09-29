import { NextResponse } from "next/server";
import { getPool, sql } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";

/**
 * POST /api/db/seed
 * One-time seed: creates the users table (if not exists) and inserts
 * the default admin@gmail.com user (only if no users exist yet).
 */
export async function POST() {
  try {
    const pool = await getPool();

    // Create table if not exists
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users'
      )
      BEGIN
        CREATE TABLE users (
          id              INT IDENTITY(1,1) PRIMARY KEY,
          email           NVARCHAR(255) NOT NULL UNIQUE,
          displayName     NVARCHAR(255) NOT NULL,
          passwordHash    NVARCHAR(255) NOT NULL,
          role            NVARCHAR(50)  NOT NULL DEFAULT 'merchant',
          assignedCustomer NVARCHAR(255) NULL,
          isActive        BIT           NOT NULL DEFAULT 1,
          mustResetPassword BIT         NOT NULL DEFAULT 0,
          createdAt       DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
          updatedAt       DATETIME2     NOT NULL DEFAULT GETUTCDATE()
        );
      END
      IF NOT EXISTS (
        SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = 'users' AND COLUMN_NAME = 'assignedCustomer'
      )
      BEGIN
        ALTER TABLE users ADD assignedCustomer NVARCHAR(255) NULL;
      END
    `);

    // Check if any users exist
    const countResult = await pool
      .request()
      .query<{ cnt: number }>(`SELECT COUNT(*) AS cnt FROM users`);
    const count = countResult.recordset[0]?.cnt ?? 0;

    if (count > 0) {
      return NextResponse.json({
        message: `Seed skipped — ${count} user(s) already exist.`,
        seeded: false,
      });
    }

    // Seed admin user
    const adminHash = await hashPassword("Admin@123");
    await pool
      .request()
      .input("email", sql.NVarChar(255), "admin@gmail.com")
      .input("displayName", sql.NVarChar(255), "Admin")
      .input("passwordHash", sql.NVarChar(255), adminHash)
      .input("role", sql.NVarChar(50), "admin")
      .query(
        `INSERT INTO users (email, displayName, passwordHash, role)
         VALUES (@email, @displayName, @passwordHash, @role)`,
      );

    return NextResponse.json({
      message: "Database seeded — admin@gmail.com created with password Admin@123",
      seeded: true,
    });
  } catch (err) {
    console.error("Seed error:", err);
    return NextResponse.json(
      { error: "Seed failed. Check server logs." },
      { status: 500 },
    );
  }
}
