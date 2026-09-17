"use client";

import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BOMChemicalsItem, BOMSpecialChargesItem } from "../types";

interface StyleChargesTabProps {
  formChemicals: BOMChemicalsItem[];
  onFormChemicalsChange: (chemicals: BOMChemicalsItem[]) => void;
  formSpecialCharges: BOMSpecialChargesItem[];
  onFormSpecialChargesChange: (charges: BOMSpecialChargesItem[]) => void;
}

export function StyleChargesTab({
  formChemicals,
  onFormChemicalsChange,
  formSpecialCharges,
  onFormSpecialChargesChange,
}: StyleChargesTabProps) {
  function updateChemical(idx: number, patch: Partial<BOMChemicalsItem>) {
    const next = [...formChemicals];
    next[idx] = { ...next[idx], ...patch };
    onFormChemicalsChange(next);
  }

  function updateCharge(idx: number, patch: Partial<BOMSpecialChargesItem>) {
    const next = [...formSpecialCharges];
    next[idx] = { ...next[idx], ...patch };
    onFormSpecialChargesChange(next);
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Chemical / Wash Costs
        </h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Wash Item Name</TableHead>
                <TableHead className="w-24">Cons. / Pc</TableHead>
                <TableHead className="w-28">Rate (PKR)</TableHead>
                <TableHead className="w-32">Total (PKR)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formChemicals.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="p-2">
                    <Input
                      value={item.washItem}
                      onChange={(e) => updateChemical(idx, { washItem: e.target.value })}
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={item.consPerPc || ""}
                      onChange={(e) => {
                        const cons = Number(e.target.value);
                        updateChemical(idx, {
                          consPerPc: cons,
                          totalCostPKR: cons * item.ratePKR,
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Input
                      type="number"
                      value={item.ratePKR || ""}
                      onChange={(e) => {
                        const rate = Number(e.target.value);
                        updateChemical(idx, {
                          ratePKR: rate,
                          totalCostPKR: item.consPerPc * rate,
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell className="p-2 align-middle font-medium text-right pr-4">
                    Rs. {item.totalCostPKR.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Special Charges (Embroidery, Print, Testing, etc.)
        </h3>
        <div className="rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead>Charge Category</TableHead>
                <TableHead className="w-24">Cons. / Pc</TableHead>
                <TableHead className="w-28">Rate (PKR)</TableHead>
                <TableHead className="w-32">Total (PKR)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {formSpecialCharges.map((item, idx) => (
                <TableRow key={idx}>
                  <TableCell className="p-2 font-medium text-sm text-foreground">
                    {item.itemName}
                  </TableCell>
                  <TableCell className="p-2">
                    <Input
                      type="number"
                      step="0.01"
                      value={item.consPerPc || ""}
                      onChange={(e) => {
                        const cons = Number(e.target.value);
                        updateCharge(idx, {
                          consPerPc: cons,
                          totalCostPKR: cons * item.ratePKR,
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell className="p-2">
                    <Input
                      type="number"
                      value={item.ratePKR || ""}
                      onChange={(e) => {
                        const rate = Number(e.target.value);
                        updateCharge(idx, {
                          ratePKR: rate,
                          totalCostPKR: item.consPerPc * rate,
                        });
                      }}
                    />
                  </TableCell>
                  <TableCell className="p-2 align-middle font-medium text-right pr-4">
                    Rs. {item.totalCostPKR.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
