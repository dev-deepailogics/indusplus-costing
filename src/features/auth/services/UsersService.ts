import { collection, doc, getDoc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { UserProfile, Role } from "../types";

const COLLECTION = "users";

export class UsersService {
  public static async ensureUserProfile(user: {
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

  public static subscribeToUserRole(uid: string, onRole: (role: Role) => void): () => void {
    const ref = doc(db, COLLECTION, uid);
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) onRole((snap.data() as UserProfile).role);
    });
  }

  public static subscribeToAllUsers(onUsers: (users: UserProfile[]) => void): () => void {
    return onSnapshot(collection(db, COLLECTION), (snap) => {
      onUsers(snap.docs.map((d) => d.data() as UserProfile));
    });
  }

  public static async setUserRole(uid: string, role: Role): Promise<void> {
    await updateDoc(doc(db, COLLECTION, uid), { role });
  }
}
