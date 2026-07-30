import { collection, doc, getDoc, getDocs, onSnapshot, setDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { SavedCostSheetItem } from "./types";

const COLLECTION = "pre_order_cost_sheets";

// Next sequential cost sheet ID for a style, e.g. PCS-STY-001-0001, -0002, ...
export async function getNextCostSheetId(styleId: string): Promise<string> {
  const prefix = `PCS-${styleId}-`;
  const snap = await getDocs(collection(db, COLLECTION));
  let maxSeq = 0;
  snap.forEach((d) => {
    if (!d.id.startsWith(prefix)) return;
    const seq = parseInt(d.id.slice(prefix.length), 10);
    if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
  });
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

// Subscribe to real-time updates for saved cost sheets
export function subscribeToCostSheets(callback: (items: SavedCostSheetItem[]) => void) {
  const colRef = collection(db, COLLECTION);
  return onSnapshot(colRef, (snapshot) => {
    const items: SavedCostSheetItem[] = [];
    snapshot.forEach((doc) => {
      items.push({ ...doc.data() } as SavedCostSheetItem);
    });
    // Sort by savedAt descending
    items.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    callback(items);
  });
}

// Retrieve a single cost sheet by ID
export async function getCostSheetById(id: string): Promise<SavedCostSheetItem | null> {
  try {
    const docRef = doc(db, COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as SavedCostSheetItem;
    }
    return null;
  } catch (e) {
    console.error("Error fetching cost sheet by id:", e);
    return null;
  }
}

// Save a cost sheet to Firestore (Create or Update)
export async function saveCostSheet(item: SavedCostSheetItem): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, item.id);
    await setDoc(docRef, item);
  } catch (e) {
    console.error("Error saving cost sheet:", e);
    throw e;
  }
}

// Delete a cost sheet from Firestore
export async function deleteCostSheet(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION, id);
    await deleteDoc(docRef);
  } catch (e) {
    console.error("Error deleting cost sheet:", e);
    throw e;
  }
}
