import type { ParameterDef } from "../types";

export const PARAMETER_TABLES: ParameterDef[] = [
  { slug: "styles", title: "Style Categories (SAM Range)", kind: "simple" },
  { slug: "cut-to-ship-grid", title: "Cut-to-Ship Grid", kind: "matrix" },
  { slug: "rejection-grid", title: "Rejection Grid", kind: "process-matrix" },
  { slug: "order-type", title: "Order Type", kind: "simple" },
  { slug: "customer-commission", title: "Customer Wise Commission", kind: "simple" },
  { slug: "cost-as-percent-of-sales", title: "Cost as % of Sales", kind: "simple" },
  { slug: "direct-labour-foh", title: "Direct Labour and FOH", kind: "simple" },
  { slug: "admin-selling", title: "Admin and Selling", kind: "simple" },
  { slug: "other-expenses", title: "Other Expenses", kind: "simple" },
  { slug: "dropdown-lists", title: "Dropdown Lists", kind: "dropdown-lists" },
];

const BASE = "/api/parameters";
const POLL_INTERVAL_MS = 30_000;

export class ParametersService {
  public static getParameterDef(slug: string): ParameterDef | undefined {
    return PARAMETER_TABLES.find((t) => t.slug === slug);
  }

  public static subscribeToTable<T>(
    slug: string,
    onData: (data: T) => void,
    onError?: (error: Error) => void
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
        if (!cancelled) {
          console.error(`[ParametersService.subscribeToTable:${slug}] fetch error:`, err);
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

  public static async saveTable(slug: string, data: unknown): Promise<void> {
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
}
