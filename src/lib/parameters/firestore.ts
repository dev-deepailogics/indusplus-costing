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

const COLLECTION = "parameters";

// Slugs whose doc holds multiple named/active cards instead of one table.
const CARD_LIST_SLUGS = ["cut-to-ship-grid", "rejection-grid"];

function seedFor(slug: string): unknown {
  if (slug === "cut-to-ship-grid") return asCardList(SEED_CUT_TO_SHIP);
  if (slug === "rejection-grid") return asCardList(SEED_REJECTION_GRID);
  if (slug === "dropdown-lists") return SEED_DROPDOWN_LISTS;
  return SEED_SIMPLE[slug] ?? null;
}

function asCardList<T>(seed: T): GridCardListData<T> {
  return { cards: [{ id: "1", serialNo: 1, name: "Default", isActive: true, data: seed }] };
}

// Old docs stored the table directly (no `cards` array) — wrap them in place on first read.
function migrateToCardList(slug: string, raw: Record<string, unknown>): Record<string, unknown> {
  if (!CARD_LIST_SLUGS.includes(slug) || Array.isArray(raw.cards)) return raw;
  return asCardList(raw) as unknown as Record<string, unknown>;
}

async function ensureSeeded(slug: string) {
  const ref = doc(db, COLLECTION, slug);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const seed = seedFor(slug);
    if (seed) await setDoc(ref, seed as Record<string, unknown>);
    return;
  }

  const data = snap.data();
  const migrated = migrateToCardList(slug, data);
  if (migrated !== data) {
    await setDoc(ref, migrated);
    return;
  }

  if (slug === "rejection-grid") {
    // If any rejection-grid card is missing the WIP process, force re-seed that card's table shape.
    const list = migrated as unknown as GridCardListData<ProcessMatrixTableData>;
    const needsMigration = list.cards?.some((c) => c.data.processes && !c.data.processes.includes("WIP"));
    if (needsMigration) {
      const seed = seedFor(slug) as GridCardListData<ProcessMatrixTableData>;
      const nextCards = list.cards.map((c) =>
        c.data.processes && !c.data.processes.includes("WIP") ? { ...c, data: seed.cards[0].data } : c
      );
      await setDoc(ref, { cards: nextCards });
    }
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
