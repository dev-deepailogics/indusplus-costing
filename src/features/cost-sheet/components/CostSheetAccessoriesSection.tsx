"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BOMAccessoriesItem } from "@/features/style-master";

interface CostSheetAccessoriesSectionProps {
  bomAccessories: BOMAccessoriesItem[];
  onUpdateAccessories: (idx: number, patch: Partial<BOMAccessoriesItem>) => void;
  onAddAccessoryRow: () => void;
  onRemoveAccessoryRow: (idx: number) => void;
  parityProcurement: number;
  paritySale: number;
  netPriceUSD: number;
}

export function CostSheetAccessoriesSection({
  bomAccessories,
  onUpdateAccessories,
  onAddAccessoryRow,
  onRemoveAccessoryRow,
  parityProcurement,
  paritySale,
  netPriceUSD,
}: CostSheetAccessoriesSectionProps) {
  const totalAccPKR = bomAccessories.reduce(
    (acc, a) => acc + (a.consPerPc || 0) * (a.ratePKR || 0),
    0
  );
  const totalAccUSD = paritySale > 0 ? totalAccPKR / paritySale : 0;
  const totalAccPct = netPriceUSD > 0 ? (totalAccUSD / netPriceUSD) * 100 : 0;

  return (
    <Card className="shadow-xs border-muted/70">
      <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold">3. Accessories (Trims / Packaging)</CardTitle>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span>
            Total: <strong>Rs. {totalAccPKR.toFixed(1)}</strong> (${totalAccUSD.toFixed(2)})
          </span>
          <span className="text-muted-foreground font-mono">({totalAccPct.toFixed(1)}%)</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[350px] overflow-auto">
          <Table>
            <TableHeader className="bg-muted/10 sticky top-0 z-10">
              <TableRow>
                <TableHead className="w-36 text-xs font-semibold">Category</TableHead>
                <TableHead className="text-xs font-semibold">Item Details</TableHead>
                <TableHead className="w-24 text-xs font-semibold">Cons. / Pc</TableHead>
                <TableHead className="w-28 text-xs font-semibold">Rate (PKR)</TableHead>
                <TableHead className="w-28 text-xs font-semibold">Rate (USD)</TableHead>
                <TableHead className="w-32 text-xs font-semibold text-right">Cost (PKR)</TableHead>
                <TableHead className="w-24 text-xs font-semibold text-right">Cost ($)</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {bomAccessories.map((item, idx) => {
                const costPKR = (item.consPerPc || 0) * (item.ratePKR || 0);
                const costUSD = paritySale > 0 ? costPKR / paritySale : 0;

                return (
                  <TableRow key={idx} className="hover:bg-muted/10">
                    <TableCell className="p-2">
                      <select
                        className="w-full h-8 rounded-md border border-input bg-transparent px-2 text-xs focus-visible:outline-none"
                        value={item.category}
                        onChange={(e) => onUpdateAccessories(idx, { category: e.target.value })}
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
                        onChange={(e) => onUpdateAccessories(idx, { itemName: e.target.value })}
                        placeholder="e.g. Main Label"
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs"
                        value={item.consPerPc || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          onUpdateAccessories(idx, {
                            consPerPc: val,
                            totalCostPKR: val * item.ratePKR,
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
                          const val = Number(e.target.value);
                          onUpdateAccessories(idx, {
                            ratePKR: val,
                            rateUSD: parityProcurement > 0 ? val / parityProcurement : 0,
                            totalCostPKR: item.consPerPc * val,
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        type="number"
                        disabled
                        readOnly
                        step="0.0001"
                        placeholder="0.0000"
                        className="h-8 text-xs bg-slate-100/50 dark:bg-slate-800/40 text-muted-foreground cursor-not-allowed"
                        value={
                          item.rateUSD !== undefined && item.rateUSD > 0
                            ? Number(item.rateUSD.toFixed(4))
                            : item.ratePKR && parityProcurement > 0
                            ? Number((item.ratePKR / parityProcurement).toFixed(4))
                            : ""
                        }
                      />
                    </TableCell>
                    <TableCell className="p-2 text-right font-medium text-xs">
                      Rs. {costPKR.toFixed(1)}
                    </TableCell>
                    <TableCell className="p-2 text-right font-medium text-xs">
                      ${costUSD.toFixed(2)}
                    </TableCell>
                    <TableCell className="p-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:bg-destructive/10"
                        onClick={() => onRemoveAccessoryRow(idx)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div className="p-2.5 bg-muted/10 border-t">
          <Button variant="outline" size="sm" onClick={onAddAccessoryRow} className="h-8 text-xs">
            <Plus className="mr-1.5 size-3.5" /> Add Accessory Item
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
