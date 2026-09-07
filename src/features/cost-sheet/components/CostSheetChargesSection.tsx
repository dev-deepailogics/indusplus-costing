"use client";

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
import type { BOMChemicalsItem, BOMSpecialChargesItem } from "@/features/style-master";
import type { CalculationResult } from "../services/CostSheetFormulaEngine";

interface CostSheetChargesSectionProps {
  bomChemicals: BOMChemicalsItem[];
  onUpdateChemicals: (idx: number, patch: Partial<BOMChemicalsItem>) => void;
  bomSpecialCharges: BOMSpecialChargesItem[];
  onUpdateSpecialCharges: (idx: number, patch: Partial<BOMSpecialChargesItem>) => void;
  results: CalculationResult;
  commissionPct: number;
  onCommissionPctChange: (val: number) => void;
  discountRate: number;
  onDiscountRateChange: (val: number) => void;
  paymentTermsDays: number;
  onPaymentTermsDaysChange: (val: number) => void;
  factoringDays: number;
  onFactoringDaysChange: (val: number) => void;
  foreignBankCharges: number;
  onForeignBankChargesChange: (val: number) => void;
  parityProcurement: number;
  paritySale: number;
}

export function CostSheetChargesSection({
  bomChemicals,
  onUpdateChemicals,
  bomSpecialCharges,
  onUpdateSpecialCharges,
  results,
  commissionPct,
  onCommissionPctChange,
  discountRate,
  onDiscountRateChange,
  paymentTermsDays,
  onPaymentTermsDaysChange,
  factoringDays,
  onFactoringDaysChange,
  foreignBankCharges,
  onForeignBankChargesChange,
  parityProcurement,
  paritySale,
}: CostSheetChargesSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Chemicals & Special Charges */}
      <div className="space-y-4">
        {/* Chemicals */}
        <Card className="shadow-xs border-muted/70">
          <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold">6. Washing &amp; Chemicals</CardTitle>
            <span className="text-xs font-semibold">
              Total: <strong>Rs. {results.chemicalsCostPKR.toFixed(1)}</strong> (${results.chemicalsCostUSD.toFixed(2)})
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="text-xs font-semibold">Wash Item Name</TableHead>
                  <TableHead className="w-24 text-xs font-semibold">Cons. / Pc</TableHead>
                  <TableHead className="w-28 text-xs font-semibold">Rate (PKR)</TableHead>
                  <TableHead className="w-32 text-xs font-semibold text-right">Total (PKR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bomChemicals.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="p-2">
                      <Input
                        className="h-8 text-xs"
                        value={item.washItem}
                        onChange={(e) => onUpdateChemicals(idx, { washItem: e.target.value })}
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
                          onUpdateChemicals(idx, {
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
                          onUpdateChemicals(idx, {
                            ratePKR: val,
                            totalCostPKR: item.consPerPc * val,
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="p-2 text-right font-medium text-xs">
                      Rs. {item.totalCostPKR.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Special Charges */}
        <Card className="shadow-xs border-muted/70">
          <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold">7. Special Charges (Embroidery / Print)</CardTitle>
            <span className="text-xs font-semibold">
              Total: <strong>Rs. {results.specialChargesCostPKR.toFixed(1)}</strong> (${results.specialChargesCostUSD.toFixed(2)})
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="text-xs font-semibold">Charge Category</TableHead>
                  <TableHead className="w-24 text-xs font-semibold">Cons. / Pc</TableHead>
                  <TableHead className="w-28 text-xs font-semibold">Rate (PKR)</TableHead>
                  <TableHead className="w-32 text-xs font-semibold text-right">Total (PKR)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bomSpecialCharges.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="p-2 font-medium text-xs text-foreground">
                      {item.itemName}
                    </TableCell>
                    <TableCell className="p-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8 text-xs"
                        value={item.consPerPc || ""}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          onUpdateSpecialCharges(idx, {
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
                          onUpdateSpecialCharges(idx, {
                            ratePKR: val,
                            totalCostPKR: item.consPerPc * val,
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="p-2 text-right font-medium text-xs">
                      Rs. {item.totalCostPKR.toFixed(1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Selling / Admin / Financial Deductions Table */}
      <Card className="shadow-xs border-muted/70">
        <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold">8. Selling &amp; Financial Deductions</CardTitle>
          <span className="text-xs font-semibold text-primary">
            Net Price: ${results.netPriceUSD.toFixed(2)} (Rs. {results.netPricePKR.toFixed(1)})
          </span>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Commission (%)</label>
              <Input
                type="number"
                step="0.1"
                className="h-8 text-xs"
                value={commissionPct || ""}
                onChange={(e) => onCommissionPctChange(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Discount Rate (Annual %)</label>
              <Input
                type="number"
                step="0.01"
                className="h-8 text-xs"
                value={(discountRate * 100) || ""}
                onChange={(e) => onDiscountRateChange(Number(e.target.value) / 100)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Payment Terms Days</label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={paymentTermsDays || ""}
                onChange={(e) => onPaymentTermsDaysChange(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground">Factoring Days</label>
              <Input
                type="number"
                className="h-8 text-xs"
                value={factoringDays || ""}
                onChange={(e) => onFactoringDaysChange(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-semibold text-muted-foreground">Foreign Bank Charges ($/pc)</label>
              <Input
                type="number"
                step="0.01"
                className="h-8 text-xs"
                value={foreignBankCharges || ""}
                onChange={(e) => onForeignBankChargesChange(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/10">
                <TableRow>
                  <TableHead className="text-xs font-semibold">Deduction</TableHead>
                  <TableHead className="text-xs font-semibold text-right">PKR / Pc</TableHead>
                  <TableHead className="text-xs font-semibold text-right">USD / Pc</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs py-1.5">Tax &amp; EDS</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">Rs. {results.taxEDS_PKR.toFixed(1)}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">${results.taxEDS_USD.toFixed(3)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs py-1.5">Commission</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">Rs. {results.commissionPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">${results.commissionUSD.toFixed(3)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs py-1.5">Inland Freight &amp; Clearing</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">Rs. {results.freightPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">${results.freightUSD.toFixed(3)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs py-1.5">Markup &amp; Discounting</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">Rs. {results.markupDiscountPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">${results.markupDiscountUSD.toFixed(3)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs py-1.5">Local Bank Charges</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">Rs. {results.bankChargesPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">${results.bankChargesUSD.toFixed(3)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs py-1.5">Factoring Cost</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">Rs. {results.factoringPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">${results.factoringUSD.toFixed(3)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="text-xs py-1.5">Foreign Bank Charges</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">Rs. {results.foreignBankChargesPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-xs py-1.5 text-right">${results.foreignBankChargesUSD.toFixed(3)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
