"use client";

import { Input } from "@/components/ui/input";
import type { StyleFormMeta } from "../types";

interface StyleMetaTabProps {
  formMeta: StyleFormMeta;
  onFormMetaChange: (meta: StyleFormMeta) => void;
  isEditing: boolean;
}

export function StyleMetaTab({
  formMeta,
  onFormMetaChange,
  isEditing,
}: StyleMetaTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Style ID *</label>
          <Input
            disabled={isEditing}
            value={formMeta.id}
            onChange={(e) => onFormMetaChange({ ...formMeta, id: e.target.value })}
            placeholder="e.g. STY-001"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Style Name *</label>
          <Input
            value={formMeta.styleName}
            onChange={(e) => onFormMetaChange({ ...formMeta, styleName: e.target.value })}
            placeholder="e.g. TR 298 VITA"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">SMV Sewing (SAM)</label>
          <Input
            type="number"
            step="0.01"
            value={formMeta.smvSewing || ""}
            onChange={(e) => onFormMetaChange({ ...formMeta, smvSewing: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Order FOB ($)</label>
          <Input
            type="number"
            step="0.01"
            value={formMeta.baseSellingPrice || ""}
            onChange={(e) =>
              onFormMetaChange({ ...formMeta, baseSellingPrice: Number(e.target.value) })
            }
          />
        </div>
      </div>
    </div>
  );
}
