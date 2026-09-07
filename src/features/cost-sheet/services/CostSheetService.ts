import type { SavedCostSheetItem } from "../types";

const BASE = "/api/cost-sheets";
const POLL_INTERVAL_MS = 30_000;

export class CostSheetService {
  public static async getNextCostSheetId(styleId: string): Promise<string> {
    const res = await fetch(
      `${BASE}?styleId=${encodeURIComponent(styleId)}&nextId=1`,
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error("Failed to get next cost sheet ID");
    const data = await res.json();
    return data.nextId as string;
  }

  public static subscribe(
    callback: (items: SavedCostSheetItem[]) => void,
    onError?: (error: Error) => void
  ): () => void {
    let cancelled = false;
    let abortController: AbortController | null = null;

    async function fetchAndNotify() {
      try {
        if (abortController) abortController.abort();
        abortController = new AbortController();

        const res = await fetch(BASE, {
          cache: "no-store",
          signal: abortController.signal,
        });
        if (!res.ok) throw new Error("Fetch failed");
        const data: SavedCostSheetItem[] = await res.json();
        if (!cancelled) callback(data);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (!cancelled) {
          console.error("[CostSheetService.subscribe] fetch error:", err);
          if (err instanceof Error) onError?.(err);
        }
      }
    }

    fetchAndNotify();

    const timerId = setInterval(() => {
      if (!cancelled) fetchAndNotify();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (abortController) abortController.abort();
      clearInterval(timerId);
    };
  }

  public static async getById(id: string): Promise<SavedCostSheetItem | null> {
    try {
      const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Fetch failed");
      return (await res.json()) as SavedCostSheetItem;
    } catch (err) {
      console.error("[CostSheetService.getById] error:", err);
      return null;
    }
  }

  public static async save(item: SavedCostSheetItem): Promise<void> {
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

  public static async delete(id: string): Promise<void> {
    const res = await fetch(`${BASE}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to delete cost sheet: ${text}`);
    }
  }
}
