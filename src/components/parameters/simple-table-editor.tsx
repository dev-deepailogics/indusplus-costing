"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  Copy,
  Edit2,
  CheckCircle2,
  Power,
  Layers,
  FileSpreadsheet,
  Check,
  FolderOpen,
  AlertTriangle,
  Loader2,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import type { SimpleTableData, SimpleTableCard, SimpleColumn, SimpleRow } from "@/lib/parameters/types";
import { PromptDialog } from "./prompt-dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function parseBound(val: string, isFrom: boolean): { val: number; inclusive: boolean } {
  const trimmed = (val || "").trim();
  if (!trimmed || trimmed === "-" || trimmed === "null") {
    return { val: isFrom ? -Infinity : Infinity, inclusive: true };
  }
  if (trimmed.startsWith(">=")) {
    const num = parseFloat(trimmed.replace(">=", ""));
    return { val: isNaN(num) ? (isFrom ? -Infinity : Infinity) : num, inclusive: true };
  }
  if (trimmed.startsWith(">")) {
    const num = parseFloat(trimmed.replace(">", ""));
    return { val: isNaN(num) ? (isFrom ? -Infinity : Infinity) : num, inclusive: false };
  }
  if (trimmed.startsWith("<=")) {
    const num = parseFloat(trimmed.replace("<=", ""));
    return { val: isNaN(num) ? (isFrom ? -Infinity : Infinity) : num, inclusive: true };
  }
  if (trimmed.startsWith("<")) {
    const num = parseFloat(trimmed.replace("<", ""));
    return { val: isNaN(num) ? (isFrom ? -Infinity : Infinity) : num, inclusive: false };
  }
  const parsed = parseFloat(trimmed);
  return { val: isNaN(parsed) ? (isFrom ? -Infinity : Infinity) : parsed, inclusive: true };
}

