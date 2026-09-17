"use client";

import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { StyleMasterItem } from "@/features/style-master";
import type { CalculationResult } from "../services/CostSheetFormulaEngine";

interface CostSheetPrintViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeStyle: StyleMasterItem;
  results: CalculationResult;
  costingDate: string;
  costingStage: string;
  paritySale: number;
  parityProcurement: number;
}

export function CostSheetPrintView({
  open,
  onOpenChange,
  activeStyle,
  results,
  costingDate,
  costingStage,
  paritySale,
  parityProcurement,
}: CostSheetPrintViewProps) {
  function handleTriggerBrowserPrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto p-6 font-sans">
        <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div>
            <DialogTitle className="text-xl font-bold">Apparel Cost Sheet Report</DialogTitle>
            <p className="text-xs text-muted-foreground">Indus Plus Costing Engine Snapshot</p>
          </div>
          <Button size="sm" onClick={handleTriggerBrowserPrint}>
            <Printer className="mr-1.5 size-4" /> Print Now
          </Button>
        </DialogHeader>

        <div className="space-y-6 pt-4 text-xs">
          {/* Style Header Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-lg border">
            <div>
              <span className="text-muted-foreground block text-[11px]">Style Code:</span>
              <strong className="text-sm font-bold text-primary">{activeStyle.id}</strong>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Style Name:</span>
              <strong className="text-sm">{activeStyle.styleName || "—"}</strong>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Customer:</span>
              <strong className="text-sm">{activeStyle.customerName || "—"}</strong>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Order Qty:</span>
              <strong className="text-sm">{activeStyle.orderQuantity.toLocaleString()} pcs</strong>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Category / Wash:</span>
              <span>{activeStyle.styleCategory} / {activeStyle.washType}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">SMV Sewing:</span>
              <span>{activeStyle.smvSewing} min</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Parity (Sale / Proc):</span>
              <span>Rs. {paritySale} / Rs. {parityProcurement}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Costing Date / Stage:</span>
              <span>{costingDate} ({costingStage})</span>
            </div>
          </div>

          {/* KPI Summary Banner */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 p-3 bg-slate-900 text-slate-100 rounded-lg text-center">
            <div>
              <span className="text-[10px] text-slate-400 block">Order FOB</span>
              <strong className="text-sm">${activeStyle.baseSellingPrice.toFixed(2)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Target FOB</span>
              <strong className="text-sm text-emerald-400">${results.targetFobUSD.toFixed(2)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">CM / Pc</span>
              <strong className="text-sm">${results.cmUSD.toFixed(2)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">CM / Min</span>
              <strong className="text-sm">{results.cmMinuteUSD.toFixed(2)}¢</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">EBITDA / Pc</span>
              <strong className="text-sm">${results.ebitdaUSD.toFixed(2)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 block">Net Profit Margin</span>
              <strong className="text-sm text-emerald-400">{(results.netProfitPct * 100).toFixed(2)}%</strong>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-muted/40 font-semibold border-b">
                <tr>
                  <th className="p-2.5">Cost Category</th>
                  <th className="p-2.5 text-right">PKR / Pc</th>
                  <th className="p-2.5 text-right">USD / Pc</th>
                  <th className="p-2.5 text-right">% of Net Price</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="p-2">Selling Price (Order FOB)</td>
                  <td className="p-2 text-right">Rs. {results.sellingPricePKR.toFixed(1)}</td>
                  <td className="p-2 text-right">${results.sellingPriceUSD.toFixed(2)}</td>
                  <td className="p-2 text-right">100.0%</td>
                </tr>
                <tr>
                  <td className="p-2 text-muted-foreground pl-4">Less: Selling &amp; Financial Deductions</td>
                  <td className="p-2 text-right text-muted-foreground">
                    -Rs. {(results.sellingPricePKR - results.netPricePKR).toFixed(1)}
                  </td>
                  <td className="p-2 text-right text-muted-foreground">
                    -${(results.sellingPriceUSD - results.netPriceUSD).toFixed(2)}
                  </td>
                  <td className="p-2 text-right text-muted-foreground">
                    {((1 - results.netPricePct) * 100).toFixed(1)}%
                  </td>
                </tr>
                <tr className="bg-muted/10 font-semibold">
                  <td className="p-2">Net Realized Price</td>
                  <td className="p-2 text-right">Rs. {results.netPricePKR.toFixed(1)}</td>
                  <td className="p-2 text-right">${results.netPriceUSD.toFixed(2)}</td>
                  <td className="p-2 text-right">100.0%</td>
                </tr>
                <tr>
                  <td className="p-2 pl-4">Fabric Materials</td>
                  <td className="p-2 text-right">Rs. {results.fabricCostPKR.toFixed(1)}</td>
                  <td className="p-2 text-right">${results.fabricCostUSD.toFixed(2)}</td>
                  <td className="p-2 text-right">{(results.fabricCostPct * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="p-2 pl-4">Pocket Lining</td>
                  <td className="p-2 text-right">Rs. {results.liningCostPKR.toFixed(1)}</td>
                  <td className="p-2 text-right">${results.liningCostUSD.toFixed(2)}</td>
                  <td className="p-2 text-right">{(results.liningCostPct * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="p-2 pl-4">Accessories &amp; Trims</td>
                  <td className="p-2 text-right">Rs. {results.accessoriesCostPKR.toFixed(1)}</td>
                  <td className="p-2 text-right">${results.accessoriesCostUSD.toFixed(2)}</td>
                  <td className="p-2 text-right">{(results.accessoriesCostPct * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="p-2 pl-4">Washing &amp; Chemicals</td>
                  <td className="p-2 text-right">Rs. {results.chemicalsCostPKR.toFixed(1)}</td>
                  <td className="p-2 text-right">${results.chemicalsCostUSD.toFixed(2)}</td>
                  <td className="p-2 text-right">{(results.chemicalsCostPct * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="p-2 pl-4">Special Charges (Embroidery, Print, Testing)</td>
                  <td className="p-2 text-right">Rs. {results.specialChargesCostPKR.toFixed(1)}</td>
                  <td className="p-2 text-right">${results.specialChargesCostUSD.toFixed(2)}</td>
                  <td className="p-2 text-right">{(results.specialChargesCostPct * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="p-2 pl-4">Direct Labour</td>
                  <td className="p-2 text-right">Rs. {results.directLaborCostPKR.toFixed(1)}</td>
                  <td className="p-2 text-right">${results.directLaborCostUSD.toFixed(2)}</td>
                  <td className="p-2 text-right">{(results.directLaborCostPct * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="p-2 pl-4">Utilities Cost</td>
                  <td className="p-2 text-right">Rs. {results.utilitiesCostPKR.toFixed(1)}</td>
                  <td className="p-2 text-right">${results.utilitiesCostUSD.toFixed(2)}</td>
                  <td className="p-2 text-right">{(results.utilitiesCostPct * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="p-2 pl-4">Leftover / Rejection Allowance</td>
                  <td className="p-2 text-right">Rs. {results.leftoverCostPKR.toFixed(1)}</td>
                  <td className="p-2 text-right">${results.leftoverCostUSD.toFixed(2)}</td>
                  <td className="p-2 text-right">{(results.leftoverCostPct * 100).toFixed(1)}%</td>
                </tr>
                <tr className="bg-primary/5 font-bold text-primary">
                  <td className="p-2">Contribution Margin (CM)</td>
                  <td className="p-2 text-right">Rs. {results.cmPKR.toFixed(1)}</td>
                  <td className="p-2 text-right">${results.cmUSD.toFixed(2)}</td>
                  <td className="p-2 text-right">{(results.cmPct * 100).toFixed(1)}%</td>
                </tr>
                <tr>
                  <td className="p-2 text-muted-foreground pl-4">Less: Fixed Factory Overheads (Salaries, FOH, Maintenance)</td>
                  <td className="p-2 text-right text-muted-foreground">Rs. {results.totalCostPKR.toFixed(1)}</td>
                  <td className="p-2 text-right text-muted-foreground">${results.totalCostUSD.toFixed(2)}</td>
                  <td className="p-2 text-right text-muted-foreground">{(results.totalCostPct * 100).toFixed(1)}%</td>
                </tr>
                <tr className="bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-300">
                  <td className="p-2">EBITDA</td>
                  <td className="p-2 text-right">Rs. {results.ebitdaPKR.toFixed(1)}</td>
                  <td className="p-2 text-right">${results.ebitdaUSD.toFixed(2)}</td>
                  <td className="p-2 text-right">{(results.ebitdaPct * 100).toFixed(1)}%</td>
                </tr>
                <tr className="bg-muted/20 font-bold">
                  <td className="p-2">Net Profit (EBITDA - Depreciation)</td>
                  <td className="p-2 text-right">Rs. {results.netProfitPKR.toFixed(1)}</td>
                  <td className="p-2 text-right">${results.netProfitUSD.toFixed(2)}</td>
                  <td className="p-2 text-right">{(results.netProfitPct * 100).toFixed(2)}%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
