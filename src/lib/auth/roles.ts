import { Role } from "@/features/auth/types";
import { AuthService, MERCHANT_ROUTES } from "@/features/auth/services/AuthService";

export type { Role };
export { MERCHANT_ROUTES };
export const canAccessRoute = (role: Role, pathname: string): boolean => AuthService.canAccessRoute(role, pathname);
