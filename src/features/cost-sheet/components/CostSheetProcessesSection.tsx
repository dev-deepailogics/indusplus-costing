"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CalculationResult } from "../services/CostSheetFormulaEngine";

interface CostSheetProcessesSectionProps {
  results: CalculationResult;
}

export function CostSheetProcessesSection({ results }: CostSheetProcessesSectionProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Variable Costs Table */}
      <Card className="shadow-xs border-muted/70">
        <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold">4. Variable Costs &amp; CM</CardTitle>
          <span className="text-xs font-semibold text-primary">
            CM: ${results.cmUSD.toFixed(2)} ({results.cmMinuteUSD.toFixed(2)}¢/min)
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="text-xs font-semibold">Cost Component</TableHead>
                <TableHead className="text-xs font-semibold text-right">PKR / Pc</TableHead>
                <TableHead className="text-xs font-semibold text-right">USD / Pc</TableHead>
                <TableHead className="text-xs font-semibold text-right">% of Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-xs py-2">Total Materials (Fabric + Lin + Acc + Chem + Spec)</TableCell>
                <TableCell className="text-xs py-2 text-right">
                  Rs. {(results.fabricCostPKR + results.liningCostPKR + results.accessoriesCostPKR + results.chemicalsCostPKR + results.specialChargesCostPKR).toFixed(1)}
                </TableCell>
                <TableCell className="text-xs py-2 text-right">
                  ${(results.fabricCostUSD + results.liningCostUSD + results.accessoriesCostUSD + results.chemicalsCostUSD + results.specialChargesCostUSD).toFixed(2)}
                </TableCell>
                <TableCell className="text-xs py-2 text-right">
                  {((results.fabricCostPct + results.liningCostPct + results.accessoriesCostPct + results.chemicalsCostPct + results.specialChargesCostPct) * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs py-2">Direct Labour</TableCell>
                <TableCell className="text-xs py-2 text-right">Rs. {results.directLaborCostPKR.toFixed(1)}</TableCell>
                <TableCell className="text-xs py-2 text-right">${results.directLaborCostUSD.toFixed(2)}</TableCell>
                <TableCell className="text-xs py-2 text-right">{(results.directLaborCostPct * 100).toFixed(1)}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs py-2">Utilities Cost</TableCell>
                <TableCell className="text-xs py-2 text-right">Rs. {results.utilitiesCostPKR.toFixed(1)}</TableCell>
                <TableCell className="text-xs py-2 text-right">${results.utilitiesCostUSD.toFixed(2)}</TableCell>
                <TableCell className="text-xs py-2 text-right">{(results.utilitiesCostPct * 100).toFixed(1)}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs py-2">Leftover / Rejection Allowance</TableCell>
                <TableCell className="text-xs py-2 text-right">Rs. {results.leftoverCostPKR.toFixed(1)}</TableCell>
                <TableCell className="text-xs py-2 text-right">${results.leftoverCostUSD.toFixed(2)}</TableCell>
                <TableCell className="text-xs py-2 text-right">{(results.leftoverCostPct * 100).toFixed(1)}%</TableCell>
              </TableRow>
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell className="text-xs py-2">Total Variable Cost</TableCell>
                <TableCell className="text-xs py-2 text-right">Rs. {results.totalVariableCostPKR.toFixed(1)}</TableCell>
                <TableCell className="text-xs py-2 text-right">${results.totalVariableCostUSD.toFixed(2)}</TableCell>
                <TableCell className="text-xs py-2 text-right">{(results.totalVariableCostPct * 100).toFixed(1)}%</TableCell>
              </TableRow>
              <TableRow className="bg-primary/5 font-bold text-primary">
                <TableCell className="text-xs py-2">Contribution Margin (CM)</TableCell>
                <TableCell className="text-xs py-2 text-right">Rs. {results.cmPKR.toFixed(1)}</TableCell>
                <TableCell className="text-xs py-2 text-right">${results.cmUSD.toFixed(2)}</TableCell>
                <TableCell className="text-xs py-2 text-right">{(results.cmPct * 100).toFixed(1)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Fixed Overheads Table */}
      <Card className="shadow-xs border-muted/70">
        <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold">5. Factory Overheads (FOH) &amp; EBITDA</CardTitle>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            EBITDA: ${results.ebitdaUSD.toFixed(2)}
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="text-xs font-semibold">Overhead Component</TableHead>
                <TableHead className="text-xs font-semibold text-right">PKR / Pc</TableHead>
                <TableHead className="text-xs font-semibold text-right">USD / Pc</TableHead>
                <TableHead className="text-xs font-semibold text-right">% of Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="text-xs py-2">Fixed Salaries</TableCell>
                <TableCell className="text-xs py-2 text-right">Rs. {results.salariesCostPKR.toFixed(1)}</TableCell>
                <TableCell className="text-xs py-2 text-right">${results.salariesCostUSD.toFixed(2)}</TableCell>
                <TableCell className="text-xs py-2 text-right">{(results.salariesCostPct * 100).toFixed(1)}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs py-2">Manufacturing FOH / Admin</TableCell>
                <TableCell className="text-xs py-2 text-right">Rs. {results.fohAdminCostPKR.toFixed(1)}</TableCell>
                <TableCell className="text-xs py-2 text-right">${results.fohAdminCostUSD.toFixed(2)}</TableCell>
                <TableCell className="text-xs py-2 text-right">{(results.fohAdminCostPct * 100).toFixed(1)}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs py-2">Repair &amp; Maintenance</TableCell>
                <TableCell className="text-xs py-2 text-right">Rs. {results.repairMtcCostPKR.toFixed(1)}</TableCell>
                <TableCell className="text-xs py-2 text-right">${results.repairMtcCostUSD.toFixed(2)}</TableCell>
                <TableCell className="text-xs py-2 text-right">{(results.repairMtcCostPct * 100).toFixed(1)}%</TableCell>
              </TableRow>
              <TableRow className="bg-muted/30 font-semibold">
                <TableCell className="text-xs py-2">Total Fixed Overheads</TableCell>
                <TableCell className="text-xs py-2 text-right">Rs. {results.totalCostPKR.toFixed(1)}</TableCell>
                <TableCell className="text-xs py-2 text-right">${results.totalCostUSD.toFixed(2)}</TableCell>
                <TableCell className="text-xs py-2 text-right">{(results.totalCostPct * 100).toFixed(1)}%</TableCell>
              </TableRow>
              <TableRow className="bg-emerald-500/10 font-bold text-emerald-700 dark:text-emerald-300">
                <TableCell className="text-xs py-2">EBITDA (CM - Overheads)</TableCell>
                <TableCell className="text-xs py-2 text-right">Rs. {results.ebitdaPKR.toFixed(1)}</TableCell>
                <TableCell className="text-xs py-2 text-right">${results.ebitdaUSD.toFixed(2)}</TableCell>
                <TableCell className="text-xs py-2 text-right">{(results.ebitdaPct * 100).toFixed(1)}%</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-xs py-2">Depreciation</TableCell>
                <TableCell className="text-xs py-2 text-right">Rs. {results.depreciationCostPKR.toFixed(1)}</TableCell>
                <TableCell className="text-xs py-2 text-right">${results.depreciationCostUSD.toFixed(2)}</TableCell>
                <TableCell className="text-xs py-2 text-right">{(results.depreciationCostPct * 100).toFixed(1)}%</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
