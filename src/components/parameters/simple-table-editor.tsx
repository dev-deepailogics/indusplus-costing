"use client";

import { useRef, useState, useEffect } from "react";
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
  // Normalize cards
  const cards: SimpleTableCard[] = (data.cards && data.cards.length > 0)
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
      ];

  const initialSelectedId =
    data.activeCardId ||
    cards.find((c) => c.isActive)?.id ||
    cards[0]?.id ||
    "card-1";

  const [selectedCardId, setSelectedCardId] = useState<string>(initialSelectedId);
  const [addColOpen, setAddColOpen] = useState(false);
  const [newCardOpen, setNewCardOpen] = useState(false);
  const [renameCardOpen, setRenameCardOpen] = useState(false);
  const [deleteRowId, setDeleteRowId] = useState<string | null>(null);
  const [deleteColKey, setDeleteColKey] = useState<string | null>(null);
  const [deleteCardId, setDeleteCardId] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep selected card in sync if list changes
  useEffect(() => {
    if (!cards.some((c) => c.id === selectedCardId)) {
      const fallback = cards.find((c) => c.isActive)?.id || cards[0]?.id || "card-1";
      setSelectedCardId(fallback);
    }
  }, [cards, selectedCardId]);

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

  function scheduleSave(nextCards: SimpleTableCard[], newActiveId?: string) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const targetActiveId =
        newActiveId ||
        nextCards.find((c) => c.isActive)?.id ||
        nextCards[0]?.id ||
        "card-1";
      const activeCard =
        nextCards.find((c) => c.id === targetActiveId) || nextCards[0];

      const payload: SimpleTableData = {
        ...data,
        columns: activeCard.columns,
        rows: activeCard.rows,
        cards: nextCards,
        activeCardId: activeCard.id,
      };

      await onSave(payload);
      toast.success("Saved");
    }, 500);
  }

  // Set card as active (only one card remains active at a time)
  async function handleSetActive(cardId: string) {
    const nextCards = cards.map((c) => ({
      ...c,
      isActive: c.id === cardId,
    }));
    const activeC = nextCards.find((c) => c.id === cardId) || nextCards[0];

    const payload: SimpleTableData = {
      ...data,
      columns: activeC.columns,
      rows: activeC.rows,
      cards: nextCards,
      activeCardId: activeC.id,
    };

    await onSave(payload);
    toast.success(`"${activeC.name}" is now Active and used in Cost Sheet`);
  }

  // Create a new card
  async function handleCreateCard(cardName: string) {
    const nextSerial = Math.max(0, ...cards.map((c) => c.serialNo || 0)) + 1;
    const newId = `card-${Date.now()}`;
    const name = cardName.trim() || `Card ${nextSerial}`;

    // Fresh rows cloned from template / current
    const newRows: SimpleRow[] = currentRows.map((r, idx) => ({
      id: `row-${Date.now()}-${idx}`,
      values: { ...r.values },
    }));

    const newCard: SimpleTableCard = {
      id: newId,
      serialNo: nextSerial,
      name,
      isActive: false,
      columns: [...currentColumns],
      rows: newRows,
    };

    const nextCards = [...cards, newCard];
    const payload: SimpleTableData = {
      ...data,
      cards: nextCards,
    };

    setSelectedCardId(newId);
    await onSave(payload);
    toast.success(`Created "${name}"`);
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
    const payload: SimpleTableData = {
      ...data,
      cards: nextCards,
    };

    setSelectedCardId(newId);
    await onSave(payload);
    toast.success(`Duplicated as "${name}"`);
  }

  // Rename card
  async function handleRenameCard(newName: string) {
    const trimmed = newName.trim();
    if (!trimmed) return;

    const nextCards = cards.map((c) =>
      c.id === currentCard.id ? { ...c, name: trimmed } : c
    );
    const payload: SimpleTableData = {
      ...data,
      cards: nextCards,
    };

    await onSave(payload);
    toast.success("Card renamed");
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

    const activeC = remaining.find((c) => c.isActive) || remaining[0];
    const payload: SimpleTableData = {
      ...data,
      columns: activeC.columns,
      rows: activeC.rows,
      cards: remaining,
      activeCardId: activeC.id,
    };

    setSelectedCardId(remaining[0].id);
    await onSave(payload);
    toast.success("Card deleted");
  }

  // Cell editing - ALLOWS BOTH VALUES AT THE SAME TIME
  function updateCell(rowId: string, colKey: string, value: string) {
    const updatedRows = currentRows.map((r) => {
      if (r.id !== rowId) return r;
      return { ...r, values: { ...r.values, [colKey]: value } };
    });

    const nextCards = cards.map((c) =>
      c.id === currentCard.id ? { ...c, rows: updatedRows } : c
    );

    scheduleSave(nextCards);
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

    const activeC = nextCards.find((c) => c.isActive) || nextCards[0];
    const payload: SimpleTableData = {
      ...data,
      columns: activeC.columns,
      rows: activeC.rows,
      cards: nextCards,
      activeCardId: activeC.id,
    };

    onSave(payload).then(() => {
      toast.success(`Set to use ${useType === "sam" ? "Cost/SAM" : "PER PIECE"}`);
    });
  }

  function addRow() {
    const newRow: SimpleRow = {
      id: `row-${Date.now()}`,
      values: {
        ...Object.fromEntries(currentColumns.map((c) => [c.key, ""])),
        useType: "sam",
      },
    };
    const nextCards = cards.map((c) =>
      c.id === currentCard.id ? { ...c, rows: [...c.rows, newRow] } : c
    );

    const activeC = nextCards.find((c) => c.isActive) || nextCards[0];
    const payload: SimpleTableData = {
      ...data,
      columns: activeC.columns,
      rows: activeC.rows,
      cards: nextCards,
      activeCardId: activeC.id,
    };
    onSave(payload).then(() => toast.success("Row added"));
  }

  function addColumn(label: string) {
    const key = slugifyKey(label) || `field${currentColumns.length}`;
    if (currentColumns.some((c) => c.key === key)) {
      toast.error("A column with that name already exists");
      return;
    }

    const nextCards = cards.map((c) => ({
      ...c,
      columns: [...c.columns, { key, label }],
      rows: c.rows.map((r) => ({ ...r, values: { ...r.values, [key]: "" } })),
    }));

    const activeC = nextCards.find((c) => c.isActive) || nextCards[0];
    const payload: SimpleTableData = {
      ...data,
      columns: activeC.columns,
      rows: activeC.rows,
      cards: nextCards,
      activeCardId: activeC.id,
    };
    onSave(payload).then(() => toast.success("Column added"));
  }

  function removeRow(rowId: string) {
    const nextCards = cards.map((c) =>
      c.id === currentCard.id
        ? { ...c, rows: c.rows.filter((r) => r.id !== rowId) }
        : c
    );

    const activeC = nextCards.find((c) => c.isActive) || nextCards[0];
    const payload: SimpleTableData = {
      ...data,
      columns: activeC.columns,
      rows: activeC.rows,
      cards: nextCards,
      activeCardId: activeC.id,
    };
    onSave(payload).then(() => toast.success("Row deleted"));
  }

  function removeColumn(colKey: string) {
    const nextCards = cards.map((c) => ({
      ...c,
      columns: c.columns.filter((col) => col.key !== colKey),
      rows: c.rows.map((r) => {
        const rest = { ...r.values };
        delete rest[colKey];
        return { ...r, values: rest };
      }),
    }));

    const activeC = nextCards.find((c) => c.isActive) || nextCards[0];
    const payload: SimpleTableData = {
      ...data,
      columns: activeC.columns,
      rows: activeC.rows,
      cards: nextCards,
      activeCardId: activeC.id,
    };
    onSave(payload).then(() => toast.success("Column deleted"));
  }

  const deleteColLabel = currentColumns.find((c) => c.key === deleteColKey)?.label;

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
            <span>+ New Card</span>
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

                {/* Card Footer: Opened Status & Quick Actions */}
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

                  {!card.isActive ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetActive(card.id);
                      }}
                      className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                      title="Make this card active in cost sheet"
                    >
                      <Power className="size-3" /> Set Active
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      In Cost Sheet
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {/* "+ Add New Card" Placeholder Box */}
          <button
            type="button"
            onClick={() => setNewCardOpen(true)}
            className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 hover:border-emerald-600/60 hover:bg-emerald-50/10 p-5 text-center transition-all cursor-pointer min-h-[120px] text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-400"
          >
            <div className="size-9 rounded-full bg-muted flex items-center justify-center mb-2 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950/50">
              <Plus className="size-5" />
            </div>
            <span className="text-xs font-semibold">+ Add New Card</span>
          </button>
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
                Viewing and editing parameters for {currentCard.name}. Changes are automatically saved to this card.
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
                onClick={() => handleSetActive(currentCard.id)}
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
                      {currentColumns.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleteColKey(col.key)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
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

                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentRows.map((row) => {
                const currentUseType = (row.values.useType || row.values.use_type || "sam").toLowerCase();
                const isPiece = currentUseType === "piece" || currentUseType === "perpiece";
                const isSam = !isPiece;

                return (
                  <TableRow key={row.id}>
                    {currentColumns.map((col) => {
                      return (
                        <TableCell key={col.key}>
                          <Input
                            className="h-8 text-sm"
                            value={row.values[col.key] ?? ""}
                            placeholder="-"
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

                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteRowId(row.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Table Action Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addRow}>
            <Plus className="mr-1.5 size-4" /> Add row
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAddColOpen(true)}>
            <Plus className="mr-1.5 size-4" /> Add field
          </Button>
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

      <PromptDialog
        open={addColOpen}
        onOpenChange={setAddColOpen}
        title="Add field"
        label="Field name"
        onSubmit={addColumn}
      />

      <ConfirmDeleteDialog
        open={deleteRowId !== null}
        onOpenChange={(open) => !open && setDeleteRowId(null)}
        title="Delete row?"
        description="This removes the row and its values. This cannot be undone."
        onConfirm={() => deleteRowId && removeRow(deleteRowId)}
      />

      <ConfirmDeleteDialog
        open={deleteColKey !== null}
        onOpenChange={(open) => !open && setDeleteColKey(null)}
        title={`Delete field "${deleteColLabel}"?`}
        description="This removes the field and its values from every row. This cannot be undone."
        onConfirm={() => deleteColKey && removeColumn(deleteColKey)}
      />

      <ConfirmDeleteDialog
        open={deleteCardId !== null}
        onOpenChange={(open) => !open && setDeleteCardId(null)}
        title={`Delete Card "${cards.find((c) => c.id === deleteCardId)?.name}"?`}
        description="This will permanently delete this card and its history. This cannot be undone."
        onConfirm={() => deleteCardId && handleDeleteCard(deleteCardId)}
      />
    </div>
  );
}
