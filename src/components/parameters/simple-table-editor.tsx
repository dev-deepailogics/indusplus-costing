"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import type { SimpleTableData } from "@/lib/parameters/types";
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
  const [addColOpen, setAddColOpen] = useState(false);
  const [deleteRowId, setDeleteRowId] = useState<string | null>(null);
  const [deleteColKey, setDeleteColKey] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function scheduleSave(next: SimpleTableData) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await onSave(next);
      toast.success("Saved");
    }, 600);
  }

  function updateCell(rowId: string, colKey: string, value: string) {
    const next: SimpleTableData = {
      ...data,
      rows: data.rows.map((r) =>
        r.id === rowId ? { ...r, values: { ...r.values, [colKey]: value } } : r
      ),
    };
    scheduleSave(next);
  }

  function addRow() {
    const next: SimpleTableData = {
      ...data,
      rows: [
        ...data.rows,
        {
          id: `row-${Date.now()}`,
          values: Object.fromEntries(data.columns.map((c) => [c.key, ""])),
        },
      ],
    };
    onSave(next).then(() => toast.success("Row added"));
  }

  function addColumn(label: string) {
    const key = slugifyKey(label) || `field${data.columns.length}`;
    if (data.columns.some((c) => c.key === key)) {
      toast.error("A column with that name already exists");
      return;
    }
    const next: SimpleTableData = {
      columns: [...data.columns, { key, label }],
      rows: data.rows.map((r) => ({ ...r, values: { ...r.values, [key]: "" } })),
    };
    onSave(next).then(() => toast.success("Column added"));
  }

  function removeRow(rowId: string) {
    const next: SimpleTableData = {
      ...data,
      rows: data.rows.filter((r) => r.id !== rowId),
    };
    onSave(next).then(() => toast.success("Row deleted"));
  }

  function removeColumn(colKey: string) {
    const next: SimpleTableData = {
      columns: data.columns.filter((c) => c.key !== colKey),
      rows: data.rows.map((r) => {
        const rest = { ...r.values };
        delete rest[colKey];
        return { ...r, values: rest };
      }),
    };
    onSave(next).then(() => toast.success("Column deleted"));
  }

  const deleteColLabel = data.columns.find((c) => c.key === deleteColKey)?.label;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {data.columns.map((col) => (
                <TableHead key={col.key}>
                  <div className="flex items-center gap-1">
                    <span>{col.label}</span>
                    {data.columns.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6"
                        onClick={() => setDeleteColKey(col.key)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row) => (
              <TableRow key={row.id}>
                {data.columns.map((col) => (
                  <TableCell key={col.key}>
                    <Input
                      className="h-8"
                      defaultValue={row.values[col.key] ?? ""}
                      onChange={(e) => updateCell(row.id, col.key, e.target.value)}
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setDeleteRowId(row.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus /> Add row
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAddColOpen(true)}>
          <Plus /> Add field
        </Button>
      </div>

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
    </div>
  );
}
