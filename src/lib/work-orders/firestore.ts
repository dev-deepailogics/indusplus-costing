import { collection, doc, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { WorkOrderItem } from "./types";

const COLLECTION = "work_orders";

export function subscribeToWorkOrders(onData: (items: WorkOrderItem[]) => void): () => void {
  const ref = collection(db, COLLECTION);
  return onSnapshot(ref, (snap) => {
    const items: WorkOrderItem[] = [];
    snap.forEach((docSnap) => {
      items.push({ ...(docSnap.data() as WorkOrderItem), id: docSnap.id });
    });
    onData(items);
  });
}

export async function saveWorkOrder(item: WorkOrderItem): Promise<void> {
  const ref = doc(db, COLLECTION, item.id);
  await setDoc(ref, item);
}

export async function deleteWorkOrder(id: string): Promise<void> {
  const ref = doc(db, COLLECTION, id);
  await deleteDoc(ref);
}
