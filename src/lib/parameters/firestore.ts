import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  SEED_CUT_TO_SHIP,
  SEED_DROPDOWN_LISTS,
  SEED_REJECTION_GRID,
  SEED_SIMPLE,
} from "./seed-data";
import type { DropdownListsData, MatrixTableData, ProcessMatrixTableData, SimpleTableData } from "./types";

const COLLECTION = "parameters";

function seedFor(slug: string): unknown {
  if (slug === "cut-to-ship-grid") return SEED_CUT_TO_SHIP;
  if (slug === "rejection-grid") return SEED_REJECTION_GRID;
  if (slug === "dropdown-lists") return SEED_DROPDOWN_LISTS;
  return SEED_SIMPLE[slug] ?? null;
}

async function ensureSeeded(slug: string) {
  const ref = doc(db, COLLECTION, slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const seed = seedFor(slug);
    if (seed) await setDoc(ref, seed as Record<string, unknown>);
  }
}

export function subscribeToTable<T>(
  slug: string,
  onData: (data: T) => void
): () => void {
  const ref = doc(db, COLLECTION, slug);
  let unsub = () => {};
  ensureSeeded(slug).finally(() => {
    unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) onData(snap.data() as T);
    });
  });
  return () => unsub();
}

export async function saveTable(slug: string, data: unknown): Promise<void> {
  const ref = doc(db, COLLECTION, slug);
  await setDoc(ref, data as Record<string, unknown>);
}

export type { DropdownListsData, MatrixTableData, ProcessMatrixTableData, SimpleTableData };
