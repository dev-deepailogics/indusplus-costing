import { collection, doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Role } from "./roles";

const COLLECTION = "users";

export type UserProfile = {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: Role;
};

// Creates the profile doc with the default role on first sign-in; leaves it untouched otherwise.
export async function ensureUserProfile(user: {
  uid: string;
  email: string | null;
  displayName: string | null;
}): Promise<Role> {
  const ref = doc(db, COLLECTION, user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    return (snap.data() as UserProfile).role;
  }
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    role: "merchant",
  };
  await setDoc(ref, profile);
  return profile.role;
}

export function subscribeToUserRole(uid: string, onRole: (role: Role) => void): () => void {
  const ref = doc(db, COLLECTION, uid);
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) onRole((snap.data() as UserProfile).role);
  });
}

export function subscribeToAllUsers(onUsers: (users: UserProfile[]) => void): () => void {
  return onSnapshot(collection(db, COLLECTION), (snap) => {
    onUsers(snap.docs.map((d) => d.data() as UserProfile));
  });
}

export function setUserRole(uid: string, role: Role): Promise<void> {
  return updateDoc(doc(db, COLLECTION, uid), { role });
}
