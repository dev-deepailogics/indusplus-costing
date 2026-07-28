"use client";

import { useEffect, useRef, useState } from "react";
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
import type { MatrixTableData } from "@/lib/parameters/types";
import { PromptDialog } from "./prompt-dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

export function MatrixTableEditor({
  data,
  onSave,
  rowLabelHeader = "Qty.",
}: {
  data: MatrixTableData;
  onSave: (data: MatrixTableData) => Promise<void>;
  rowLabelHeader?: string;
}) {
  const [addRowOpen, setAddRowOpen] = useState(false);
  const [addColOpen, setAddColOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<string | null>(null);
  const [deleteCol, setDeleteCol] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  if (!data || !data.columnLabels || !data.rowLabels || !data.cells) {
    return (
      <div className="p-4 text-sm text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
        Table data is empty or loading...
      </div>
    );
  }

  function scheduleSave(next: MatrixTableData) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await onSave(next);
      toast.success("Saved");
    }, 600);
  }

  function updateCell(rowLabel: string, colLabel: string, value: string) {
    const next: MatrixTableData = {
      ...data,
      cells: {
        ...data.cells,
        [rowLabel]: { ...data.cells[rowLabel], [colLabel]: value },
      },
    };
    scheduleSave(next);
  }

  function addRow(label: string) {
    if (data.rowLabels.includes(label)) {
      toast.error("Row already exists");
      return;
    }
    const next: MatrixTableData = {
      ...data,
      rowLabels: [...data.rowLabels, label],
      cells: {
        ...data.cells,
        [label]: Object.fromEntries(data.columnLabels.map((c) => [c, ""])),
      },
    };
    onSave(next).then(() => toast.success("Row added"));
  }

  function addColumn(label: string) {
    if (data.columnLabels.includes(label)) {
      toast.error("Column already exists");
      return;
    }
    const cells: MatrixTableData["cells"] = {};
    for (const row of data.rowLabels) {
      cells[row] = { ...data.cells[row], [label]: "" };
    }
    const next: MatrixTableData = {
      ...data,
      columnLabels: [...data.columnLabels, label],
      cells,
    };
    onSave(next).then(() => toast.success("Column added"));
  }

  function removeRow(label: string) {
    const rest = { ...data.cells };
    delete rest[label];
    const next: MatrixTableData = {
      ...data,
      rowLabels: data.rowLabels.filter((r) => r !== label),
      cells: rest,
    };
    onSave(next).then(() => toast.success("Row deleted"));
  }

  function removeColumn(label: string) {
    const cells: MatrixTableData["cells"] = {};
    for (const row of data.rowLabels) {
      const rest = { ...data.cells[row] };
      delete rest[label];
      cells[row] = rest;
    }
    const next: MatrixTableData = {
      ...data,
      columnLabels: data.columnLabels.filter((c) => c !== label),
      cells,
    };
    onSave(next).then(() => toast.success("Column deleted"));
  }


  return (
    <div className="space-y-3">
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{rowLabelHeader}</TableHead>
              {data.columnLabels.map((col) => (
                <TableHead key={col}>
                  <div className="flex items-center gap-1">
                    <span>{col}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-6"
                      onClick={() => setDeleteCol(col)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableHead>
              ))}
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rowLabels.map((row) => (
              <TableRow key={row}>
                <TableCell className="font-medium">{row}</TableCell>
                {data.columnLabels.map((col) => (
                  <TableCell key={col}>
                    <Input
                      className="h-8 w-28"
                      defaultValue={data.cells[row]?.[col] ?? ""}
                      onChange={(e) => updateCell(row, col, e.target.value)}
                    />
                  </TableCell>
                ))}
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setDeleteRow(row)}
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
        <Button variant="outline" size="sm" onClick={() => setAddRowOpen(true)}>
          <Plus /> Add row
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAddColOpen(true)}>
          <Plus /> Add column
        </Button>
      </div>

      <PromptDialog
        open={addRowOpen}
        onOpenChange={setAddRowOpen}
        title="Add quantity band"
        label="e.g. 25001-50000"
        onSubmit={addRow}
      />
      <PromptDialog
        open={addColOpen}
        onOpenChange={setAddColOpen}
        title="Add style category"
        label="e.g. Premium Fashion"
        onSubmit={addColumn}
      />
      <ConfirmDeleteDialog
        open={deleteRow !== null}
        onOpenChange={(open) => !open && setDeleteRow(null)}
        title={`Delete row "${deleteRow}"?`}
        description="This removes the row and all its values. This cannot be undone."
        onConfirm={() => deleteRow && removeRow(deleteRow)}
      />
      <ConfirmDeleteDialog
        open={deleteCol !== null}
        onOpenChange={(open) => !open && setDeleteCol(null)}
        title={`Delete column "${deleteCol}"?`}
        description="This removes the column and its values from every row. This cannot be undone."
        onConfirm={() => deleteCol && removeColumn(deleteCol)}
      />
    </div>
  );
}
