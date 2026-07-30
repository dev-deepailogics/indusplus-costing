"use client";

import { useEffect, useState, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatrixTableEditor } from "./matrix-table-editor";
import type {
  MatrixTableData,
  ProcessMatrixTableData,
} from "@/lib/parameters/types";

import { subscribeToStyles } from "@/lib/style-master/firestore";
import type { StyleMasterItem } from "@/lib/style-master/types";
import {
  calculateSizeBracket,
  mapSMVToCategory,
  getWashingRejection,
} from "@/lib/cost-sheet/formula-engine";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ProcessMatrixEditor({
  data,
  onSave,
}: {
  data: ProcessMatrixTableData;
  onSave: (data: ProcessMatrixTableData) => Promise<void>;
}) {
  const [active, setActive] = useState(data.processes[0]);
  const [styles, setStyles] = useState<StyleMasterItem[]>([]);

  // Subscribe to style master records to resolve active order quantity band sums
  useEffect(() => {
    return subscribeToStyles(setStyles);
  }, []);

  function saveProcessTable(process: string, table: MatrixTableData) {
    return onSave({ ...data, tables: { ...data.tables, [process]: table } });
  }

  // Construct read-only Total Table (dynamic processes sum)
  const totalTable = useMemo(() => {
    const firstTable = Object.values(data.tables)[0];
    if (!firstTable) return null;

    const cells: Record<string, Record<string, string>> = {};
    for (const row of firstTable.rowLabels) {
      cells[row] = {};
      for (const col of firstTable.columnLabels) {
        let sum = 0;
        for (const p of data.processes) {
          const t = data.tables[p];
          if (t && t.cells[row]?.[col]) {
            sum += parseFloat(t.cells[row][col]) || 0;
          }
        }
        cells[row][col] = `${sum.toFixed(2)}%`;
      }
    }
    return {
      rowLabels: firstTable.rowLabels,
      columnLabels: firstTable.columnLabels,
      cells,
    };
  }, [data]);

  // Compute live rejection totals per registered style master
  const styleSummaries = useMemo(() => {
    return styles.map((style) => {
      const sizeBracket = calculateSizeBracket(style.orderQuantity);
      const styleCategoryClass = mapSMVToCategory(style.smvSewing);

      const processRejections: Record<string, number> = {};
      let baseRejectionSum = 0;
      for (const p of data.processes) {
        const table = data.tables[p];
        if (table) {
          const cellStr =
            table.cells[sizeBracket]?.[styleCategoryClass] || "0%";
          const cellVal = parseFloat(cellStr) / 100;
          processRejections[p] = cellVal;
          baseRejectionSum += cellVal;
        } else {
          processRejections[p] = 0;
        }
      }

      const washingRejection = getWashingRejection(style.washType, sizeBracket);
      const totalRejection = baseRejectionSum + washingRejection;

      return {
        style,
        sizeBracket,
        styleCategoryClass,
        processRejections,
        baseRejectionSum,
        washingRejection,
        totalRejection,
      };
    });
  }, [styles, data]);

  return (
    <div className="space-y-6">
      <Tabs value={active} onValueChange={(v) => setActive(v as string)}>
        <TabsList className="flex flex-wrap h-auto bg-muted p-1">
          {data.processes.map((p) => (
            <TabsTrigger
              key={p}
              value={p}
              className="data-active:bg-primary data-active:text-primary-foreground py-1.5 px-3 text-xs"
            >
              {p}
            </TabsTrigger>
          ))}
          {totalTable && (
            <TabsTrigger
              value="total-rejections"
              className="data-active:bg-emerald-600 data-active:text-white py-1.5 px-3 text-xs font-semibold text-emerald-800"
            >
              Total (Processes Sum)
            </TabsTrigger>
          )}
        </TabsList>
        {data.processes.map((p) => (
          <TabsContent key={p} value={p} className="pt-2">
            <MatrixTableEditor
              data={data.tables[p]}
              onSave={(table) => saveProcessTable(p, table)}
              rowLabelHeader="Qty. Band"
            />
          </TabsContent>
        ))}
        {totalTable && (
          <TabsContent value="total-rejections" className="pt-2">
            <div className="space-y-3">
              <div className="rounded-lg border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-semibold text-foreground">
                        Qty. Band
                      </TableHead>
                      {totalTable.columnLabels.map((col) => (
                        <TableHead
                          key={col}
                          className="font-semibold text-foreground"
                        >
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {totalTable.rowLabels.map((row) => (
                      <TableRow key={row} className="hover:bg-muted/10">
                        <TableCell className="font-semibold text-muted-foreground">
                          {row}
                        </TableCell>
                        {totalTable.columnLabels.map((col) => (
                          <TableCell
                            key={col}
                            className="font-mono text-xs font-bold text-foreground"
                          >
                            {totalTable.cells[row]?.[col] || "0.00%"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* <p className="text-xs text-muted-foreground italic px-1">
                Note: This table automatically sums Fabric + Cutting + Sewing + Finishing + WIP + E1 tables cell-by-cell.
              </p> */}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Style-level Rejection Breakdown Summary Table
      <Card className="border-muted shadow-md overflow-hidden bg-card/60">
        <CardHeader className="bg-muted/30 border-b py-4">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <span>Apparel Styles - Dynamic Rejection Summary (Order Quantity Pcs Related)</span>
            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
              Live Calc
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {styleSummaries.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No style master records found. Rejection summaries will display once styles are created.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="font-semibold text-xs text-foreground py-2.5">Style ID & Name</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground py-2.5">Category Class</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground py-2.5">Order Qty (Band)</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground py-2.5 text-right">Process Sum</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground py-2.5">Wash Type</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground py-2.5 text-right">Wash Rej.</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground py-2.5 text-right pr-4">Total Rej.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {styleSummaries.map(({ style, sizeBracket, styleCategoryClass, baseRejectionSum, washingRejection, totalRejection }) => (
                  <TableRow key={style.id} className="hover:bg-muted/10">
                    <TableCell className="py-2.5 text-xs">
                      <span className="font-bold text-primary block">{style.id}</span>
                      <span className="text-muted-foreground font-medium text-[11px]">{style.styleName}</span>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs font-semibold">
                      {styleCategoryClass}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-muted-foreground font-medium">
                      {style.orderQuantity.toLocaleString()} pcs
                      <Badge variant="outline" className="ml-1.5 text-[10px] px-1 py-0 border-blue-200 text-blue-700 bg-blue-50 font-bold">
                        {sizeBracket}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-right font-mono font-semibold">
                      {(baseRejectionSum * 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="py-2.5 text-xs font-medium text-muted-foreground">
                      {style.washType}
                    </TableCell>
                    <TableCell className="py-2.5 text-xs text-right font-mono text-muted-foreground font-semibold">
                      {(washingRejection * 100).toFixed(2)}%
                    </TableCell>
                    <TableCell className="py-2.5 text-right pr-4">
                      <Badge className="font-mono text-xs font-extrabold bg-primary text-primary-foreground shadow-sm">
                        {(totalRejection * 100).toFixed(2)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card> */}
    </div>
  );
}
