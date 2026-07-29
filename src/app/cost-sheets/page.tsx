"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Search,
  FileDown,
  Trash2,
  ArrowRight,
  Calendar,
  User,
  ShoppingBag,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

import {
  subscribeToCostSheets,
  deleteCostSheet,
} from "@/lib/cost-sheet/firestore";
import type { SavedCostSheetItem } from "@/lib/cost-sheet/types";

export default function SavedCostSheetsPage() {
  const router = useRouter();
  const [costSheets, setCostSheets] = useState<SavedCostSheetItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter States
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
      });
    };
    const closeMenu = () => setContextMenu(null);

    window.addEventListener("contextmenu", handleGlobalContextMenu);
    window.addEventListener("click", closeMenu);
    
    return () => {
      window.removeEventListener("contextmenu", handleGlobalContextMenu);
      window.removeEventListener("click", closeMenu);
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeToCostSheets((data) => {
      setCostSheets(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Delete cost sheet
  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (
      confirm(
        "Are you sure you want to permanently delete this costing snapshot?",
      )
    ) {
      try {
        await deleteCostSheet(id);
        toast.success("Costing snapshot deleted");
      } catch (err) {
        toast.error("Failed to delete cost sheet");
      }
    }
  }

  // Excel Export
  function handleExport() {
    const dataToExport = filteredSheets.map((s) => ({
      "Cost Sheet ID": s.id,
      "Scenario Reference": s.referenceName,
      "Style ID": s.styleId,
      "Style Name": s.styleName,
      Customer: s.customerName,
      Category: s.styleCategory,
      "Quantity (Pcs)": s.orderQuantity,
      "Costing Date": s.costingDate,
      "Costing Stage": s.costingStage,
      Country: s.country,
      "Payment Terms": s.paymentTerms,
      "Order FOB ($)": s.orderFOB,
      "EBITDA / Min (Cents)": s.calculations.ebitdaMinCents,
      "Net Profit / Pc ($)": s.calculations.netProfitUSD,
      "Net Profit %": s.calculations.netProfitPct * 100,
      "Saved At": s.savedAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cost Sheets Snapshots");
    XLSX.writeFile(workbook, "Saved_PreOrder_CostSheets.xlsx");
    toast.success("Costing grid exported to Excel");
  }

  // Derive filter list values
  const uniqueCustomers = Array.from(
    new Set(costSheets.map((c) => c.customerName)),
  );

  // Filter & Search Logic
  const filteredSheets = costSheets.filter((s) => {
    const matchesSearch =
      s.referenceName.toLowerCase().includes(search.toLowerCase()) ||
      s.styleId.toLowerCase().includes(search.toLowerCase()) ||
      s.styleName.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase());

    const matchesCustomer =
      customerFilter === "all" || s.customerName === customerFilter;
    const matchesStage =
      stageFilter === "all" || s.costingStage === stageFilter;

    return matchesSearch && matchesCustomer && matchesStage;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Saved Cost Sheets
          </h1>
          <p className="text-sm text-muted-foreground">
            Directory of saved pre-order costing runs, run calculations, and
            custom scenario snapshots.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-9"
            disabled={filteredSheets.length === 0}
          >
            <FileDown className="mr-1.5 size-4" /> Export History
          </Button>
          <Button
            onClick={() => router.push("/cost-sheet")}
            className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5"
          >
            New Cost Sheet Calculator
          </Button>
        </div>
      </div>

      {/* Filter Control Header */}
      <Card className="bg-card/50 backdrop-blur-sm border-muted/60">
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by ID, Style ID, Name, or Scenario..."
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2 sm:w-auto">
            <select
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none"
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
            >
              <option value="all">All Customers</option>
              {uniqueCustomers.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="all">All Stages</option>
              <option value="Quote">Quote</option>
              <option value="Final">Final</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* cost sheets records table */}
      <Card className="shadow-md border-muted/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground font-medium">
              Loading saved runs...
            </div>
          ) : filteredSheets.length === 0 ? (
            <div className="p-10 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <ShoppingBag className="size-8 text-muted-foreground/60" />
              <span>
                No costing snapshots found. Go to the Calculator to save a run.
              </span>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold text-foreground w-40">
                    Cost Sheet ID
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Scenario Name
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Style ID & Name
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Customer
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Order Qty
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Order FOB
                  </TableHead>
                  <TableHead className="font-semibold text-foreground">
                    Stage
                  </TableHead>
                  <TableHead className="font-semibold text-foreground text-right">
                    EBITDA / Min
                  </TableHead>
                  <TableHead className="font-semibold text-foreground text-right">
                    Net Profit/Pc
                  </TableHead>
                  <TableHead className="font-semibold text-foreground text-right">
                    Net Profit %
                  </TableHead>
                  <TableHead className="font-semibold text-foreground text-right w-24">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSheets.map((sheet) => {
                  const profitPct = sheet.calculations.netProfitPct * 100;
                  const isProfitPositive = profitPct >= 0;
                  return (
                    <TableRow
                      key={sheet.id}
                      className="hover:bg-muted/20 cursor-pointer"
                      onClick={() =>
                        router.push(`/cost-sheet?costSheetId=${sheet.id}`)
                      }
                    >
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {sheet.id}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground text-xs">
                        {sheet.referenceName}
                      </TableCell>
                      <TableCell className="text-xs">
                        <span className="font-semibold text-primary block">
                          {sheet.styleId}
                        </span>
                        <span className="text-muted-foreground">
                          {sheet.styleName}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {sheet.customerName}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground">
                        {sheet.orderQuantity.toLocaleString()} pcs
                      </TableCell>
                      <TableCell className="text-xs font-bold text-foreground">
                        ${sheet.orderFOB.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            sheet.costingStage === "Final"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-[10px] font-bold"
                        >
                          {sheet.costingStage}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold">
                        {sheet.calculations.ebitdaMinCents.toFixed(2)}¢
                      </TableCell>
                      <TableCell
                        className={`text-right text-xs font-bold ${isProfitPositive ? "text-emerald-700" : "text-red-600"}`}
                      >
                        ${sheet.calculations.netProfitUSD.toFixed(2)}
                      </TableCell>
                      <TableCell
                        className={`text-right text-xs font-extrabold ${isProfitPositive ? "text-emerald-700" : "text-red-600"}`}
                      >
                        {profitPct.toFixed(2)}%
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7 text-blue-600 border-blue-200 bg-blue-50/50 hover:bg-blue-50"
                            onClick={() =>
                              router.push(`/cost-sheet?costSheetId=${sheet.id}`)
                            }
                            title="Load in Calculator"
                          >
                            <ArrowRight className="size-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7 text-destructive border-destructive/20 hover:bg-destructive/5"
                            onClick={(e) => handleDelete(sheet.id, e)}
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
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
      {contextMenu && (
        <div
          className="fixed bg-popover text-popover-foreground border border-slate-200 dark:border-slate-800 rounded-lg shadow-md py-1 z-50 min-w-44 text-xs font-semibold"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            onClick={() => router.push("/cost-sheet")}
            className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground flex items-center gap-2 transition-colors duration-100"
          >
            <span>➕ New Cost Sheet</span>
          </button>
        </div>
      )}
    </div>
  );
}
