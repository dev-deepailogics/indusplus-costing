import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { SectionPermission } from "@/lib/rbac/permissions";

const COOKIE_NAME = "session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

export interface SessionPayload extends JWTPayload {
  userId: number;
  email: string;
  displayName: string;
  role: string;
  assignedCustomer?: string | null;
  permissions: SectionPermission[];
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET env var is not set");
  return new TextEncoder().encode(secret);
}

/**
 * Create a signed JWT and set it as an HTTP-only cookie.
 */
export async function createSession(payload: {
  userId: number;
  email: string;
  displayName: string;
  role: string;
  assignedCustomer?: string | null;
  permissions: SectionPermission[];
}): Promise<string> {
  const token = await new SignJWT({
    userId: payload.userId,
    email: payload.email,
    displayName: payload.displayName,
    role: payload.role,
    assignedCustomer: payload.assignedCustomer ?? null,
    permissions: payload.permissions,
  } satisfies Omit<SessionPayload, keyof JWTPayload>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // set COOKIE_SECURE=false when serving over plain http (e.g. LAN IP)
    secure: process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE !== "false",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  return token;
}

/**
 * Read and verify the session cookie.
 * Returns the decoded payload or null if invalid / expired / missing.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  try {
    const { payload } = await jwtVerify(cookie.value, getSecret());
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Delete the session cookie.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
