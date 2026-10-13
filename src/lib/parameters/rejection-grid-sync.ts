import type { MatrixTableData } from "@/features/parameters/types";

export type QtyBandMode = "range" | "operator" | "capacity";

export function parseQtyBandValidation(label: string): {
  isValid: boolean;
  error?: string;
  from?: number;
  to?: number;
} {
  const clean = label.trim().toLowerCase().replace(/,/g, "");
  if (!clean) {
    return { isValid: false, error: "Quantity band cannot be empty." };
  }

  if (clean === "capacity qty" || clean === "capacity") {
    return { isValid: true, from: 125000, to: Infinity };
  }

  // Operator check: e.g. <=500, <500, >=30000, >30000
  const opMatch = clean.match(/^([<>]=?)\s*(\d+)$/);
  if (opMatch) {
    const op = opMatch[1];
    const val = parseInt(opMatch[2], 10);
    if (isNaN(val) || val <= 0) {
      return { isValid: false, error: "Please enter a valid positive number." };
    }
    if (op === "<=") return { isValid: true, from: 1, to: val };
    if (op === "<") return { isValid: true, from: 1, to: Math.max(1, val - 1) };
    if (op === ">=") return { isValid: true, from: val, to: Infinity };
    if (op === ">") return { isValid: true, from: val + 1, to: Infinity };
  }

  // Range check: 501-1000 or 501 to 1000 (strictly numbers on both sides)
  const rangeMatch = clean.match(/^(\d+)\s*(?:-|to)\s*(\d+)$/);
  if (rangeMatch) {
    const from = parseInt(rangeMatch[1], 10);
    const to = parseInt(rangeMatch[2], 10);
    if (isNaN(from) || isNaN(to)) {
      return { isValid: false, error: "Both range values must be valid numbers." };
    }
    if (from <= 0 || to <= 0) {
      return { isValid: false, error: "Quantities must be greater than 0." };
    }
    if (from >= to) {
      return {
        isValid: false,
        error: `Start quantity (${from}) must be less than end quantity (${to}).`,
      };
    }
    return { isValid: true, from, to };
  }

  // Single number
  if (/^\d+$/.test(clean)) {
    const val = parseInt(clean, 10);
    if (val <= 0) return { isValid: false, error: "Quantity must be greater than 0." };
    return { isValid: true, from: val, to: val };
  }

  return {
    isValid: false,
    error: "Only numerical values or ranges are allowed (e.g. 25001-30000, >30000, <=500).",
  };
}

export function sortQtyRowLabels(rowLabels: string[]): string[] {
  return [...rowLabels].sort((a, b) => {
    const resA = parseQtyBandValidation(a);
    const resB = parseQtyBandValidation(b);

    const fromA = resA.isValid && resA.from !== undefined ? resA.from : 999999999;
    const fromB = resB.isValid && resB.from !== undefined ? resB.from : 999999999;

    if (fromA !== fromB) {
      return fromA - fromB;
    }

    const toA = resA.isValid && resA.to !== undefined ? resA.to : 999999999;
    const toB = resB.isValid && resB.to !== undefined ? resB.to : 999999999;
    return toA - toB;
  });
}

export const DEFAULT_WASH_TYPES = [
  "Dyeing",
  "EW/Biopolish",
  "EW/Bleach",
  "EW/Caustic",
  "Stone Bleach",
  "Stone Caustic",
  "Stone Wash",
  "Pinky Random",
  "Bleach Random",
  "Snow Random",
  "Rinse",
  "Rinse/Softner",
  "Softner",
  "Silicon Ball",
];

export const DEFAULT_STYLE_CATEGORIES = [
  "Basic",
  "Semi Fashion",
  "Fashion",
  "High Fashion",
];

/**
 * Synchronizes quantity bands across all process tables in the rejection grid.
 *
 * Rules:
 * 1. Quantity bands are rows in standard processes (Fabric, Cutting, Sewing, Finishing, WIP, E1, etc.).
 * 2. Quantity bands are columns in Washing (where rows are Wash Types).
 * 3. Whenever a quantity band is added, removed, or modified in any process (typically Fabric),
 *    it is immediately reflected in all other processes (as rows) and in Washing (as columns).
 * 4. Existing cell values are preserved. If a new band was split or added from >25000,
 *    any available previous rate is carried over as default.
 */
