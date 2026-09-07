import { AuthService } from "@/features/auth";

export function authErrorMessage(error: unknown): string {
  return AuthService.getErrorMessage(error);
}
