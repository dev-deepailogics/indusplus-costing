"use client";

import { useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PaymentTermsData, PaymentTermEntry } from "@/lib/parameters/types";

function makeId() {
  return `term-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

interface Props {
  data: PaymentTermsData;
  onSave: (data: PaymentTermsData) => Promise<void>;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function PaymentTermsEditor({ data, onSave, canCreate, canEdit, canDelete }: Props) {
  const [rows, setRows] = useState<PaymentTermEntry[]>(data?.terms ?? []);
  const [isSaving, setIsSaving] = useState(false);

  const handleLabelChange = (id: string, value: string) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, label: value } : r)));
  };

  const handleDaysChange = (id: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, days: parseFloat(value) || 0 } : r))
    );
  };

  const handleAdd = () => {
    setRows((prev) => [...prev, { id: makeId(), label: "", days: 0 }]);
  };

  const handleDelete = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ terms: rows });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define payment terms and their corresponding day values. Negative days indicate advance payment.
        </p>
        <div className="flex gap-2">
          {canCreate && (
            <Button size="sm" variant="outline" onClick={handleAdd}>
              <Plus className="size-3.5 mr-1.5" />
              Add Term
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="size-3.5 mr-1.5" />
              {isSaving ? "Saving…" : "Save"}
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-[60%]">
                Payment Term Label
              </th>
              <th className="text-center px-3 py-2 font-medium text-muted-foreground w-[25%]">
                Days
              </th>
              {canDelete && (
                <th className="px-3 py-2 w-[15%]" />
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={canDelete ? 3 : 2}
                  className="text-center text-muted-foreground text-xs py-6"
                >
                  No terms defined. Click &quot;Add Term&quot; to get started.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className={
                    idx % 2 === 0
                      ? "bg-background"
                      : "bg-muted/20"
                  }
                >
                  <td className="px-3 py-1.5">
                    {canEdit ? (
                      <Input
                        className="h-7 text-sm"
                        value={row.label}
                        placeholder="e.g. LC-60 days (110)"
                        onChange={(e) => handleLabelChange(row.id, e.target.value)}
                      />
                    ) : (
                      <span>{row.label}</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-center">
                    {canEdit ? (
                      <Input
                        type="number"
                        className="h-7 text-sm text-center w-24 mx-auto"
                        value={row.days}
                        onChange={(e) => handleDaysChange(row.id, e.target.value)}
                      />
                    ) : (
                      <span className="font-mono">{row.days}</span>
                    )}
                  </td>
                  {canDelete && (
                    <td className="px-3 py-1.5 text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7 text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(row.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Tip:</strong> AP (Fabric) terms use negative days (e.g. <code>-15</code>) since payment is made <em>before</em> delivery.
        The markup formula uses: <strong>AR Days − AP Days</strong>.
      </p>
    </div>
  );
}
