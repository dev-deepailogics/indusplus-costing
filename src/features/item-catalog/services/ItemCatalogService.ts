import { collection, doc, addDoc, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CatalogItem, CatalogCollectionName } from "../types";

export const FABRIC_COLLECTION = "fabric_items";
export const LINING_COLLECTION = "lining_items";

export class ItemCatalogService {
  public static subscribe(
    collectionName: CatalogCollectionName,
    onData: (items: CatalogItem[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const ref = collection(db, collectionName);
    return onSnapshot(
      ref,
      (snap) => {
        const items: CatalogItem[] = [];
        snap.forEach((docSnap) => {
          items.push({ ...(docSnap.data() as CatalogItem), id: docSnap.id });
        });
        onData(items);
      },
      (error) => {
        console.error(`ItemCatalogService subscription error [${collectionName}]:`, error);
        onError?.(error);
      }
    );
  }

  public static async addItem(collectionName: CatalogCollectionName, name: string): Promise<string> {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error("Item name cannot be empty");
    }
    const docRef = await addDoc(collection(db, collectionName), { name: cleanName });
    return docRef.id;
  }

  public static async updateItem(
    collectionName: CatalogCollectionName,
    id: string,
    name: string
  ): Promise<void> {
    const cleanName = name.trim();
    if (!cleanName) {
      throw new Error("Item name cannot be empty");
    }
    await updateDoc(doc(db, collectionName, id), { name: cleanName });
  }

  public static async deleteItem(collectionName: CatalogCollectionName, id: string): Promise<void> {
    await deleteDoc(doc(db, collectionName, id));
  }
}
