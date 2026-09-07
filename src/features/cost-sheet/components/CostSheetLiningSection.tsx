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
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { BOMLiningItem } from "@/features/style-master";
import type { CatalogItem } from "@/features/item-catalog";

interface CostSheetLiningSectionProps {
  bomLining: BOMLiningItem[];
  onUpdateLining: (idx: number, patch: Partial<BOMLiningItem>) => void;
  onAddLiningRow: () => void;
  onRemoveLiningRow: (idx: number) => void;
  liningCatalog: CatalogItem[];
  parityProcurement: number;
  paritySale: number;
  netPriceUSD: number;
}

export function CostSheetLiningSection({
  bomLining,
  onUpdateLining,
  onAddLiningRow,
  onRemoveLiningRow,
  liningCatalog,
  parityProcurement,
  paritySale,
  netPriceUSD,
}: CostSheetLiningSectionProps) {
  const catalogOptions = liningCatalog.map((item) => ({
    value: item.name,
    label: item.name,
  }));

  const totalLiningPKR = bomLining.reduce(
    (acc, l) => acc + (l.consumptionPerPc || 0) * (l.rateUSD || 0) * parityProcurement,
    0
  );
  const totalLiningUSD = paritySale > 0 ? totalLiningPKR / paritySale : 0;
  const totalLiningPct = netPriceUSD > 0 ? (totalLiningUSD / netPriceUSD) * 100 : 0;

  return (
    <Card className="shadow-xs border-muted/70">
      <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold">2. Pocket Lining (BOM)</CardTitle>
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span>
            Total: <strong>Rs. {totalLiningPKR.toFixed(1)}</strong> (${totalLiningUSD.toFixed(2)})
          </span>
          <span className="text-muted-foreground font-mono">({totalLiningPct.toFixed(1)}%)</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/10">
            <TableRow>
              <TableHead className="text-xs font-semibold">Lining Item Name</TableHead>
              <TableHead className="w-24 text-xs font-semibold">Cons. (Mtr)</TableHead>
              <TableHead className="w-28 text-xs font-semibold">Rate (USD)</TableHead>
              <TableHead className="w-28 text-xs font-semibold">Rate (PKR)</TableHead>
              <TableHead className="w-32 text-xs font-semibold text-right">Cost (PKR)</TableHead>
              <TableHead className="w-24 text-xs font-semibold text-right">Cost ($)</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {bomLining.map((item, idx) => {
              const costPKR = (item.consumptionPerPc || 0) * (item.rateUSD || 0) * parityProcurement;
              const costUSD = paritySale > 0 ? costPKR / paritySale : 0;

              return (
                <TableRow key={idx} className="hover:bg-muted/10">
                  <TableCell className="p-2">
                    <SearchableSelect
                      options={catalogOptions}
                      value={item.itemName}
                      onChange={(val) => onUpdateLining(idx, { itemName: val })}
                      placeholder="Search or enter item name..."
                      className="h-8 text-xs"
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs"
                      value={item.consumptionPerPc || ""}
                      onChange={(e) =>
                        onUpdateLining(idx, { consumptionPerPc: Number(e.target.value) })
                      }
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs"
                      value={item.rateUSD || ""}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        onUpdateLining(idx, {
                          rateUSD: val,
                          ratePKR: val * parityProcurement,
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
                        onUpdateLining(idx, {
                          ratePKR: val,
                          rateUSD: parityProcurement > 0 ? val / parityProcurement : 0,
                        });
                      }}
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
                      onClick={() => onRemoveLiningRow(idx)}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="p-2.5 bg-muted/10 border-t">
          <Button variant="outline" size="sm" onClick={onAddLiningRow} className="h-8 text-xs">
            <Plus className="mr-1.5 size-3.5" /> Add Lining Item
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
