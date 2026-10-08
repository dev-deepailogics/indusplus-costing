"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  Search,
  FileDown,
  Trash2,
  ArrowRight,
  Eye,
  Pencil,
  Calendar,
  User,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Clock,
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
} from "@/lib/cost-sheet/api";
import type { SavedCostSheetItem } from "@/lib/cost-sheet/types";
import { useAuth } from "@/lib/auth/auth-provider";

export default function SavedCostSheetsPage() {
  const router = useRouter();
  const { user, can } = useAuth();
  const [costSheets, setCostSheets] = useState<SavedCostSheetItem[]>([]);
  const [loading, setLoading] = useState(true);

  const canCreate = can("page_cost_sheets", "create");
  const canEdit = can("page_cost_sheets", "edit");
  const canDelete = can("page_cost_sheets", "delete");

  // Filter State
  const [search, setSearch] = useState("");

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);

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
    const unsub = subscribeToCostSheets(
      (data) => {
        setCostSheets(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error subscribing to cost sheets:", err);
        setLoading(false);
      }
    );
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
      const prevSheets = [...costSheets];
      setCostSheets((prev) => prev.filter((item) => item.id !== id));
      try {
        await deleteCostSheet(id);
        toast.success("Costing snapshot deleted");
      } catch (err) {
        setCostSheets(prevSheets);
        toast.error("Failed to delete cost sheet");
      }
    }
  }

  // Approval badge helper
  function getApprovalBadge(sheet: SavedCostSheetItem) {
    const status = sheet.approvalStatus || (sheet.approvals?.director?.status === "approved" ? "approved" : "draft");
    const approvals = sheet.approvals;

    if (status === "approved" || approvals?.director?.status === "approved") {
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-2 py-0.5 gap-1 inline-flex items-center">
          <CheckCircle2 className="size-3" /> Director Approved
        </Badge>
      );
    }
    if (status === "rejected") {
      return (
        <Badge variant="destructive" className="font-bold text-[10px] px-2 py-0.5 gap-1 inline-flex items-center">
          <XCircle className="size-3" /> Rejected
        </Badge>
      );
    }
    if (approvals?.costingHead?.status === "approved") {
      return (
        <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] px-2 py-0.5 gap-1 inline-flex items-center">
          <Clock className="size-3" /> Costing Approved
        </Badge>
      );
    }
    if (approvals?.marketing?.status === "approved") {
      return (
        <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] px-2 py-0.5 gap-1 inline-flex items-center">
          <Clock className="size-3" /> Marketing Approved
        </Badge>
      );
    }

    const cadApproved = approvals?.cad?.status === "approved";
    const deptApprovedCount = [
      approvals?.fabric?.status === "approved",
      approvals?.mmc?.status === "approved",
      approvals?.ie?.status === "approved",
      approvals?.washing?.status === "approved",
    ].filter(Boolean).length;

    if (deptApprovedCount > 0) {
      return (
        <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] px-2 py-0.5 gap-1 inline-flex items-center">
          <Clock className="size-3" /> {deptApprovedCount}/4 Depts
        </Badge>
      );
    }

    if (cadApproved) {
      return (
        <Badge className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[10px] px-2 py-0.5 gap-1 inline-flex items-center">
          <Clock className="size-3" /> CAD Approved
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="text-slate-500 dark:text-slate-400 font-medium text-[10px] px-2 py-0.5">
        Draft
      </Badge>
    );
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
      "Approval Status":
        s.approvals?.director?.status === "approved"
          ? "Director Approved"
          : s.approvalStatus || "Draft",
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

  // Filter & Search Logic (Server already handles team & customer scope)
  const filteredSheets = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return costSheets;
    return costSheets.filter((s) => {
      return (
        s.referenceName?.toLowerCase().includes(q) ||
        s.styleId?.toLowerCase().includes(q) ||
        s.styleName?.toLowerCase().includes(q) ||
        s.id?.toLowerCase().includes(q) ||
        s.customerName?.toLowerCase().includes(q) ||
        s.costingStage?.toLowerCase().includes(q) ||
        s.workOrderNumber?.toLowerCase().includes(q)
      );
    });
  }, [costSheets, search]);

  return (
    <div className="space-y-6 w-full">
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
          {canCreate && (
            <Button
              onClick={() => router.push("/cost-sheet")}
              className="h-9 bg-blue-600 hover:bg-blue-700 text-white font-semibold flex items-center gap-1.5"
            >
              New Cost Sheet
            </Button>
          )}
        </div>
      </div>

      {/* Filter Control Header */}
      <Card className="bg-card/50 backdrop-blur-sm border-muted/60">
        <CardContent className="p-4">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by ID, Style ID, Name, or Scenario..."
              className="pl-9 h-9 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* cost sheets records table */}
      <Card className="shadow-md border-muted/60">
        <CardContent className="p-0 overflow-x-auto">
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
            <Table className="w-full text-xs">
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold text-foreground py-2.5 pl-3">
                    Cost Sheet ID
                  </TableHead>
                  <TableHead className="font-semibold text-foreground py-2.5 px-2">
                    Scenario Name
                  </TableHead>
                  <TableHead className="font-semibold text-foreground py-2.5 px-2">
                    Style ID & Name
                  </TableHead>
                  <TableHead className="font-semibold text-foreground py-2.5 px-2">
                    Customer
                  </TableHead>
                  <TableHead className="font-semibold text-foreground py-2.5 px-2 text-right">
                    Order Qty
                  </TableHead>
                  <TableHead className="font-semibold text-foreground py-2.5 px-2 text-right">
                    Order FOB
                  </TableHead>
                  <TableHead className="font-semibold text-foreground py-2.5 px-1.5 text-center">
                    Stage
                  </TableHead>
                  <TableHead className="font-semibold text-foreground py-2.5 px-2 text-center">
                    Approval
                  </TableHead>
                  <TableHead className="font-semibold text-foreground py-2.5 px-2 text-right">
                    EBITDA / Min
                  </TableHead>
                  <TableHead className="font-semibold text-foreground py-2.5 px-2 text-right">
                    Net Profit/Pc
                  </TableHead>
                  <TableHead className="font-semibold text-foreground py-2.5 px-2 text-right">
                    Net Profit %
                  </TableHead>
                  <TableHead className="font-semibold text-foreground py-2.5 pr-3 text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSheets.map((sheet) => {
                  const calcs = sheet.calculations || {};
                  const ebitdaMinCents = typeof calcs.ebitdaMinCents === "number" && !isNaN(calcs.ebitdaMinCents) ? calcs.ebitdaMinCents : 0;
                  const netProfitUSD = typeof calcs.netProfitUSD === "number" && !isNaN(calcs.netProfitUSD) ? calcs.netProfitUSD : 0;
                  const netProfitPct = typeof calcs.netProfitPct === "number" && !isNaN(calcs.netProfitPct) ? calcs.netProfitPct : 0;
                  const profitPct = netProfitPct * 100;
                  const isProfitPositive = profitPct >= 0;
                  const orderFOB = typeof sheet.orderFOB === "number" && !isNaN(sheet.orderFOB) ? sheet.orderFOB : 0;
                  const orderQuantity = typeof sheet.orderQuantity === "number" && !isNaN(sheet.orderQuantity) ? sheet.orderQuantity : 0;

                  const formattedProfitUSD = netProfitUSD >= 0
                    ? `$${netProfitUSD.toFixed(2)}`
                    : `-$${Math.abs(netProfitUSD).toFixed(2)}`;

                  const formattedEbitda = ebitdaMinCents >= 0
                    ? `${ebitdaMinCents.toFixed(2)}$`
                    : `-${Math.abs(ebitdaMinCents).toFixed(2)}$`;

                  const isAnyHeadApproved = Boolean(
                    sheet.approvals?.fabric?.status === "approved" ||
                    sheet.approvals?.mmc?.status === "approved" ||
                    sheet.approvals?.ie?.status === "approved" ||
                    sheet.approvals?.washing?.status === "approved" ||
                    sheet.approvals?.marketing?.status === "approved" ||
                    sheet.approvals?.costingHead?.status === "approved" ||
                    sheet.approvals?.director?.status === "approved" ||
                    (sheet.approvalStatus && sheet.approvalStatus !== "draft" && sheet.approvalStatus !== "rejected")
                  );

                  return (
                    <TableRow
                      key={sheet.id}
                      className="hover:bg-muted/20 cursor-pointer"
                      onClick={() =>
                        router.push(`/cost-sheet?costSheetId=${sheet.id}&mode=view`)
                      }
                    >
                      <TableCell className="font-mono text-[11px] font-semibold text-primary py-2.5 pl-3">
                        {sheet.id}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground text-xs py-2.5 px-2">
                        {sheet.referenceName}
                      </TableCell>
                      <TableCell className="text-xs py-2.5 px-2">
                        <span className="font-semibold text-primary block text-[11px]">
                          {sheet.styleId}
                        </span>
                        <span className="text-muted-foreground text-[10px] block truncate max-w-[150px]" title={sheet.styleName}>
                          {sheet.styleName}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-medium py-2.5 px-2">
                        {sheet.customerName}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-muted-foreground text-right py-2.5 px-2">
                        {orderQuantity.toLocaleString()} pcs
                      </TableCell>
                      <TableCell className="text-xs font-bold text-foreground text-right py-2.5 px-2">
                        ${orderFOB.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center py-2.5 px-1.5">
                        <Badge
                          variant={
                            sheet.costingStage === "Final"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-[9px] px-1.5 py-0 font-bold"
                        >
                          {sheet.costingStage}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center py-2.5 px-2">
                        {getApprovalBadge(sheet)}
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold py-2.5 px-2">
                        {formattedEbitda}
                      </TableCell>
                      <TableCell
                        className={`text-right text-xs font-bold py-2.5 px-2 ${isProfitPositive ? "text-emerald-700" : "text-red-600"}`}
                      >
                        {formattedProfitUSD}
                      </TableCell>
                      <TableCell
                        className={`text-right text-xs font-extrabold py-2.5 px-2 ${isProfitPositive ? "text-emerald-700" : "text-red-600"}`}
                      >
                        {profitPct.toFixed(2)}%
                      </TableCell>
                      <TableCell
                        className="text-right py-2.5 pr-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7 text-sky-600 border-sky-200 bg-sky-50/50 hover:bg-sky-50 hover:text-sky-700"
                            onClick={() =>
                              router.push(`/cost-sheet?costSheetId=${sheet.id}&mode=view`)
                            }
                            title="View Cost Sheet (Read-Only)"
                          >
                            <Eye className="size-3.5" />
                          </Button>
                          {!isAnyHeadApproved && canEdit && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-7 text-emerald-600 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:text-emerald-700"
                              onClick={() =>
                                router.push(`/cost-sheet?costSheetId=${sheet.id}&mode=edit`)
                              }
                              title="Edit Cost Sheet"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                          )}
                          {!isAnyHeadApproved && canDelete && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-7 text-destructive border-destructive/20 hover:bg-destructive/5"
                              onClick={(e) => handleDelete(sheet.id, e)}
                              title="Delete"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          )}
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
      {contextMenu && canCreate && (
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
