"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BOMAccessoriesItem } from "../types";

interface StyleAccessoriesTabProps {
  formAccessories: BOMAccessoriesItem[];
  onFormAccessoriesChange: (accessories: BOMAccessoriesItem[]) => void;
}

export function StyleAccessoriesTab({
  formAccessories,
  onFormAccessoriesChange,
}: StyleAccessoriesTabProps) {
  function updateItem(idx: number, patch: Partial<BOMAccessoriesItem>) {
    const next = [...formAccessories];
    next[idx] = { ...next[idx], ...patch };
    onFormAccessoriesChange(next);
  }

  function addRow() {
    onFormAccessoriesChange([
      ...formAccessories,
      {
        category: "Trims",
        itemName: "New Trim",
        consPerPc: 1,
        ratePKR: 0,
        totalCostPKR: 0,
      },
    ]);
  }

  function removeRow(idx: number) {
    onFormAccessoriesChange(formAccessories.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground mb-2">
        Configure Accessories (rates in PKR directly).
      </p>
      <div className="rounded-lg border max-h-[300px] overflow-auto">
        <Table>
          <TableHeader className="bg-muted/40 sticky top-0 z-10">
            <TableRow>
              <TableHead className="w-40">Category</TableHead>
              <TableHead>Item Details</TableHead>
              <TableHead className="w-24">Cons. / Pc</TableHead>
              <TableHead className="w-28">Rate (PKR)</TableHead>
              <TableHead className="w-32">Total Cost (PKR)</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formAccessories.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell className="p-2">
                  <select
                    className="w-full h-8 rounded-md border border-input bg-transparent px-2 py-0.5 text-xs focus-visible:outline-none"
                    value={item.category}
                    onChange={(e) => updateItem(idx, { category: e.target.value })}
                  >
                    <option value="Zipper">Zipper</option>
                    <option value="Thread">Thread</option>
                    <option value="Label">Label</option>
                    <option value="Trims">Trims</option>
                    <option value="Poly Bag">Poly Bag</option>
                    <option value="Carton">Carton</option>
                    <option value="Button">Button</option>
                    <option value="Packing Mix">Packing Mix</option>
                    <option value="Sticker">Sticker</option>
                  </select>
                </TableCell>
                <TableCell className="p-2">
                  <Input
                    className="h-8 text-xs"
                    value={item.itemName}
                    onChange={(e) => updateItem(idx, { itemName: e.target.value })}
                  />
                </TableCell>
                <TableCell className="p-2">
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-xs"
                    value={item.consPerPc || ""}
                    onChange={(e) => {
                      const cons = Number(e.target.value);
                      updateItem(idx, {
                        consPerPc: cons,
                        totalCostPKR: cons * item.ratePKR,
                      });
                    }}
                  />
                </TableCell>
                <TableCell className="p-2">
                  <Input
                    type="number"
                    className="h-8 text-xs"
                    value={item.ratePKR || ""}
                    onChange={(e) => {
                      const rate = Number(e.target.value);
                      updateItem(idx, {
                        ratePKR: rate,
                        totalCostPKR: item.consPerPc * rate,
                      });
                    }}
                  />
                </TableCell>
                <TableCell className="p-2 align-middle font-medium text-right pr-4 text-xs">
                  Rs. {item.totalCostPKR.toFixed(1)}
                </TableCell>
                <TableCell className="p-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-6 text-destructive"
                    onClick={() => removeRow(idx)}
                  >
                    <X className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Button variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-1.5 size-3.5" /> Add Accessory Row
      </Button>
    </div>
  );
}
