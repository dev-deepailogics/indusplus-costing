import { AuthService } from "@/features/auth";

export function signInWithEmail(email: string, password: string) {
  return AuthService.signIn(email, password);
}

export function signUpWithEmail(email: string, password: string, displayName: string) {
  return AuthService.signUp(email, password, displayName);
}

export function signOut() {
  return AuthService.signOut();
}
