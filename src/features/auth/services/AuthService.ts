import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type UserCredential,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import { auth } from "@/lib/firebase";

export const MERCHANT_ROUTES = ["/cost-sheet", "/cost-sheets"];

export class AuthService {
  public static async signIn(email: string, password: string): Promise<UserCredential> {
    return signInWithEmailAndPassword(auth, email, password);
  }

  public static async signUp(
    email: string,
    password: string,
    displayName: string
  ): Promise<UserCredential> {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName.trim()) {
      await updateProfile(credential.user, { displayName: displayName.trim() });
    }
    return credential;
  }

  public static async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  }

  public static canAccessRoute(role: string, pathname: string): boolean {
    if (role === "admin") return true;
    return MERCHANT_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));
  }

  public static getErrorMessage(error: unknown): string {
    if (error instanceof FirebaseError) {
      switch (error.code) {
        case "auth/invalid-email":
          return "Please enter a valid email address.";
        case "auth/user-disabled":
          return "This account has been disabled.";
        case "auth/user-not-found":
        case "auth/wrong-password":
        case "auth/invalid-credential":
          return "Incorrect email or password.";
        case "auth/email-already-in-use":
          return "An account with this email already exists.";
        case "auth/weak-password":
          return "Password must be at least 6 characters.";
        case "auth/too-many-requests":
          return "Too many attempts. Please try again later.";
        default:
          return error.message;
      }
    }
    if (error instanceof Error) {
      return error.message;
    }
    return "An unexpected error occurred. Please try again.";
  }
}
