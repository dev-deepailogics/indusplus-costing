import { FirebaseError } from "firebase/app";

const MESSAGES: Record<string, string> = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "No account found with that email.",
  "auth/wrong-password": "Incorrect password.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/email-already-in-use": "An account with that email already exists.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
};

export function authErrorMessage(error: unknown): string {
  if (error instanceof FirebaseError) {
    return MESSAGES[error.code] ?? "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}
