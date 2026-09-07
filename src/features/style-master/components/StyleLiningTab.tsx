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
import type { BOMLiningItem } from "../types";

interface StyleLiningTabProps {
  formLining: BOMLiningItem[];
  onFormLiningChange: (lining: BOMLiningItem[]) => void;
  exchangeRate: number;
}

export function StyleLiningTab({
  formLining,
  onFormLiningChange,
  exchangeRate,
}: StyleLiningTabProps) {
  function updateItem(idx: number, patch: Partial<BOMLiningItem>) {
    const next = [...formLining];
    next[idx] = { ...next[idx], ...patch };
    onFormLiningChange(next);
  }

  function addRow() {
    onFormLiningChange([
      ...formLining,
      {
        itemName: `Lining ${formLining.length + 1}`,
        consumptionPerPc: 0,
        rateUSD: 0,
        ratePKR: 0,
        liningCostPKR: 0,
      },
    ]);
  }

  function removeRow(idx: number) {
    onFormLiningChange(formLining.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground mb-2">
        Configure Pocket Lining requirements (rates in USD. Conversion rate is {exchangeRate} PKR/$).
      </p>
      <div className="rounded-lg border">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow>
              <TableHead>Lining Item Name</TableHead>
              <TableHead className="w-24">Consumption (Mtr)</TableHead>
              <TableHead className="w-28">Rate (USD)</TableHead>
              <TableHead className="w-32">Rate (PKR)</TableHead>
              <TableHead className="w-32">Cost (PKR)</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {formLining.map((item, idx) => (
              <TableRow key={idx}>
                <TableCell className="p-2">
                  <Input
                    value={item.itemName}
                    onChange={(e) => updateItem(idx, { itemName: e.target.value })}
                  />
                </TableCell>
                <TableCell className="p-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={item.consumptionPerPc || ""}
                    onChange={(e) => {
                      const cons = Number(e.target.value);
                      updateItem(idx, {
                        consumptionPerPc: cons,
                        liningCostPKR: cons * item.ratePKR,
                      });
                    }}
                  />
                </TableCell>
                <TableCell className="p-2">
                  <Input
                    type="number"
                    step="0.01"
                    value={item.rateUSD || ""}
                    onChange={(e) => {
                      const rateUSD = Number(e.target.value);
                      const ratePKR = rateUSD * (exchangeRate || 0);
                      updateItem(idx, {
                        rateUSD,
                        ratePKR,
                        liningCostPKR: item.consumptionPerPc * ratePKR,
                      });
                    }}
                  />
                </TableCell>
                <TableCell className="p-2">
                  <Input
                    type="number"
                    value={item.ratePKR || ""}
                    onChange={(e) => {
                      const ratePKR = Number(e.target.value);
                      const rateUSD = exchangeRate > 0 ? ratePKR / exchangeRate : 0;
                      updateItem(idx, {
                        ratePKR,
                        rateUSD,
                        liningCostPKR: item.consumptionPerPc * ratePKR,
                      });
                    }}
                  />
                </TableCell>
                <TableCell className="p-2 align-middle font-medium text-right pr-4">
                  Rs. {item.liningCostPKR.toFixed(1)}
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
        <Plus className="mr-1.5 size-3.5" /> Add Lining Row
      </Button>
    </div>
  );
}
