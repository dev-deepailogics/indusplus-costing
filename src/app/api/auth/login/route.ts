import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { fetchPermissionsForRole } from "@/lib/rbac/server";

// ── Simple in-memory rate limiter (per-process; good enough for single-server) ──
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }

  entry.count += 1;
  return entry.count > MAX_ATTEMPTS;
}

function clearRateLimit(ip: string): void {
  attempts.delete(ip);
}

export async function POST(request: Request) {
  try {
    // Rate limiting
    const forwarded = request.headers.get("x-forwarded-for");
    const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429 },
      );
    }

    // Parse body
    const body = await request.json().catch(() => null);
    if (!body || typeof body.email !== "string" || typeof body.password !== "string") {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const email = body.email.trim().toLowerCase();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    // Look up user (with resilient fallback if assignedCustomer column missing)
    const pool = await getPool();
    let user: {
      id: number;
      email: string;
      displayName: string;
      passwordHash: string;
      role: string;
      assignedCustomer?: string | null;
      isActive: boolean;
      mustResetPassword: boolean;
    } | undefined;

    try {
      const result = await pool
        .request()
        .input("email", email)
        .query<{
          id: number;
          email: string;
          displayName: string;
          passwordHash: string;
          role: string;
          assignedCustomer: string | null;
          isActive: boolean;
          mustResetPassword: boolean;
        }>(
          `SELECT id, email, displayName, passwordHash, role, assignedCustomer, isActive, mustResetPassword
           FROM users
           WHERE email = @email`,
        );
      user = result.recordset[0];
    } catch {
      const fallbackResult = await pool
        .request()
        .input("email", email)
        .query<{
          id: number;
          email: string;
          displayName: string;
          passwordHash: string;
          role: string;
          isActive: boolean;
          mustResetPassword: boolean;
        }>(
          `SELECT id, email, displayName, passwordHash, role, isActive, mustResetPassword
           FROM users
           WHERE email = @email`,
        );
      if (fallbackResult.recordset[0]) {
        user = {
          ...fallbackResult.recordset[0],
          assignedCustomer: null,
        };
      }
    }

    if (!user) {
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 },
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "This account has been deactivated. Contact an administrator." },
        { status: 403 },
      );
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 },
      );
    }

    // Fetch dynamic permissions for this user's role
    const permissions = await fetchPermissionsForRole(user.role);

    // Success — clear rate limit, create session with permissions
    clearRateLimit(ip);

    await createSession({
      userId: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      assignedCustomer: user.assignedCustomer ?? null,
      permissions,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        assignedCustomer: user.assignedCustomer ?? null,
        mustResetPassword: user.mustResetPassword,
        permissions,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
