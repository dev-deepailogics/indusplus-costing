import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { WorkOrderItem } from "../types";

const COLLECTION = "work_orders";

export class WorkOrdersService {
  public static subscribe(
    onData: (items: WorkOrderItem[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    const ref = collection(db, COLLECTION);
    return onSnapshot(
      ref,
      (snap) => {
        const items: WorkOrderItem[] = [];
        snap.forEach((docSnap) => {
          items.push({ ...(docSnap.data() as WorkOrderItem), id: docSnap.id });
        });
        onData(items);
      },
      (error) => {
        console.error("WorkOrdersService subscription error:", error);
        onError?.(error);
      }
    );
  }

  public static async save(item: WorkOrderItem): Promise<void> {
    const cleanId = item.id.trim();
    if (!cleanId) {
      throw new Error("Work order ID cannot be empty");
    }
    const ref = doc(db, COLLECTION, cleanId);
    await setDoc(ref, { id: cleanId, styleId: item.styleId });
  }

  public static async delete(id: string): Promise<void> {
    const ref = doc(db, COLLECTION, id);
    await deleteDoc(ref);
  }
}