function validateSamRanges(
  rows: SimpleRow[],
  columns: SimpleColumn[],
  templateCard?: SimpleTableCard
): {
  isValid: boolean;
  errors: string[];
  conflictingRowIds: Set<string>;
} {
  const isSamRange =
    columns.some((c) => c.key === "samPcFrom") &&
    columns.some((c) => c.key === "samPcTo");
  if (!isSamRange) return { isValid: true, errors: [], conflictingRowIds: new Set() };

  const parsedRanges: {
    rowId: string;
    label: string;
    min: number;
    max: number;
    inclusiveMin: boolean;
    inclusiveMax: boolean;
    rawFrom: string;
    rawTo: string;
  }[] = [];
  const errors: string[] = [];
  const conflictingRowIds = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const firstKey = columns[0]?.key;
    const label =
      r.values[firstKey] ||
      templateCard?.rows[i]?.values[firstKey] ||
      `Row ${i + 1}`;

    const rawFrom = (r.values.samPcFrom || "").trim();
    const rawTo = (r.values.samPcTo || "").trim();

    if (!rawFrom && !rawTo && !r.values[firstKey]) continue;

    const fromBound = parseBound(rawFrom, true);
    const toBound = parseBound(rawTo, false);

    if (fromBound.val > toBound.val) {
      errors.push(`"${label}": 'From' (${rawFrom}) cannot be greater than 'To' (${rawTo}).`);
      conflictingRowIds.add(r.id);
    }

    parsedRanges.push({
      rowId: r.id,
      label,
      min: fromBound.val,
      max: toBound.val,
      inclusiveMin: fromBound.inclusive,
      inclusiveMax: toBound.inclusive,
      rawFrom,
      rawTo,
    });
  }

  for (let i = 0; i < parsedRanges.length; i++) {
    for (let j = i + 1; j < parsedRanges.length; j++) {
      const a = parsedRanges[i];
      const b = parsedRanges[j];

      const maxMin = Math.max(a.min, b.min);
      const minMax = Math.min(a.max, b.max);

      let overlaps = false;
      if (maxMin < minMax) {
        overlaps = true;
      } else if (maxMin === minMax && maxMin !== -Infinity && maxMin !== Infinity) {
        const aIncludesPoint =
          (a.min === maxMin ? a.inclusiveMin : true) &&
          (a.max === maxMin ? a.inclusiveMax : true);
        const bIncludesPoint =
          (b.min === maxMin ? b.inclusiveMin : true) &&
          (b.max === maxMin ? b.inclusiveMax : true);
        if (aIncludesPoint && bIncludesPoint) {
          overlaps = true;
        }
      }

      if (overlaps) {
        errors.push(
          `Overlapping range: "${a.label}" (${a.rawFrom || "-"} to ${a.rawTo || "-"}) overlaps with "${b.label}" (${b.rawFrom || "-"} to ${b.rawTo || "-"}).`
        );
        conflictingRowIds.add(a.rowId);
        conflictingRowIds.add(b.rowId);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    conflictingRowIds,
  };
}

function slugifyKey(label: string): string {
  return label
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join("");
}

export function SimpleTableEditor({
  data,
  onSave,
}: {
  data: SimpleTableData;
  onSave: (data: SimpleTableData) => Promise<void>;
}) {
  // Local state for cards
  const [cards, setCards] = useState<SimpleTableCard[]>(
    (data.cards && data.cards.length > 0)
      ? data.cards
      : [
          {
            id: "card-1",
            serialNo: 1,
            name: "Card 1",
            isActive: true,
            columns: data.columns,
            rows: data.rows,
          },
        ]
  );
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const initialSelectedId =
    data.activeCardId ||
    cards.find((c) => c.isActive)?.id ||
    cards[0]?.id ||
    "card-1";

  const [selectedCardId, setSelectedCardId] = useState<string>(initialSelectedId);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [renameCardOpen, setRenameCardOpen] = useState(false);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);
  const [activeConfirmCardId, setActiveConfirmCardId] = useState<string | null>(null);

  // Sync local cards if data prop changes externally
  useEffect(() => {
    if (hasChanges) return; // Prevent overwriting unsaved changes from backend polling

    setCards(
      (data.cards && data.cards.length > 0)
        ? data.cards
        : [
            {
              id: "card-1",
              serialNo: 1,
              name: "Card 1",
              isActive: true,
              columns: data.columns,
              rows: data.rows,
            },
          ]
    );
    setHasChanges(false);
  }, [data, hasChanges]);

  // Keep selected card in sync if list changes
  useEffect(() => {
    if (!cards.some((c) => c.id === selectedCardId)) {
      const fallback = cards.find((c) => c.isActive)?.id || cards[0]?.id || "card-1";
      setSelectedCardId(fallback);
    }
  }, [cards, selectedCardId]);

  // Warn before leaving the page with unsaved changes (both browser reload and internal Next.js links)
  useEffect(() => {
    if (!hasChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as Element).closest('a');
      if (target && target.href && target.origin === window.location.origin) {
        // Prevent if navigating away from current page
        if (target.pathname !== window.location.pathname) {
          if (!window.confirm("You have unsaved changes. Are you sure you want to leave this page?")) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("click", handleClick, true);
    };
  }, [hasChanges]);

  const currentCard = cards.find((c) => c.id === selectedCardId) || cards[0];
  const currentColumns: SimpleColumn[] =
    currentCard.columns && currentCard.columns.length > 0
      ? currentCard.columns
      : data.columns;
  const currentRows: SimpleRow[] = currentCard.rows || [];

  // Detect if this table has SAM and PER PIECE columns
  const hasSamAndPiece =
    currentColumns.some(
      (c) =>
        c.key.toLowerCase().includes("costsam") ||
        c.key.toLowerCase().includes("costpersam") ||
        c.label.toLowerCase().includes("cost/sam")
    ) &&
    currentColumns.some(
      (c) =>
        c.key.toLowerCase().includes("perpiece") ||
        c.key.toLowerCase().includes("perpc") ||
        c.label.toLowerCase().includes("per piece")
    );

  const samValidation = useMemo(() => {
    return validateSamRanges(currentRows, currentColumns, cards[0]);
  }, [currentRows, currentColumns, cards]);

  async function handleManualSave() {
    if (!samValidation.isValid) {
      toast.error(samValidation.errors[0] || "Overlapping or invalid SAM ranges detected. Please fix before saving.");
      return;
    }

    setIsSaving(true);
    try {
      const activeC = cards.find((c) => c.isActive) || cards[0];
      const templateC = cards[0];
      const firstKey = currentColumns[0]?.key;

      const sanitizedCards = cards.map((c) => ({
        ...c,
        rows: c.rows.map((r, idx) => ({
          ...r,
          values: {
            ...r.values,
            ...(firstKey && (!r.values[firstKey] || r.values[firstKey].trim() === "") && templateC?.rows[idx]?.values[firstKey]
              ? { [firstKey]: templateC.rows[idx].values[firstKey] }
              : {}),
          },
        })),
      }));

      const sanitizedActiveC = sanitizedCards.find((c) => c.id === activeC.id) || sanitizedCards[0];

      const payload: SimpleTableData = {
        ...data,
        columns: sanitizedActiveC.columns,
        rows: sanitizedActiveC.rows,
        cards: sanitizedCards,
        activeCardId: sanitizedActiveC.id,
      };
      await onSave(payload);
      setCards(sanitizedCards);
      setHasChanges(false);
      toast.success("Changes saved successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }

  // Set card as active (only one card remains active at a time)
  async function handleSetActive(cardId: string) {
    const nextCards = cards.map((c) => ({
      ...c,
      isActive: c.id === cardId,
    }));
    setCards(nextCards);
    const activeC = nextCards.find((c) => c.id === cardId) || nextCards[0];
    const payload: SimpleTableData = {
      ...data,
      columns: activeC.columns,
      rows: activeC.rows,
      cards: nextCards,
      activeCardId: activeC.id,
    };
    await onSave(payload);
    setHasChanges(false);
    toast.success(`"${activeC.name}" set as Active (Saved to DB)`);
  }

  // Create a new card
  async function handleCreateCard(cardName: string) {
    const nextSerial = Math.max(0, ...cards.map((c) => c.serialNo || 0)) + 1;
    const newId = `card-${Date.now()}`;
    const name = cardName.trim() || `Card ${nextSerial}`;

    const firstColKey = currentColumns[0]?.key;
    const templateCard = cards.find((c) => c.isActive) || cards[0] || currentCard;
    const templateRows = (templateCard.rows && templateCard.rows.length > 0) ? templateCard.rows : currentRows;

    // Fresh rows cloned from template / current with descriptor column preserved
    const newRows: SimpleRow[] = templateRows.map((r, idx) => {
      const emptyValues = { ...r.values };
      for (const key of Object.keys(emptyValues)) {
        if (
          key !== firstColKey &&
          !["styleName", "styleCategory", "description", "customer", "orderType", "useType", "use_type"].includes(key)
        ) {
          emptyValues[key] = "";
        }
      }
      return {
        id: `row-${Date.now()}-${idx}`,
        values: emptyValues,
      };
    });

    const newCard: SimpleTableCard = {
      id: newId,
      serialNo: nextSerial,
      name,
      isActive: false,
      columns: [...currentColumns],
      rows: newRows,
    };

    const nextCards = [...cards, newCard];
    setCards(nextCards);
    setSelectedCardId(newId);

    const activeC = nextCards.find((c) => c.isActive) || nextCards[0];
    const payload: SimpleTableData = {
      ...data,
      columns: activeC.columns,
      rows: activeC.rows,
      cards: nextCards,
      activeCardId: activeC.id,
    };

    await onSave(payload);
    setHasChanges(false);
    toast.success(`Created "${name}" (Saved to DB)`);
  }

  // Duplicate current card
  async function handleDuplicateCard(targetCard?: SimpleTableCard) {
    const cardToDuplicate = targetCard || currentCard;
    const nextSerial = Math.max(0, ...cards.map((c) => c.serialNo || 0)) + 1;
    const newId = `card-${Date.now()}`;
    const name = `${cardToDuplicate.name} (Copy)`;

    const newRows: SimpleRow[] = (cardToDuplicate.rows || []).map((r, idx) => ({
      id: `row-${Date.now()}-${idx}`,
      values: { ...r.values },
    }));

    const newCard: SimpleTableCard = {
      id: newId,
      serialNo: nextSerial,
      name,
      isActive: false,
      columns: [...(cardToDuplicate.columns || currentColumns)],
      rows: newRows,
    };

    const nextCards = [...cards, newCard];
    setCards(nextCards);
    setSelectedCardId(newId);

    const activeC = nextCards.find((c) => c.isActive) || nextCards[0];
    const payload: SimpleTableData = {
      ...data,
      columns: activeC.columns,
      rows: activeC.rows,
      cards: nextCards,
      activeCardId: activeC.id,
    };

    await onSave(payload);
    setHasChanges(false);
    toast.success(`Duplicated as "${name}" (Saved to DB)`);
  }

  // Rename card
  async function handleRenameCard(newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const nextCards = cards.map((c) =>
      c.id === currentCard.id ? { ...c, name: trimmed } : c
    );
    setCards(nextCards);

    const activeC = nextCards.find((c) => c.isActive) || nextCards[0];
    const payload: SimpleTableData = {
      ...data,
      columns: activeC.columns,
      rows: activeC.rows,
      cards: nextCards,
      activeCardId: activeC.id,
    };

    await onSave(payload);
    setHasChanges(false);
    toast.success("Card renamed (Saved to DB)");
  }

  // Delete card
  async function handleDeleteCard(cardId: string) {
    if (cards.length <= 1) {
      toast.error("Cannot delete the only card");
      return;
    }

    const deleting = cards.find((c) => c.id === cardId);
    const remaining = cards.filter((c) => c.id !== cardId);

    if (deleting?.isActive) {
      remaining[0].isActive = true;
    }

    setCards(remaining);
    setSelectedCardId(remaining[0].id);

    const activeC = remaining.find((c) => c.isActive) || remaining[0];
    const payload: SimpleTableData = {
      ...data,
      columns: activeC.columns,
      rows: activeC.rows,
      cards: remaining,
      activeCardId: activeC.id,
    };

    await onSave(payload);
    setHasChanges(false);
    toast.success("Card deleted from Database");
  }

  // Cell editing
  function updateCell(rowId: string, colKey: string, value: string) {
    const updatedRows = currentRows.map((r) => {
      if (r.id !== rowId) return r;
      return { ...r, values: { ...r.values, [colKey]: value } };
    });

    const nextCards = cards.map((c) =>
      c.id === currentCard.id ? { ...c, rows: updatedRows } : c
    );

    setCards(nextCards);
    setHasChanges(true);
  }

  // Radio button toggle for SAM vs PER PIECE
  function setRowUseType(rowId: string, useType: "sam" | "piece") {
    const updatedRows = currentRows.map((r) => {
      if (r.id !== rowId) return r;
      return { ...r, values: { ...r.values, useType } };
    });

    const nextCards = cards.map((c) =>
      c.id === currentCard.id ? { ...c, rows: updatedRows } : c
    );

    setCards(nextCards);
    setHasChanges(true);
  }

  return (
    <div className="space-y-6">
      {/* ── Visual Cards Deck Section ── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="size-5 text-primary" />
            <h2 className="text-base font-bold tracking-tight">Parameter Cards Deck</h2>
            <Badge variant="outline" className="text-xs font-normal">
              {cards.length} {cards.length === 1 ? "Card" : "Cards"} Total
            </Badge>
          </div>
          <Button
            size="sm"
            onClick={() => setNewCardOpen(true)}
            className="gap-1.5 shadow-sm font-medium"
          >
            <Plus className="size-4" />
            <span>New Card</span>
          </Button>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {cards.map((card) => {
            const isOpened = card.id === currentCard.id;
            const rowCount = card.rows?.length || 0;

            return (
              <div
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                className={`group relative flex flex-col justify-between rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer text-left bg-card ${
                  isOpened
                    ? "border-emerald-600 ring-4 ring-emerald-500/15 shadow-md bg-emerald-50/10 dark:bg-emerald-950/20"
                    : "border-border/80 hover:border-emerald-500/50 hover:shadow-sm"
                }`}
              >
                <div>
                  {/* Top Bar on Card: Title & Active Badge */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base font-bold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">
                        {card.name}
                      </span>
                    </div>

                    {card.isActive ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px] px-2 py-0.5 font-semibold gap-1 shrink-0">
                        <Check className="size-3" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground px-1.5 py-0.5 shrink-0">
                        Inactive
                      </Badge>
                    )}
                  </div>

                  {/* Card Description / Info */}
                  <div className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                    <FileSpreadsheet className="size-3.5 text-muted-foreground/70" />
                    <span>{rowCount} {rowCount === 1 ? "row" : "rows"} configured</span>
                  </div>
                </div>

                {/* Card Footer: Opened Status */}
                <div className="flex items-center justify-between pt-3 border-t border-border/60 text-xs">
                  {isOpened ? (
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                      <FolderOpen className="size-3.5 text-emerald-600 dark:text-emerald-400" /> Opened
                    </span>
                  ) : (
                    <span className="text-muted-foreground group-hover:text-foreground transition-colors">
                      Click to Open
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Opened Card Details & Table Editor ── */}
      <div className="rounded-xl border bg-card shadow-sm p-4 sm:p-5 space-y-4">
        {/* Heading displaying which card is opened & Active/Inactive Toggle Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b">
          {/* Card Title & Edit/Delete Actions */}
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">
              <FolderOpen className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Opened Card:
                </span>
                <h3 className="text-lg font-bold text-foreground leading-none">
                  {currentCard.name}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setRenameCardOpen(true)}
                  title="Rename card"
                >
                  <Edit2 className="size-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Viewing and editing parameters for {currentCard.name}. {hasChanges && <span className="text-amber-600 font-medium">You have unsaved changes.</span>}
              </p>
            </div>
          </div>

          {/* Active / Inactive Toggle Button & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Active / Inactive Toggle */}
            {currentCard.isActive ? (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-500 text-emerald-900 dark:text-emerald-200 px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-xs">
                <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>ACTIVE (Used in Cost Sheet)</span>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3.5 border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/40 gap-1.5 font-semibold text-xs shadow-xs"
                onClick={() => setActiveConfirmCardId(currentCard.id)}
              >
                <Power className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Set as Active (Make Active in Cost Sheet)</span>
              </Button>
            )}

            {/* Duplicate Card */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs gap-1.5"
              onClick={() => handleDuplicateCard(currentCard)}
              title="Duplicate this card"
            >
              <Copy className="size-3.5" />
              <span>Duplicate</span>
            </Button>

            {/* Delete Card */}
            {cards.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5"
                onClick={() => setDeleteCardId(currentCard.id)}
                title="Delete this card"
              >
                <Trash2 className="size-3.5" />
                <span>Delete</span>
              </Button>
            )}
          </div>
        </div>

        {/* Validation Warning Alert */}
        {!samValidation.isValid && (
          <div className="rounded-lg border border-rose-300 dark:border-rose-900 bg-rose-50/95 dark:bg-rose-950/40 p-3 text-xs text-rose-900 dark:text-rose-200 space-y-1.5 shadow-2xs">
            <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-400">
              <AlertTriangle className="size-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>Invalid Range Configuration: Overlapping Boundaries Detected</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-800 dark:text-rose-300 pl-1">
              {samValidation.errors.map((err, idx) => (
                <li key={idx}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Table Editor */}
        <div className="rounded-lg border shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {currentColumns.map((col) => (
                  <TableHead key={col.key}>
                    <div className="flex items-center gap-1">
                      <span className="font-semibold text-foreground text-xs">
                        {col.label}
                      </span>
                    </div>
                  </TableHead>
                ))}

                {/* Calculation Basis Selector Header */}
                {hasSamAndPiece && (
                  <TableHead className="w-48 text-center">
                    <span className="font-semibold text-foreground text-xs">
                      Calculation Basis
                    </span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentRows.map((row, rowIdx) => {
                const currentUseType = (row.values.useType || row.values.use_type || "sam").toLowerCase();
                const isPiece = currentUseType === "piece" || currentUseType === "perpiece";
                const isSam = !isPiece;
                const templateCard = cards[0];
                const isConflicting = samValidation.conflictingRowIds.has(row.id);

                return (
                  <TableRow key={row.id}>
                    {currentColumns.map((col, colIndex) => {
                      const isDescription = colIndex === 0;
                      const cellValue =
                        isDescription && (!row.values[col.key] || row.values[col.key].trim() === "")
                          ? templateCard?.rows[rowIdx]?.values[col.key] || row.values[col.key] || ""
                          : row.values[col.key] ?? "";

                      return (
                        <TableCell key={col.key}>
                          <Input
                            className={`h-8 text-sm ${
                              isDescription
                                ? isConflicting
                                  ? "bg-rose-50/60 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200 font-semibold cursor-not-allowed opacity-95 select-none"
                                  : "bg-muted/50 text-foreground font-semibold cursor-not-allowed opacity-90 select-none"
                                : isConflicting
                                ? "border-rose-400 dark:border-rose-700 bg-rose-50/30 dark:bg-rose-950/20 text-rose-950 dark:text-rose-100 font-medium focus-visible:ring-rose-400"
                                : ""
                            }`}
                            value={cellValue}
                            placeholder="-"
                            disabled={isDescription}
                            onChange={(e) => updateCell(row.id, col.key, e.target.value)}
                          />
                        </TableCell>
                      );
                    })}

                    {/* Segmented Toggle Pill */}
                    {hasSamAndPiece && (
                      <TableCell className="text-center align-middle">
                        <div className="inline-flex items-center p-0.5 rounded-lg bg-muted/80 border border-border/60 text-xs shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setRowUseType(row.id, "sam")}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-all font-medium cursor-pointer ${
                              isSam
                                ? "bg-background text-foreground shadow-xs font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full transition-all ${
                                isSam ? "bg-sky-500" : "bg-transparent"
                              }`}
                            />
                            <span>SAM</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRowUseType(row.id, "piece")}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs transition-all font-medium cursor-pointer ${
                              isPiece
                                ? "bg-background text-foreground shadow-xs font-semibold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full transition-all ${
                                isPiece ? "bg-sky-500" : "bg-transparent"
                              }`}
                            />
                            <span>PER PIECE</span>
                          </button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Table Action Buttons */}
        <div className="flex flex-wrap gap-2 items-center justify-end">
          {hasChanges && (
            <Button 
              size="sm" 
              disabled={!samValidation.isValid || isSaving}
              className={
                samValidation.isValid
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
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

      {/* Modals */}
      <PromptDialog
        open={newCardOpen}
        onOpenChange={setNewCardOpen}
        title="Create New Card"
        description="Create a new parameter card to save your data history or test new rates."
        label={`Card ${Math.max(0, ...cards.map((c) => c.serialNo || 0)) + 1}`}
        defaultValue={`Card ${Math.max(0, ...cards.map((c) => c.serialNo || 0)) + 1}`}
        confirmLabel="Create Card"
        onSubmit={handleCreateCard}
      />

      <PromptDialog
        open={renameCardOpen}
        onOpenChange={setRenameCardOpen}
        title="Rename Card"
        label="Card Name"
        defaultValue={currentCard.name}
        confirmLabel="Save"
        onSubmit={handleRenameCard}
      />

      <ConfirmDeleteDialog
        open={deleteCardId !== null}
        onOpenChange={(open) => !open && setDeleteCardId(null)}
        title={`Delete Card "${cards.find((c) => c.id === deleteCardId)?.name}"?`}
        description="This will permanently delete this card and its history. This cannot be undone."
        onConfirm={() => deleteCardId && handleDeleteCard(deleteCardId)}
      />

      <AlertDialog open={activeConfirmCardId !== null} onOpenChange={(open) => !open && setActiveConfirmCardId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Make this card active?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to set "{cards.find((c) => c.id === activeConfirmCardId)?.name}" as the active card? This card will be used in the Cost Sheet calculations.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (activeConfirmCardId) {
                  handleSetActive(activeConfirmCardId);
                  setActiveConfirmCardId(null);
                }
              }}
            >
              Set as Active
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
