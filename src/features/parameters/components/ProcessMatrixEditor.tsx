"use client";

import { useEffect, useState, useMemo } from "react";
import { Building2, X, Sparkles, Check, Trash2, Edit3 } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { subscribeToStyles } from "@/lib/style-master/firestore";
import type { StyleMasterItem } from "@/lib/style-master/types";
import { calculateSizeBracket, mapSMVToCategory, getWashingRejection } from "@/lib/cost-sheet/formula-engine";
import type { MatrixTableData, ProcessMatrixTableData } from "../types";
import { MatrixTableEditor } from "./MatrixTableEditor";

export function ProcessMatrixEditor({
  data,
  onSave,
}: {
  data: ProcessMatrixTableData;
  onSave: (data: ProcessMatrixTableData) => Promise<void>;
}) {
  const [active, setActive] = useState(data.processes[0] || "Fabric");
  const [styles, setStyles] = useState<StyleMasterItem[]>([]);
  const [customerOptionsList, setCustomerOptionsList] = useState<string[]>([]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [customerRateInput, setCustomerRateInput] = useState<string>("");
  const [isSavingRate, setIsSavingRate] = useState(false);

  // Subscribe to style master records to resolve active order quantity band sums
  useEffect(() => {
    return subscribeToStyles(setStyles);
  }, []);

  // Fetch customer list from API
  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((resData: { customers?: string[]; error?: string }) => {
        if (resData.customers && resData.customers.length > 0) {
          setCustomerOptionsList(resData.customers);
        }
      })
      .catch((err) => console.error("[ProcessMatrixEditor] Failed to load customers:", err));
  }, []);

  // Compute all unique available customers
  const allCustomerNames = useMemo(() => {
    const set = new Set<string>();
    customerOptionsList.forEach((c) => c && set.add(c.trim()));
    styles.forEach((s) => s.customerName && set.add(s.customerName.trim()));
    if (data.customerRejections) {
      Object.keys(data.customerRejections).forEach((c) => c && set.add(c.trim()));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [customerOptionsList, styles, data.customerRejections]);

  // Customer dropdown select options
  const customerSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return allCustomerNames.map((cust) => {
      const existingVal = data.customerRejections?.[cust];
      return {
        value: cust,
        label: `${cust}${existingVal ? ` — (Custom: ${existingVal})` : ""}`,
      };
    });
  }, [allCustomerNames, data.customerRejections]);

  function handleSelectCustomer(cust: string) {
    if (!cust) return;
    setSelectedCustomer(cust);
    const existingRate = data.customerRejections?.[cust];
    setCustomerRateInput(existingRate ? existingRate.replace("%", "").trim() : "");
    setModalOpen(true);
  }

  async function saveProcessTable(process: string, table: MatrixTableData) {
    await onSave({ ...data, tables: { ...data.tables, [process]: table } });
    toast.success(`Rejection grid for ${process} saved.`);
  }

  async function handleSaveCustomerRate() {
    if (!selectedCustomer) {
      toast.error("Please select a customer first.");
      return;
    }
    const cleanRate = customerRateInput.trim();
    if (!cleanRate || isNaN(parseFloat(cleanRate))) {
      toast.error("Please enter a valid numeric rejection percentage (e.g. 4.15).");
      return;
    }

    setIsSavingRate(true);
    try {
      const formattedRate = `${parseFloat(cleanRate).toFixed(2)}%`;
      const updated = {
        ...(data.customerRejections || {}),
        [selectedCustomer]: formattedRate,
      };

      await onSave({
        ...data,
        customerRejections: updated,
      });
      toast.success(`Rejection rate for "${selectedCustomer}" saved as ${formattedRate}.`);
      setModalOpen(false);
    } catch {
      toast.error("Failed to save customer rejection rate");
    } finally {
      setIsSavingRate(false);
    }
  }

  async function handleRemoveCustomerRate(custName: string) {
    setIsSavingRate(true);
    try {
      const updated = { ...(data.customerRejections || {}) };
      delete updated[custName];
      await onSave({
        ...data,
        customerRejections: updated,
      });
      toast.info(`Removed custom rejection rate for ${custName}.`);
      setModalOpen(false);
    } catch {
      toast.error("Failed to remove customer rejection rate");
    } finally {
      setIsSavingRate(false);
    }
  }

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

  const styleSummaries = useMemo(() => {
    return styles.map((style) => {
      const sizeBracket = calculateSizeBracket(style.orderQuantity);
      const styleCategoryClass = mapSMVToCategory(style.smvSewing);

      const custRateStr = data.customerRejections?.[style.customerName];
      const hasCustomerSingleRate = Boolean(custRateStr && parseFloat(custRateStr) > 0);

      const processRejections: Record<string, number> = {};
      let baseRejectionSum = 0;
      for (const p of data.processes) {
        const table = data.tables[p];
        if (table) {
          const cellStr = table.cells[sizeBracket]?.[styleCategoryClass] || "0%";
          const cellVal = parseFloat(cellStr) / 100;
          processRejections[p] = cellVal;
          baseRejectionSum += cellVal;
        } else {
          processRejections[p] = 0;
        }
      }

      const washingRejection = getWashingRejection(style.washType, sizeBracket);
      const totalRejection = hasCustomerSingleRate
        ? parseFloat(custRateStr!) / 100
        : baseRejectionSum + washingRejection;

      return {
        style,
        sizeBracket,
        styleCategoryClass,
        hasCustomerSingleRate,
        custRateStr,
        processRejections,
        baseRejectionSum,
        washingRejection,
        totalRejection,
      };
    });
  }, [styles, data]);

  const existingModalRate = selectedCustomer ? data.customerRejections?.[selectedCustomer] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4 bg-muted/40 p-3.5 rounded-xl border">
        <div className="flex items-center gap-2 overflow-x-auto w-full xl:w-auto">
          <Tabs value={active} onValueChange={(v) => setActive(v as string)} className="w-full">
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
                  className="data-active:bg-emerald-600 data-active:text-white py-1.5 px-3 text-xs font-semibold text-emerald-800 dark:text-emerald-300"
                >
                  Total (Processes Sum)
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-2.5 w-full xl:w-auto justify-start xl:justify-end bg-white dark:bg-slate-900/70 p-2 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
            <Building2 className="size-4 text-primary" />
            <span>Customer Rejection:</span>
          </div>

          <div className="w-64 sm:w-72">
            <SearchableSelect
              options={customerSelectOptions}
              value={selectedCustomer}
              onChange={handleSelectCustomer}
              placeholder="Search or Select Customer Name..."
              className="bg-transparent text-xs h-8 font-semibold"
            />
          </div>
        </div>
      </div>

      {data.customerRejections && Object.keys(data.customerRejections).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 rounded-lg">
          <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1">
            <Sparkles className="size-3.5 text-amber-600" /> Customer Rejection Rates:
          </span>
          {Object.entries(data.customerRejections).map(([cust, rate]) => (
            <Badge
              key={cust}
              variant="outline"
              className="text-xs py-1 px-2.5 bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-semibold flex items-center gap-2 shadow-2xs"
            >
              <button
                type="button"
                className="hover:underline cursor-pointer flex items-center gap-1.5 focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleSelectCustomer(cust);
                }}
                title={`Edit custom rate for ${cust}`}
              >
                <span>{cust}: <strong>{rate}</strong></span>
                <Edit3 className="size-3 text-amber-700 dark:text-amber-400 hover:text-amber-900" />
              </button>
              <button
                type="button"
                className="hover:text-destructive text-muted-foreground hover:bg-red-50 dark:hover:bg-red-950/50 p-0.5 rounded transition-colors cursor-pointer focus:outline-none"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  handleRemoveCustomerRate(cust);
                }}
                title={`Remove custom rate for ${cust}`}
              >
                <X className="size-3.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Building2 className="size-5 text-primary" />
              Customer Rejection Rate: {selectedCustomer}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Set a dedicated single rejection percentage for <strong>{selectedCustomer}</strong>.
              When this customer is selected in the Cost Sheet, this rate will be applied directly.
              If no rate is set, the Cost Sheet calculates rejection dynamically from the Rejection Grid.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Rejection Rate (%)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 4.15"
                  className="h-10 text-base font-bold pr-8 text-right"
                  value={customerRateInput}
                  onChange={(e) => setCustomerRateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveCustomerRate();
                  }}
                  autoFocus
                />
                <span className="absolute right-3 top-2.5 text-sm font-bold text-muted-foreground pointer-events-none">
                  %
                </span>
              </div>
            </div>

            {existingModalRate ? (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                <span>
                  Current active rate: <strong>{existingModalRate}</strong>
                </span>
                <Badge variant="outline" className="border-amber-400 text-amber-800 dark:text-amber-300">
                  Custom Active
                </Badge>
              </div>
            ) : (
              <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg text-xs text-muted-foreground">
                Currently using <strong>Default Rejection Grid</strong> calculations for this customer.
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-row items-center justify-between gap-2 sm:justify-between">
            {existingModalRate ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => handleRemoveCustomerRate(selectedCustomer)}
                disabled={isSavingRate}
              >
                <Trash2 className="size-3.5 mr-1" /> Remove Custom Rate
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setModalOpen(false)}
                disabled={isSavingRate}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="text-xs font-bold"
                onClick={handleSaveCustomerRate}
                disabled={isSavingRate}
              >
                <Check className="size-3.5 mr-1" />
                {isSavingRate ? "Saving..." : "Save Rate"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tabs value={active} onValueChange={(v) => setActive(v as string)}>
        {data.processes.map((p) => (
          <TabsContent key={p} value={p} className="pt-0">
            <MatrixTableEditor
              data={data.tables[p]}
              onSave={(table) => saveProcessTable(p, table)}
              rowLabelHeader="Qty. Band"
            />
          </TabsContent>
        ))}
        {totalTable && (
          <TabsContent value="total-rejections" className="pt-0">
            <div className="space-y-3">
              <div className="rounded-lg border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-semibold text-foreground">Qty. Band</TableHead>
                      {totalTable.columnLabels.map((col) => (
                        <TableHead key={col} className="font-semibold text-foreground">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {totalTable.rowLabels.map((row) => (
                      <TableRow key={row} className="hover:bg-muted/10">
                        <TableCell className="font-semibold text-muted-foreground">{row}</TableCell>
                        {totalTable.columnLabels.map((col) => (
                          <TableCell key={col} className="font-mono text-xs font-bold text-foreground">
                            {totalTable.cells[row]?.[col] || "0.00%"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <p className="text-xs text-muted-foreground italic px-1">
                Note: This table automatically sums Fabric + Cutting + Sewing + Finishing + WIP + E1 tables cell-by-cell.
              </p>
            </div>
          </TabsContent>
        )}
      </Tabs>

      <Card className="border-muted shadow-md overflow-hidden bg-card/60">
        <CardHeader className="bg-muted/30 border-b py-4">
          <CardTitle className="text-sm font-bold flex items-center justify-between">
            <span>Apparel Styles - Dynamic Rejection Summary</span>
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
                  <TableHead className="font-semibold text-xs text-foreground py-2.5">Style ID &amp; Name</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground py-2.5">Customer</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground py-2.5">Category Class</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground py-2.5">Order Qty (Band)</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground py-2.5 text-right">Process Sum</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground py-2.5">Wash Type</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground py-2.5 text-right">Wash Rej.</TableHead>
                  <TableHead className="font-semibold text-xs text-foreground py-2.5 text-right pr-4">Total Rej.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {styleSummaries.map(({ style, sizeBracket, styleCategoryClass, hasCustomerSingleRate, custRateStr, baseRejectionSum, washingRejection, totalRejection }) => (
                  <TableRow key={style.id} className="hover:bg-muted/10">
                    <TableCell className="py-2.5 text-xs">
                      <span className="font-bold text-primary block">{style.id}</span>
                      <span className="text-muted-foreground font-medium text-[11px]">{style.styleName}</span>
                    </TableCell>
                    <TableCell className="py-2.5 text-xs">
                      <span className="font-semibold text-foreground">{style.customerName || "—"}</span>
                      {hasCustomerSingleRate && (
                        <Badge variant="outline" className="ml-1.5 text-[9px] px-1 py-0 border-amber-300 text-amber-700 bg-amber-50 font-bold">
                          Customer Rate: {custRateStr}
                        </Badge>
                      )}
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
      </Card>
    </div>
  );
}
