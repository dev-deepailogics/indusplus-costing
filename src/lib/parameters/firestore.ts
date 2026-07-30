import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  SEED_CUT_TO_SHIP,
  SEED_DROPDOWN_LISTS,
  SEED_REJECTION_GRID,
  SEED_SIMPLE,
} from "./seed-data";
import type {
  DropdownListsData,
  GridCardListData,
  MatrixTableData,
  ProcessMatrixTableData,
  SimpleTableData,
} from "./types";
import { getActiveCard } from "./types";

const COLLECTION = "parameters";

function seedFor(slug: string): unknown {
  if (slug === "cut-to-ship-grid") return SEED_CUT_TO_SHIP;
  if (slug === "rejection-grid") return SEED_REJECTION_GRID;
  if (slug === "dropdown-lists") return SEED_DROPDOWN_LISTS;
  return SEED_SIMPLE[slug] ?? null;
}

// Old docs stored multiple named/active cards. Collapse back to a single table
// (the active card, or the first one) so there is only ever one grid per slug.
function unwrapCardList(slug: string, raw: Record<string, unknown>): Record<string, unknown> {
  if (slug !== "cut-to-ship-grid" && slug !== "rejection-grid") return raw;
  if (!Array.isArray(raw.cards)) return raw;
  const list = raw as unknown as GridCardListData<unknown>;
  const active = getActiveCard(list);
  return (active?.data ?? {}) as Record<string, unknown>;
}

async function ensureSeeded(slug: string) {
  const ref = doc(db, COLLECTION, slug);
  const snap = await getDoc(ref);
  let needsSeeding = false;

  if (!snap.exists()) {
    needsSeeding = true;
  } else {
    const data = unwrapCardList(slug, snap.data());
    if (!data || Object.keys(data).length === 0) {
      needsSeeding = true;
    } else if (slug === "cut-to-ship-grid" && (!data.columnLabels || !data.rowLabels)) {
      needsSeeding = true;
    } else if (slug === "rejection-grid" && (!data.processes || !data.tables)) {
      needsSeeding = true;
    } else if (slug === "rejection-grid") {
      // If rejection-grid exists and does NOT have WIP in processes, force re-seeding to add it
      const processGrid = data as unknown as ProcessMatrixTableData;
      if (processGrid.processes && !processGrid.processes.includes("WIP")) {
        needsSeeding = true;
      }
    }
  }

  if (needsSeeding) {
    const seed = seedFor(slug);
    if (seed) await setDoc(ref, seed as Record<string, unknown>);
    return;
  }

  const data = snap.data();
  if (!data) return;
  const unwrapped = unwrapCardList(slug, data);
  if (unwrapped !== data) {
    await setDoc(ref, unwrapped);
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
      if (snap.exists()) onData(unwrapCardList(slug, snap.data()) as T);
    });
  });
  return () => unsub();
}

export async function saveTable(slug: string, data: unknown): Promise<void> {
  const ref = doc(db, COLLECTION, slug);
  await setDoc(ref, data as Record<string, unknown>);
}

export type { DropdownListsData, MatrixTableData, ProcessMatrixTableData, SimpleTableData };
