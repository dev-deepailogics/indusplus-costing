"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, Trash2, AlertTriangle, Loader2, Check } from "lucide-react";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { MatrixTableData } from "@/lib/parameters/types";
import { PromptDialog } from "./prompt-dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import { AddQuantityBandDialog, parseQtyBandValidation, sortQtyRowLabels } from "./add-quantity-band-dialog";

function validateQtyBands(rowLabels: string[]): {
  isValid: boolean;
  errors: string[];
  conflictingRows: Set<string>;
} {
  const errors: string[] = [];
  const conflictingRows = new Set<string>();

  const parsed = rowLabels.map((lbl) => {
    const valRes = parseQtyBandValidation(lbl);
    if (!valRes.isValid) {
      errors.push(`Row "${lbl}": ${valRes.error || "Only numerical ranges are allowed."}`);
      conflictingRows.add(lbl);
      return { label: lbl, range: null };
    }
    return {
      label: lbl,
      range: { from: valRes.from!, to: valRes.to! },
    };
  });

  for (let i = 0; i < parsed.length; i++) {
    const itemA = parsed[i];
    if (!itemA.range) continue;

    for (let j = i + 1; j < parsed.length; j++) {
      const itemB = parsed[j];
      if (!itemB.range) continue;

      // Check overlap: max(fromA, fromB) <= min(toA, toB)
      const maxFrom = Math.max(itemA.range.from, itemB.range.from);
      const minTo = Math.min(itemA.range.to, itemB.range.to);

      if (maxFrom <= minTo) {
        errors.push(`Overlapping quantity ranges between "${itemA.label}" and "${itemB.label}".`);
        conflictingRows.add(itemA.label);
        conflictingRows.add(itemB.label);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    conflictingRows,
  };
}

function RowLabelInput({
  initialValue,
  isQty,
  isConflicting,
  onCommit,
}: {
  initialValue: string;
  isQty: boolean;
  isConflicting: boolean;
  onCommit: (newVal: string) => void;
}) {
  const [val, setVal] = useState(initialValue);

  useEffect(() => {
    setVal(initialValue);
  }, [initialValue]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    let inputVal = e.target.value;
    if (isQty) {
      // Allow letters only if spelling 'Capacity Qty'
      if (/^[capacityqty\s]*$/i.test(inputVal)) {
        setVal(inputVal);
        return;
      }
      // Strictly numerical range characters: numbers, operators, dashes, spaces
      inputVal = inputVal.replace(/[^0-9><=\-\s,]/g, "");
    }
    setVal(inputVal);
  }

  function handleBlur() {
    const trimmed = val.trim();
    if (!trimmed || trimmed === initialValue) {
      setVal(initialValue);
      return;
    }

    if (isQty) {
      const check = parseQtyBandValidation(trimmed);
      if (!check.isValid) {
        toast.error(`Invalid quantity band: ${check.error || "Only numerical ranges are allowed."}`);
        setVal(initialValue); // Revert invalid input
        return;
      }
    }

    onCommit(trimmed);
  }

  return (
    <Input
      className={`h-8 w-36 font-semibold transition-colors ${
        isConflicting
          ? "border-2 border-red-500 bg-red-50/80 text-red-900 focus:border-red-600 focus:ring-1 focus:ring-red-500"
          : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 hover:bg-white focus:bg-white"
      }`}
      value={val}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

export function MatrixTableEditor({
  data,
  onSave,
  rowLabelHeader = "Qty.",
}: {
  data: MatrixTableData;
  onSave: (data: MatrixTableData) => Promise<void>;
  rowLabelHeader?: string;
}) {
  const [localData, setLocalData] = useState<MatrixTableData>(() => {
    if (!data) return data;
    const rowLabels = rowLabelHeader === "Qty."
      ? sortQtyRowLabels(data.rowLabels || [])
      : (data.rowLabels || []);
    return { ...data, rowLabels };
  });
  const [isSaving, setIsSaving] = useState(false);
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      const rowLabels = rowLabelHeader === "Qty."
        ? sortQtyRowLabels(data.rowLabels || [])
        : (data.rowLabels || []);
      setLocalData({ ...data, rowLabels });
    }
  }, [data, rowLabelHeader]);

  const hasChanges = useMemo(() => {
    if (!data || !localData) return false;
    return JSON.stringify(data) !== JSON.stringify(localData);
  }, [data, localData]);

  const qtyValidation = useMemo(() => {
    return validateQtyBands(localData?.rowLabels || []);
  }, [localData?.rowLabels]);

  if (!localData || !localData.columnLabels || !localData.rowLabels || !localData.cells) {
    return (
      <div className="p-4 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
        Table data is empty or loading...
      </div>
    );
  }

  function updateCell(rowLabel: string, colLabel: string, value: string) {
    setLocalData((prev) => ({
      ...prev,
      cells: {
        ...prev.cells,
        [rowLabel]: {
          ...(prev.cells[rowLabel] || {}),
          [colLabel]: value,
        },
      },
    }));
  }

  function renameRow(oldLabel: string, newLabel: string) {
    const trimmed = newLabel.trim();
    if (!trimmed || trimmed === oldLabel) return;

    if (rowLabelHeader === "Qty.") {
      const valRes = parseQtyBandValidation(trimmed);
      if (!valRes.isValid) {
        toast.error(`Invalid quantity band "${trimmed}": ${valRes.error || "Only numerical ranges are allowed."}`);
        return;
      }
    }

    if (localData.rowLabels.includes(trimmed)) {
      toast.error(`A row with label "${trimmed}" already exists`);
      return;
    }

    let nextRowLabels = localData.rowLabels.map((r) => (r === oldLabel ? trimmed : r));
    if (rowLabelHeader === "Qty.") {
      nextRowLabels = sortQtyRowLabels(nextRowLabels);
    }

    const nextCells: MatrixTableData["cells"] = {};
    for (const r of localData.rowLabels) {
      if (r === oldLabel) {
        nextCells[trimmed] = localData.cells[oldLabel] || {};
      } else {
        nextCells[r] = localData.cells[r] || {};
      }
    }

    setLocalData((prev) => ({
      ...prev,
      rowLabels: nextRowLabels,
      cells: nextCells,
    }));
  }

  async function addRow(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;

    if (rowLabelHeader === "Qty.") {
      const valRes = parseQtyBandValidation(trimmed);
      if (!valRes.isValid) {
        toast.error(`Invalid quantity band "${trimmed}": ${valRes.error || "Only numerical ranges are allowed."}`);
        return;
      }
    }

    if (localData.rowLabels.includes(trimmed)) {
      toast.error("Row already exists");
      return;
    }

    let nextRowLabels = [...localData.rowLabels, trimmed];
    if (rowLabelHeader === "Qty.") {
      nextRowLabels = sortQtyRowLabels(nextRowLabels);
    }

    const nextData: MatrixTableData = {
      ...localData,
      rowLabels: nextRowLabels,
      cells: {
        ...localData.cells,
        [trimmed]: Object.fromEntries(localData.columnLabels.map((c) => [c, ""])),
      },
    };
    setLocalData(nextData);
    setIsSaving(true);
    try {
      await onSave(nextData);
      toast.success(`Row "${trimmed}" added and saved in order`);
      const testValidation = validateQtyBands(nextData.rowLabels);
      if (!testValidation.isValid) {
        toast.warning(testValidation.errors[0]);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to save new row";
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  }

  async function addColumn(label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    if (localData.columnLabels.includes(trimmed)) {
      toast.error("Column already exists");
      return;
    }
    const cells: MatrixTableData["cells"] = {};
    for (const row of localData.rowLabels) {
      cells[row] = { ...(localData.cells[row] || {}), [trimmed]: "" };
    }
    const nextData: MatrixTableData = {
      ...localData,
      columnLabels: [...localData.columnLabels, trimmed],
      cells,
    };
    setLocalData(nextData);
    setIsSaving(true);
    try {
      await onSave(nextData);
      toast.success(`Column "${trimmed}" added and saved`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to save new column";
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  }

  async function removeRow(label: string) {
    const rest = { ...localData.cells };
    delete rest[label];
    const nextData: MatrixTableData = {
      ...localData,
      rowLabels: localData.rowLabels.filter((r) => r !== label),
      cells: rest,
    };
    setLocalData(nextData);
    setIsSaving(true);
    try {
      await onSave(nextData);
      toast.success(`Row "${label}" deleted from database`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete row";
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  }

  async function removeColumn(label: string) {
    const cells: MatrixTableData["cells"] = {};
    for (const row of localData.rowLabels) {
      const rest = { ...(localData.cells[row] || {}) };
      delete rest[label];
      cells[row] = rest;
    }
    const nextData: MatrixTableData = {
      ...localData,
      columnLabels: localData.columnLabels.filter((c) => c !== label),
      cells,
    };
    setLocalData(nextData);
    setIsSaving(true);
    try {
      await onSave(nextData);
      toast.success(`Column "${label}" deleted from database`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to delete column";
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleManualSave() {
    if (!qtyValidation.isValid) {
      toast.error(qtyValidation.errors[0] || "Please resolve quantity conflicts before saving.");
      return;
    }
    setIsSaving(true);
    try {
      await onSave(localData);
      toast.success("Changes saved successfully");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to save parameter table";
      toast.error(errorMsg);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Range validation alert banner */}
      {!qtyValidation.isValid && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-red-300 bg-red-50/80 dark:bg-red-950/30 text-red-900 dark:text-red-300 text-xs animate-in fade-in">
          <AlertTriangle className="size-4 shrink-0 text-red-600 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold">Quantity range conflict detected:</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {qtyValidation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-48">{rowLabelHeader}</TableHead>
              {localData.columnLabels.map((col) => (
                <TableHead key={col}>
                  <span className="font-semibold text-foreground text-xs">{col}</span>
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {localData.rowLabels.map((row) => (
              <TableRow key={row}>
                <TableCell className="font-medium">
                  <RowLabelInput
                    initialValue={row}
                    isQty={rowLabelHeader === "Qty."}
                    isConflicting={qtyValidation.conflictingRows.has(row)}
                    onCommit={(newLabel) => renameRow(row, newLabel)}
                  />
                </TableCell>
                {localData.columnLabels.map((col) => (
                  <TableCell key={col}>
                    <Input
                      className="h-8 w-28 text-right font-medium"
                      value={localData.cells[row]?.[col] ?? ""}
                      onChange={(e) => updateCell(row, col, e.target.value)}
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteRow(row)}
                    title={`Delete row ${row}`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setAddRowOpen(true)}>
            <Plus className="size-3.5 mr-1" /> Add row
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {hasChanges && (
            <Button
              size="sm"
              disabled={!qtyValidation.isValid || isSaving}
              className={
                qtyValidation.isValid
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-sm"
                  : "bg-muted text-muted-foreground cursor-not-allowed gap-1.5"
              }
              onClick={handleManualSave}
            >
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="size-4" /> Save Changes
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {rowLabelHeader === "Qty." ? (
        <AddQuantityBandDialog
          open={addRowOpen}
          onOpenChange={setAddRowOpen}
          existingRows={localData.rowLabels}
          onSubmit={addRow}
        />
      ) : (
        <PromptDialog
          open={addRowOpen}
          onOpenChange={setAddRowOpen}
          title={`Add ${rowLabelHeader.toLowerCase()}`}
          label={`Enter ${rowLabelHeader.toLowerCase()}`}
          onSubmit={addRow}
        />
      )}
      <ConfirmDeleteDialog
        open={deleteRow !== null}
        onOpenChange={(open) => !open && setDeleteRow(null)}
        title={`Delete row "${deleteRow}"?`}
        description="This removes the row and all its values. This cannot be undone."
        onConfirm={() => deleteRow && removeRow(deleteRow)}
      />
    </div>
  );
}
