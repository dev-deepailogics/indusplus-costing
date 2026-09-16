"use client";

import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

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

export function AddQuantityBandDialog({
  open,
  onOpenChange,
  existingRows = [],
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRows?: string[];
  onSubmit: (formattedBand: string) => void;
}) {
  const [mode, setMode] = useState<QtyBandMode>("range");
  const [fromQty, setFromQty] = useState<string>("");
  const [toQty, setToQty] = useState<string>("");
  const [operator, setOperator] = useState<string>(">");
  const [opQty, setOpQty] = useState<string>("");

  const generatedBand = useMemo(() => {
    if (mode === "capacity") return "Capacity Qty";
    if (mode === "range") {
      const f = fromQty.trim();
      const t = toQty.trim();
      if (!f && !t) return "";
      if (f && t) return `${f}-${t}`;
      if (f && !t) return `>=${f}`;
      return `<=${t}`;
    }
    if (mode === "operator") {
      const q = opQty.trim();
      if (!q) return "";
      return `${operator}${q}`;
    }
    return "";
  }, [mode, fromQty, toQty, operator, opQty]);

  const validation = useMemo(() => {
    if (!generatedBand) {
      return { isValid: false, error: "Please enter quantity values." };
    }
    const valRes = parseQtyBandValidation(generatedBand);
    if (!valRes.isValid) return valRes;

    if (existingRows.includes(generatedBand)) {
      return { isValid: false, error: `Row "${generatedBand}" already exists in the table.` };
    }
    return { isValid: true };
  }, [generatedBand, existingRows]);

  function handleReset() {
    setFromQty("");
    setToQty("");
    setOpQty("");
    setOperator(">");
    setMode("range");
  }

  function handleSubmit() {
    if (!validation.isValid || !generatedBand) return;
    onSubmit(generatedBand);
    handleReset();
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) handleReset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Quantity Band</DialogTitle>
          <DialogDescription>
            Configure a numerical quantity range or tier for the Cut-to-Ship grid.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Mode Selector */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode("range")}
              className={`py-1.5 rounded-md transition-all ${
                mode === "range"
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Numeric Range
            </button>
            <button
              type="button"
              onClick={() => setMode("operator")}
              className={`py-1.5 rounded-md transition-all ${
                mode === "operator"
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Above / Below
            </button>
            <button
              type="button"
              onClick={() => setMode("capacity")}
              className={`py-1.5 rounded-md transition-all ${
                mode === "capacity"
                  ? "bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-white"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Capacity Qty
            </button>
          </div>

          {/* Range Inputs */}
          {mode === "range" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    From Quantity (Min)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 25001"
                    value={fromQty}
                    onChange={(e) => setFromQty(e.target.value.replace(/\D/g, ""))}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && validation.isValid) handleSubmit();
                    }}
                  />
                </div>
                <div className="pt-5 text-slate-400 font-bold">—</div>
                <div className="flex-1 space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                    To Quantity (Max)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="e.g. 30000"
                    value={toQty}
                    onChange={(e) => setToQty(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && validation.isValid) handleSubmit();
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Operator Inputs */}
          {mode === "operator" && (
            <div className="flex items-center gap-2">
              <div className="w-32 space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Condition
                </label>
                <select
                  value={operator}
                  onChange={(e) => setOperator(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value=">">&gt; (Greater than)</option>
                  <option value=">=">&gt;= (At least)</option>
                  <option value="<=">&lt;= (Up to)</option>
                  <option value="<">&lt; (Less than)</option>
                </select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Quantity
                </label>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 30000"
                  value={opQty}
                  onChange={(e) => setOpQty(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && validation.isValid) handleSubmit();
                  }}
                />
              </div>
            </div>
          )}

          {/* Capacity Mode Notice */}
          {mode === "capacity" && (
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-600 dark:text-slate-300">
              Capacity Qty applies to enterprise orders ($\ge 125,000$ pcs).
            </div>
          )}

          {/* Preview & Error Status */}
          <div className="rounded-lg border p-3 bg-slate-50/50 dark:bg-slate-900/30 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Resulting Label:</span>
            <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
              {generatedBand || "—"}
            </span>
          </div>

          {!validation.isValid && validation.error && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle className="size-3.5 shrink-0" />
              <span>{validation.error}</span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!validation.isValid}
            className="bg-primary hover:bg-primary/90"
          >
            Add Quantity Band
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
