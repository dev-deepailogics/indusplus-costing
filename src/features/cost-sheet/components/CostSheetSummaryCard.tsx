"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { CalculationResult } from "../services/CostSheetFormulaEngine";

interface CostSheetSummaryCardProps {
  results: CalculationResult;
  orderFOB: number;
  onOrderFOBChange: (val: number) => void;
  efficiencyOverride: string;
  onEfficiencyOverrideChange: (val: string) => void;
  rejectionOverride: string;
  onRejectionOverrideChange: (val: string) => void;
  lineTargetOverride: string;
  onLineTargetOverrideChange: (val: string) => void;
}

export function CostSheetSummaryCard({
  results,
  orderFOB,
  onOrderFOBChange,
  efficiencyOverride,
  onEfficiencyOverrideChange,
  rejectionOverride,
  onRejectionOverrideChange,
  lineTargetOverride,
  onLineTargetOverrideChange,
}: CostSheetSummaryCardProps) {
  const varianceUSD = orderFOB - results.targetFobUSD;
  const isHealthyProfit = results.netProfitPct >= 0.05;

  return (
    <Card className="bg-slate-900 text-slate-100 border-slate-800 shadow-md">
      <CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {/* Order FOB Input */}
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 block">Order FOB ($)</span>
            <div className="relative">
              <span className="absolute left-2 top-1.5 text-xs text-slate-400">$</span>
              <Input
                type="number"
                step="0.01"
                className="h-8 pl-5 bg-slate-900/90 border-slate-700 text-sm font-bold text-slate-100"
                value={orderFOB || ""}
                onChange={(e) => onOrderFOBChange(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Target FOB */}
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 block">Target FOB ($)</span>
            <div className="text-base font-bold text-emerald-400 pt-1">
              ${results.targetFobUSD.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-400">
              Var: <strong className={varianceUSD >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {varianceUSD >= 0 ? "+" : ""}${varianceUSD.toFixed(2)}
              </strong>
            </span>
          </div>

          {/* CM / Pc & CM / Min */}
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 block">CM / Piece</span>
            <div className="text-base font-bold text-slate-100 pt-1">
              ${results.cmUSD.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-400">
              {results.cmMinuteUSD.toFixed(2)}¢ / min
            </span>
          </div>

          {/* EBITDA / Pc & EBITDA / Min */}
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 block">EBITDA / Piece</span>
            <div className="text-base font-bold text-slate-100 pt-1">
              ${results.ebitdaUSD.toFixed(2)}
            </div>
            <span className="text-[10px] text-slate-400">
              {results.ebitdaMinCents.toFixed(2)}¢ / min
            </span>
          </div>

          {/* Net Profit & Profit Margin */}
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 block">Net Profit / Piece</span>
            <div className="text-base font-bold text-slate-100 pt-1">
              ${results.netProfitUSD.toFixed(2)}
            </div>
            <Badge
              className={`text-[10px] px-1.5 py-0 ${
                isHealthyProfit ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border-rose-500/30"
              }`}
            >
              {(results.netProfitPct * 100).toFixed(2)}% Margin
            </Badge>
          </div>

          {/* Line Target & Overrides */}
          <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60 space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 block">Line Target (Pcs/Day)</span>
            <div className="text-base font-bold text-slate-100 pt-1">
              {Math.round(results.lineTarget)} pcs
            </div>
            <span className="text-[10px] text-slate-400">
              Eff: <strong>{(results.efficiency * 100).toFixed(0)}%</strong> | Rej:{" "}
              <strong>{(results.rejectionPct * 100).toFixed(2)}%</strong>
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
