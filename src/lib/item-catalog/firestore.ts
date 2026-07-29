import { collection, doc, addDoc, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CatalogItem } from "./types";

export const FABRIC_COLLECTION = "fabric_items";
export const LINING_COLLECTION = "lining_items";

export function subscribeToCatalog(
  collectionName: string,
  onData: (items: CatalogItem[]) => void,
): () => void {
  const ref = collection(db, collectionName);
  return onSnapshot(ref, (snap) => {
    const items: CatalogItem[] = [];
    snap.forEach((docSnap) => {
      items.push({ ...(docSnap.data() as CatalogItem), id: docSnap.id });
    });
    onData(items);
  });
}

export async function addCatalogItem(collectionName: string, name: string): Promise<void> {
  await addDoc(collection(db, collectionName), { name });
}

export async function updateCatalogItem(
  collectionName: string,
  id: string,
  name: string,
): Promise<void> {
  await updateDoc(doc(db, collectionName, id), { name });
}

export async function deleteCatalogItem(collectionName: string, id: string): Promise<void> {
  await deleteDoc(doc(db, collectionName, id));
}
