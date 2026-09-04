/**
 * Client-side parameters service — MSSQL edition.
 *
 * Drop-in replacement for firestore.ts.
 * All data is persisted via /api/parameters/[slug] which talks to MSSQL.
 * Function signatures are identical to the Firestore version.
 */

const BASE = "/api/parameters";
const POLL_INTERVAL_MS = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// Subscribe to a parameter table with polling (MSSQL has no push).
// Returns an unsubscribe function — same contract as Firestore onSnapshot.
// ---------------------------------------------------------------------------
export function subscribeToTable<T>(
  slug: string,
  onData: (data: T) => void
): () => void {
  let cancelled = false;
  let abortController: AbortController | null = null;

  async function fetchAndNotify() {
    try {
      if (abortController) abortController.abort();
      abortController = new AbortController();

      const res = await fetch(`${BASE}/${encodeURIComponent(slug)}`, {
        cache: "no-store",
        signal: abortController.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: T = await res.json();
      if (!cancelled) onData(data);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      if (!cancelled) console.error(`[subscribeToTable:${slug}] fetch error:`, err);
    }
  }

  // Immediate first fetch
  fetchAndNotify();

  // Subsequent polls
  const timerId = setInterval(() => {
    if (!cancelled) fetchAndNotify();
  }, POLL_INTERVAL_MS);

  // Unsubscribe: stop polling and abort in-flight fetch
  return () => {
    cancelled = true;
    if (abortController) abortController.abort();
    clearInterval(timerId);
  };
}

// ---------------------------------------------------------------------------
// Save (upsert) a parameter table by slug.
// ---------------------------------------------------------------------------
export async function saveTable(slug: string, data: unknown): Promise<void> {
  const res = await fetch(`${BASE}/${encodeURIComponent(slug)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to save parameter [${slug}]: ${text}`);
  }
}

// Re-export types so existing import sites that pull types from firestore.ts continue to work
export type {
  DropdownListsData,
  MatrixTableData,
  ProcessMatrixTableData,
  SimpleTableData,
} from "./types";