export function syncProcessTables(
  sourceProcess: string,
  updatedTable: MatrixTableData,
  currentTables: Record<string, MatrixTableData>,
  processes: string[] = ["Fabric", "Cutting", "Sewing", "Finishing", "WIP", "E1", "Washing"],
  dynamicStyleCategories?: string[]
): Record<string, MatrixTableData> {
  // Determine canonical quantity bands from the updated table
  let canonicalBands: string[];
  if (sourceProcess === "Washing") {
    canonicalBands = sortQtyRowLabels(updatedTable.columnLabels || []);
  } else {
    canonicalBands = sortQtyRowLabels(updatedTable.rowLabels || []);
  }

  // If no canonical bands found, fallback to Fabric or existing
  if (canonicalBands.length === 0) {
    const fallbackSource =
      currentTables["Fabric"]?.rowLabels ||
      currentTables[processes[0]]?.rowLabels ||
      [];
    canonicalBands = sortQtyRowLabels(fallbackSource);
  }

  const result: Record<string, MatrixTableData> = {};

  // 1. Process all standard processes (Fabric, Cutting, Sewing, Finishing, WIP, E1...)
  for (const proc of processes) {
    if (proc === "Washing") continue;

    const baseTable = proc === sourceProcess ? updatedTable : currentTables[proc];
    let colLabels: string[];
    if (dynamicStyleCategories && dynamicStyleCategories.length > 0) {
      colLabels = [...dynamicStyleCategories];
    } else if (baseTable?.columnLabels && baseTable.columnLabels.length > 0) {
      colLabels = baseTable.columnLabels;
    } else {
      colLabels = DEFAULT_STYLE_CATEGORIES;
    }

    const existingCells = baseTable?.cells || {};
    const newCells: Record<string, Record<string, string>> = {};

    for (const band of canonicalBands) {
      newCells[band] = {};
      for (const col of colLabels) {
        if (existingCells[band]?.[col] !== undefined) {
          // Keep existing saved value for this band
          newCells[band][col] = existingCells[band][col];
        } else if (proc === sourceProcess && baseTable.cells?.[band]?.[col] !== undefined) {
          // Use whatever was set on the source table for this band
          newCells[band][col] = baseTable.cells[band][col];
        } else {
          // Newly added row is empty so user can fill in values
          newCells[band][col] = "";
        }
      }
    }

    result[proc] = {
      rowLabels: canonicalBands,
      columnLabels: colLabels,
      cells: newCells,
    };
  }

  // 2. Process Washing (rows = Wash Types, columns = Quantity Bands)
  const baseWashing = sourceProcess === "Washing" ? updatedTable : currentTables["Washing"];
  const washTypeRows =
    baseWashing?.rowLabels && baseWashing.rowLabels.length > 0
      ? baseWashing.rowLabels
      : DEFAULT_WASH_TYPES;

  const existingWashingCells = baseWashing?.cells || {};
  const newWashingCells: Record<string, Record<string, string>> = {};

  for (const wt of washTypeRows) {
    newWashingCells[wt] = {};
    const rowCells = existingWashingCells[wt] || {};
    for (const band of canonicalBands) {
      if (rowCells[band] !== undefined) {
        // Keep existing saved value for this band in Washing
        newWashingCells[wt][band] = rowCells[band];
      } else if (sourceProcess === "Washing" && baseWashing.cells?.[wt]?.[band] !== undefined) {
        newWashingCells[wt][band] = baseWashing.cells[wt][band];
      } else {
        // Newly added column in Washing is empty so user can fill in values
        newWashingCells[wt][band] = "";
      }
    }
  }

  result["Washing"] = {
    rowLabels: washTypeRows,
    columnLabels: canonicalBands,
    cells: newWashingCells,
  };

  return result;
}

/**
 * Extracts and sorts the complete set of quantity bands across ALL process tables (rows for standard processes, columns for Washing).
 */
export function getCanonicalBandsFromAllTables(
  tables: Record<string, MatrixTableData>,
  processes: string[] = ["Fabric", "Cutting", "Sewing", "Finishing", "WIP", "E1", "Washing"]
): string[] {
  const bandsSet = new Set<string>();

  for (const p of processes) {
    const table = tables[p];
    if (!table) continue;
    if (p === "Washing") {
      (table.columnLabels || []).forEach((b) => b && bandsSet.add(b.trim()));
    } else {
      (table.rowLabels || []).forEach((b) => b && bandsSet.add(b.trim()));
    }
  }

  return sortQtyRowLabels(Array.from(bandsSet));
}

/**
 * Ensures all processes in a rejection grid dataset are synchronized across all tabs (no matter which tab initiated the change).
 */
export function ensureSyncedProcessTables(
  tables: Record<string, MatrixTableData>,
  processes: string[] = ["Fabric", "Cutting", "Sewing", "Finishing", "WIP", "E1", "Washing"],
  dynamicStyleCategories?: string[]
): Record<string, MatrixTableData> {
  const canonicalBands = getCanonicalBandsFromAllTables(tables, processes);
  if (canonicalBands.length === 0) return tables;

  const firstStandardProc = processes.find((p) => p !== "Washing") || "Fabric";
  const masterTable: MatrixTableData = {
    rowLabels: canonicalBands,
    columnLabels:
      dynamicStyleCategories && dynamicStyleCategories.length > 0
        ? dynamicStyleCategories
        : tables[firstStandardProc]?.columnLabels || DEFAULT_STYLE_CATEGORIES,
    cells: tables[firstStandardProc]?.cells || {},
  };

  return syncProcessTables(firstStandardProc, masterTable, tables, processes, dynamicStyleCategories);
}
