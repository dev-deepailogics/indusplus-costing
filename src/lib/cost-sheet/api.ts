/**
 * Client-side cost sheet service — MSSQL edition.
 *
 * Drop-in replacement for the old firestore.ts.
 * All data is persisted via Next.js API routes which talk to MSSQL.
 * The function signatures are identical to the Firestore version so
 * all existing call-sites only need the import path changed.
 */

import type { SavedCostSheetItem } from "./types";

const BASE = "/api/cost-sheets";

// ---------------------------------------------------------------------------
// Get the next sequential cost sheet ID for a given style.
// e.g. PCS-STY-001-0003
// ---------------------------------------------------------------------------
export async function getNextCostSheetId(styleId: string): Promise<string> {
  const res = await fetch(
    `${BASE}?styleId=${encodeURIComponent(styleId)}&nextId=1`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("Failed to get next cost sheet ID");
  const data = await res.json();
  return data.nextId as string;
}

// ---------------------------------------------------------------------------
// Subscribe to cost sheet updates with polling (MSSQL has no push).
// Returns an unsubscribe function (same contract as Firestore onSnapshot).
// ---------------------------------------------------------------------------
const POLL_INTERVAL_MS = 30_000; // 30 seconds

export function subscribeToCostSheets(
  callback: (items: SavedCostSheetItem[]) => void
): () => void {
  let cancelled = false;

  async function fetchAndNotify() {
    try {
      const res = await fetch(BASE, { cache: "no-store" });
      if (!res.ok) throw new Error("Fetch failed");
      const data: SavedCostSheetItem[] = await res.json();
      if (!cancelled) callback(data);
    } catch (err) {
      console.error("[subscribeToCostSheets] fetch error:", err);
    }
  }

  // Immediate first fetch
  fetchAndNotify();

  // Subsequent polls
  const timerId = setInterval(() => {
    if (!cancelled) fetchAndNotify();
  }, POLL_INTERVAL_MS);

  // Unsubscribe: stop polling
  return () => {
    cancelled = true;
    clearInterval(timerId);
  };
}

// ---------------------------------------------------------------------------
// Retrieve a single cost sheet by ID
// ---------------------------------------------------------------------------
export async function getCostSheetById(
  id: string
): Promise<SavedCostSheetItem | null> {
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("Fetch failed");
    return (await res.json()) as SavedCostSheetItem;
  } catch (err) {
    console.error("[getCostSheetById] error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Save a cost sheet — POST (create) or PUT (update) based on existence check.
// The server does a SELECT before deciding INSERT vs UPDATE, but we keep
// the logic here for clarity and to avoid an extra round-trip:
// - If the ID doesn't exist yet → POST
// - If it already exists → PUT
// ---------------------------------------------------------------------------
export async function saveCostSheet(item: SavedCostSheetItem): Promise<void> {
  // Determine whether this is a create or update
  const checkRes = await fetch(`${BASE}/${encodeURIComponent(item.id)}`, {
    cache: "no-store",
  });
  const isNew = checkRes.status === 404;

  const res = await fetch(
    isNew ? BASE : `${BASE}/${encodeURIComponent(item.id)}`,
    {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save cost sheet: ${text}`);
  }
}

// ---------------------------------------------------------------------------
// Delete a cost sheet by ID
// ---------------------------------------------------------------------------
export async function deleteCostSheet(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to delete cost sheet: ${text}`);
  }
}
