export type Role = "admin" | "merchant";

// Routes a merchant may access; admins can access everything.
export const MERCHANT_ROUTES = ["/cost-sheet", "/cost-sheets"];

export function canAccessRoute(role: Role, pathname: string): boolean {
  if (role === "admin") return true;
  return MERCHANT_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
}
