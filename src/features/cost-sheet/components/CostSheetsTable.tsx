import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SavedCostSheetItem } from "../types";

interface CostSheetsTableProps {
  costSheets: SavedCostSheetItem[];
  loading: boolean;
  onDelete: (id: string, e: React.MouseEvent) => void;
}

export function CostSheetsTable({
  costSheets,
  loading,
  onDelete,
}: CostSheetsTableProps) {
  const router = useRouter();

  return (
    <Card className="shadow-md border-muted/60">
      <CardContent className="p-0">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Loading saved cost sheets…
          </div>
        ) : costSheets.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No saved cost sheets found matching your criteria.
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-foreground">Sheet ID</TableHead>
                <TableHead className="font-semibold text-foreground">Scenario</TableHead>
                <TableHead className="font-semibold text-foreground">Style ID &amp; Name</TableHead>
                <TableHead className="font-semibold text-foreground">Customer</TableHead>
                <TableHead className="font-semibold text-foreground">Stage</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Order FOB</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Target FOB</TableHead>
                <TableHead className="font-semibold text-foreground text-right">CM ($/pc)</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Net Profit (%)</TableHead>
                <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {costSheets.map((sheet) => {
                const profitPct = (sheet.calculations?.netProfitPct ?? 0) * 100;
                const isHealthy = profitPct >= 5;

                return (
                  <TableRow
                    key={sheet.id}
                    className="hover:bg-muted/20 cursor-pointer"
                    onClick={() => router.push(`/cost-sheet?costSheetId=${sheet.id}&mode=view`)}
                  >
                    <TableCell className="font-medium text-xs text-primary font-mono">
                      {sheet.id}
                    </TableCell>
                    <TableCell className="font-semibold text-sm">
                      {sheet.referenceName}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="font-bold text-foreground block">{sheet.styleId}</span>
                      <span className="text-muted-foreground">{sheet.styleName}</span>
                    </TableCell>
                    <TableCell className="text-xs">{sheet.customerName}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px] font-normal">
                        {sheet.costingStage}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-sm">
                      ${sheet.orderFOB.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      ${(sheet.calculations?.targetFobUSD ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      ${(sheet.calculations?.cmUSD ?? 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      <Badge
                        variant={isHealthy ? "default" : "destructive"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {profitPct.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 text-sky-600 border-sky-200 bg-sky-50/50 hover:bg-sky-50"
                          onClick={() => router.push(`/cost-sheet?costSheetId=${sheet.id}&mode=view`)}
                          title="View Cost Sheet (Read-Only)"
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 text-emerald-600 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50"
                          onClick={() => router.push(`/cost-sheet?costSheetId=${sheet.id}&mode=edit`)}
                          title="Edit Cost Sheet"
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 text-destructive border-destructive/20 hover:bg-destructive/5"
                          onClick={(e) => onDelete(sheet.id, e)}
                          title="Delete Cost Sheet"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
