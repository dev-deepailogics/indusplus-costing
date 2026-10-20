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
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  subscribeToCostSheets,
  deleteCostSheet,
} from "@/lib/cost-sheet/api";
import type { SavedCostSheetItem, ApprovalStep } from "@/lib/cost-sheet/types";
import { useAuth } from "@/lib/auth/auth-provider";
import { runFormulaEngine } from "@/features/cost-sheet/services/CostSheetFormulaEngine";
import type { StyleMasterItem } from "@/features/style-master/types";

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
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | "none">("none");

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

  // Format date helper: returns readable DD-MMM-YYYY
  function formatDisplayDate(dateStr?: string | null) {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }

  // Approval badge helper with department hover breakdown
  function getApprovalBadge(sheet: SavedCostSheetItem) {
    const status = sheet.approvalStatus || (sheet.approvals?.director?.status === "approved" ? "approved" : "draft");
    const approvals = sheet.approvals;

    const deptList: { key: string; label: string; step?: ApprovalStep }[] = [
      { key: "cad", label: "CAD", step: approvals?.cad },
      { key: "fabric", label: "Fabric", step: approvals?.fabric },
      { key: "mmc", label: "MMC (Trims)", step: approvals?.mmc },
      { key: "ie", label: "IE & SAMs", step: approvals?.ie },
      { key: "washing", label: "Washing", step: approvals?.washing },
      { key: "marketing", label: "Marketing", step: approvals?.marketing },
      { key: "costingHead", label: "Costing Head", step: approvals?.costingHead },
      { key: "director", label: "Director", step: approvals?.director },
    ];

    let badgeElement: React.ReactNode;

    if (status === "approved" || approvals?.director?.status === "approved") {
      badgeElement = (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] px-1 py-0.5 gap-0.5 inline-flex items-center whitespace-nowrap cursor-help">
          <CheckCircle2 className="size-2.5" /> Dir Approved
        </Badge>
      );
    } else if (status === "rejected") {
      badgeElement = (
        <Badge variant="destructive" className="font-bold text-[9px] px-1 py-0.5 gap-0.5 inline-flex items-center whitespace-nowrap cursor-help">
          <XCircle className="size-2.5" /> Rejected
        </Badge>
      );
    } else if (approvals?.costingHead?.status === "approved") {
      badgeElement = (
        <Badge className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-[9px] px-1 py-0.5 gap-0.5 inline-flex items-center whitespace-nowrap cursor-help">
          <Clock className="size-2.5" /> Costing Appr
        </Badge>
      );
    } else if (approvals?.marketing?.status === "approved") {
      badgeElement = (
        <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9px] px-1 py-0.5 gap-0.5 inline-flex items-center whitespace-nowrap cursor-help">
          <Clock className="size-2.5" /> Mktg Appr
        </Badge>
      );
    } else {
      const cadApproved = approvals?.cad?.status === "approved";
      const deptApprovedCount = [
        approvals?.fabric?.status === "approved",
        approvals?.mmc?.status === "approved",
        approvals?.ie?.status === "approved",
        approvals?.washing?.status === "approved",
      ].filter(Boolean).length;

      if (deptApprovedCount > 0) {
        badgeElement = (
          <Badge className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[9px] px-1 py-0.5 gap-0.5 inline-flex items-center whitespace-nowrap cursor-help">
            <Clock className="size-2.5" /> {deptApprovedCount}/4 Depts
          </Badge>
        );
      } else if (cadApproved) {
        badgeElement = (
          <Badge className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-[9px] px-1 py-0.5 gap-0.5 inline-flex items-center whitespace-nowrap cursor-help">
            <Clock className="size-2.5" /> CAD Appr
          </Badge>
        );
      } else {
        badgeElement = (
          <Badge variant="outline" className="text-slate-500 dark:text-slate-400 font-medium text-[9px] px-1.5 py-0.5 whitespace-nowrap cursor-help">
            Draft
          </Badge>
        );
      }
    }

    return (
      <Tooltip>
        <TooltipTrigger render={<span className="inline-flex cursor-help">{badgeElement}</span>} />
        <TooltipContent
          side="top"
          align="center"
          className="p-2.5 bg-slate-900/95 text-slate-100 border border-slate-800 shadow-xl rounded-lg max-w-xs z-50 text-left pointer-events-none"
        >
          <div className="space-y-1.5 min-w-[200px]">
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-1 text-[11px] font-bold">
              <span>Department Approvals</span>
              <span className="text-slate-400 text-[10px] font-mono">
                {sheet.costSheetNumber || sheet.id}
              </span>
            </div>
            <div className="space-y-1 pt-0.5">
              {deptList.map((d) => {
                const s = d.step?.status || "pending";
                const isApproved = s === "approved";
                const isRejected = s === "rejected";
                return (
                  <div key={d.key} className="flex items-center justify-between text-[10.5px] py-0.5">
                    <span className="text-slate-300 font-medium">{d.label}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-[10px]">
                      {isApproved ? (
                        <>
                          <CheckCircle2 className="size-3 text-emerald-400" />
                          <span className="text-emerald-300">
                            {d.step?.approvedBy ? `Approved (${d.step.approvedBy})` : "Approved"}
                          </span>
                        </>
                      ) : isRejected ? (
                        <>
                          <XCircle className="size-3 text-red-400" />
                          <span className="text-red-300">
                            {d.step?.approvedBy ? `Rejected (${d.step.approvedBy})` : "Rejected"}
                          </span>
                        </>
                      ) : (
                        <>
                          <Clock className="size-3 text-amber-400/70" />
                          <span className="text-slate-400">Pending</span>
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Excel Export
  function handleExport() {
    const dataToExport = filteredSheets.map((s) => {
      let calcs = s.calculations || {};
      const orderFOB = typeof s.orderFOB === "number" && !isNaN(s.orderFOB) ? s.orderFOB : 0;
      const smv = s.smvSewing ?? 0;
      const rejection =
        s.rejectionPct !== null && s.rejectionPct !== undefined
          ? s.rejectionPct
          : s.rejectionOverride !== null && s.rejectionOverride !== undefined
          ? s.rejectionOverride
          : (calcs.rejectionPct ?? 0);
      const rejectionPctVal = rejection <= 1 && rejection > 0 ? rejection * 100 : rejection;

      // If breakdown fields are missing, recompute them using the formula engine
      if (calcs.fabricCostPKR === undefined && calcs.sellingPricePKR === undefined) {
        try {
          const styleItem: StyleMasterItem = {
            id: s.styleId,
            styleName: s.styleName,
            customerName: s.customerName,
            styleCategory: s.styleCategory,
            orderQuantity: s.orderQuantity,
            smvSewing: s.smvSewing,
            orderType: (s.orderType as "Denim" | "Non Denim") || "Non Denim",
            washType: s.washType,
            sizeBracket: calcs.sizeBracket || "",
            targetEfficiency: calcs.efficiency || 0,
            rejectionPct: rejection,
            baseSellingPrice: orderFOB,
            bomFabric: s.bomFabric || [],
            bomLining: s.bomLining || [],
            bomAccessories: s.bomAccessories || [],
            bomChemicals: s.bomChemicals || [],
            bomSpecialCharges: s.bomSpecialCharges || [],
          };

          const recomputed = runFormulaEngine(
            styleItem,
            {
              orderFOB,
              paritySale: s.paritySale || 278,
              parityProcurement: s.parityProcurement || 278,
              manpower: s.manpower || 60,
              efficiencyOverride: s.efficiencyOverride ?? null,
              rejectionOverride: s.rejectionOverride ?? rejection,
              lineTargetOverride: s.lineTargetOverride ?? null,
              costingStage: s.costingStage || "",
              paymentTerms: s.paymentTerms || "",
              discountRate: s.discountRate || 0,
              paymentTermsDays: s.paymentTermsDays || 0,
              factoringDays: s.factoringDays || 0,
              commissionPct: s.commissionPct || 0,
              foreignBankCharges: s.foreignBankCharges || 0,
              taxEdsPct: s.taxEdsPct || 0,
              inlandFreightPct: s.inlandFreightPct || 0,
              localBankChargesPct: s.localBankChargesPct || 0,
              inhouseOrSubcontract: s.inhouseOrSubcontract || "INHOUSE",
              rebatePct: s.rebatePct ?? 0.015,
            },
            {
              directLabourFoh: s.directLabourFohSnapshot || undefined,
              adminSelling: s.adminSellingSnapshot || undefined,
            }
          );
          calcs = { ...calcs, ...recomputed };
        } catch (err) {
          console.error("Failed to recompute calcs for export row:", s.id, err);
        }
      }

      const targetFob = calcs.targetFobUSD ?? (typeof s.quotedPrice === "number" ? s.quotedPrice : 0);

      // Selling price & Net price
      const sellingPKR = calcs.sellingPricePKR ?? (orderFOB * (s.paritySale || 278));
      const netPKR = calcs.netPricePKR ?? 0;

      // Material Costs
      const fabricPKR = calcs.fabricCostPKR ?? 0;
      const liningPKR = calcs.liningCostPKR ?? 0;
      const accPKR = calcs.accessoriesCostPKR ?? 0;
      const chemPKR = calcs.chemicalsCostPKR ?? 0;
      const specialPKR = calcs.specialChargesCostPKR ?? 0;

      // Conversion & Variable Costs
      const laborPKR = calcs.directLaborCostPKR ?? 0;
      const utilPKR = calcs.utilitiesCostPKR ?? 0;
      const leftoverPKR = calcs.leftoverCostPKR ?? 0;

      // Gross CM / PC
      const cmPKR = calcs.cmPKR ?? (calcs.grossCmPKR ?? 0);

      // Overheads / Total Cost FOH
      const fohPKR = calcs.totalManufacturingFohPKR ?? (calcs.totalCostPKR ?? 0);

      // Gross Profit
      const grossProfitPKR = calcs.grossProfitPKR ?? (cmPKR - fohPKR);

      // Total Admin & Selling
      const adminSellingPKR = calcs.totalAdminSellingPKR ?? 0;

      // Operating Profit
      const opProfitPKR = calcs.operatingProfitPKR ?? (grossProfitPKR - adminSellingPKR);

      // Net Profit / PC
      const netProfitPKR = calcs.netProfitPKR ?? (opProfitPKR - (calcs.depreciationCostPKR ?? 0));

      return {
        // --- 1. Saved Cost Sheet Table Columns ---
        "Cost Sheet #": s.costSheetNumber || s.id,
        "Description": s.referenceName,
        "Date Created": formatDisplayDate(s.savedAt),
        "Created By": s.createdByName || s.createdByEmail || "—",
        "Work Order": s.workOrderNumber || "—",
        "Style ID": s.styleId,
        "Style Name": s.styleName,
        "Customer": s.customerName,
        "Order Qty": s.orderQuantity,
        "Order FOB ($)": Number(orderFOB.toFixed(2)),

        // --- 2. Cost Sheet Header Highlighted Fields ---
        "Wash Type": s.washType || "—",
        "Rejection %": Number(rejectionPctVal.toFixed(2)),
        "SMV": Number(smv.toFixed(2)),
        "Target FOB/PC ($)": Number(targetFob.toFixed(2)),

        // --- 3. Cost & Profitability Summary Highlighted Fields (PKR) ---
        "Selling Price (FOB)": Number(sellingPKR.toFixed(0)),
        "Net Selling Price": Number(netPKR.toFixed(0)),
        "Fabric Cost": Number(fabricPKR.toFixed(0)),
        "Lining Cost": Number(liningPKR.toFixed(0)),
        "Accessories Cost": Number(accPKR.toFixed(0)),
        "Chemical & Washing Cost": Number(chemPKR.toFixed(0)),
        "Special Charges Cost": Number(specialPKR.toFixed(0)),
        "Direct Labor Cost (CPM-linked)": Number(laborPKR.toFixed(0)),
        "Utilities Cost (CPM-linked)": Number(utilPKR.toFixed(0)),
        "Leftover Factor Cost": Number(leftoverPKR.toFixed(0)),
        "Gross CM / PC": Number(cmPKR.toFixed(0)),
        "Total Cost FOH": Number(fohPKR.toFixed(0)),
        "Gross Profit (CM/Pc - Total Manufacturing FOH)": Number(grossProfitPKR.toFixed(0)),
        "Total Admin & Selling": Number(adminSellingPKR.toFixed(0)),
        "Operating Profit": Number(opProfitPKR.toFixed(0)),
        "Net Profit / PC": Number(netProfitPKR.toFixed(0)),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cost Sheets History");
    XLSX.writeFile(workbook, "Saved_Cost_Sheets_History.xlsx");
    toast.success("Cost sheets history exported to Excel");
  }

  // Filter & Search Logic (Server already handles team & customer scope)
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const filteredSheets = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searched = q
      ? costSheets.filter((s) => {
          return (
            s.referenceName?.toLowerCase().includes(q) ||
            s.workOrderNumber?.toLowerCase().includes(q) ||
            s.styleId?.toLowerCase().includes(q) ||
            s.styleName?.toLowerCase().includes(q) ||
            s.costSheetNumber?.toLowerCase().includes(q) ||
            s.customerName?.toLowerCase().includes(q) ||
            s.createdByName?.toLowerCase().includes(q) ||
            s.createdByEmail?.toLowerCase().includes(q) ||
            s.costingStage?.toLowerCase().includes(q)
          );
        })
      : costSheets;

    if (sortOrder === "none") return searched;

    return [...searched].sort((a, b) => {
      const aVal = (a.costSheetNumber || a.id || "").trim();
      const bVal = (b.costSheetNumber || b.id || "").trim();
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true, sensitivity: "base" });
      return sortOrder === "asc" ? cmp : -cmp;
    });
  }, [costSheets, search, sortOrder]);

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
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by Cost Sheet #, Work Order, Style, Customer, Scenario..."
                className="pl-9 h-9 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-xs font-medium text-muted-foreground mr-1">
                Cost Sheet #:
              </span>
              <div className="inline-flex rounded-md border border-input bg-background p-0.5 shadow-xs">
                <Button
                  type="button"
                  variant={sortOrder === "asc" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === "asc" ? "none" : "asc")}
                  className={`h-7 px-2.5 text-xs gap-1 font-medium ${
                    sortOrder === "asc"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Sort Cost Sheet # Ascending (A-Z / 1-9)"
                >
                  <ArrowUp className="size-3.5" />
                  <span>Ascending</span>
                </Button>
                <Button
                  type="button"
                  variant={sortOrder === "desc" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === "desc" ? "none" : "desc")}
                  className={`h-7 px-2.5 text-xs gap-1 font-medium ${
                    sortOrder === "desc"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title="Sort Cost Sheet # Descending (Z-A / 9-1)"
                >
                  <ArrowDown className="size-3.5" />
                  <span>Descending</span>
                </Button>
                {sortOrder !== "none" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSortOrder("none")}
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground font-normal"
                    title="Clear Cost Sheet # sorting"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* cost sheets records table */}
      <Card className="shadow-md border-muted/60 overflow-hidden">
        <CardContent className="p-0 overflow-hidden">
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
            <Table className="w-full text-xs table-fixed" containerClassName="overflow-x-hidden">
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead
                    className="w-[9%] font-semibold text-foreground py-2 pl-2 pr-1 text-[11px] cursor-pointer select-none hover:bg-muted/70 transition-colors"
                    onClick={() => {
                      setSortOrder((prev) =>
                        prev === "asc" ? "desc" : prev === "desc" ? "none" : "asc"
                      );
                    }}
                    title={`Click to sort Cost Sheet # (${
                      sortOrder === "asc"
                        ? "Ascending active — click for Descending"
                        : sortOrder === "desc"
                        ? "Descending active — click to Reset"
                        : "Click to sort Ascending"
                    })`}
                  >
                    <div className="inline-flex items-center gap-1.5">
                      <span className={sortOrder !== "none" ? "text-primary font-bold" : "text-foreground"}>
                        Cost Sheet #
                      </span>
                      {sortOrder === "asc" ? (
                        <ArrowUp className="size-3.5 text-primary stroke-[2.5] shrink-0" />
                      ) : sortOrder === "desc" ? (
                        <ArrowDown className="size-3.5 text-primary stroke-[2.5] shrink-0" />
                      ) : (
                        <ArrowUpDown className="size-3.5 text-slate-500 hover:text-foreground shrink-0" />
                      )}
                    </div>
                  </TableHead>
                  <TableHead className="w-[10.5%] font-semibold text-foreground py-2 px-1 text-[11px] truncate">
                    Description
                  </TableHead>
                  <TableHead className="w-[7%] font-semibold text-foreground py-2 px-1 text-[11px] whitespace-nowrap">
                    Date Created
                  </TableHead>
                  <TableHead className="w-[7.5%] font-semibold text-foreground py-2 px-1 text-[11px] truncate">
                    Created By
                  </TableHead>
                  <TableHead className="w-[7%] font-semibold text-foreground py-2 px-1 text-[11px] truncate">
                    Work Order
                  </TableHead>
                  <TableHead className="w-[10%] font-semibold text-foreground py-2 px-1 text-[11px] truncate">
                    Style ID & Name
                  </TableHead>
                  <TableHead className="w-[8%] font-semibold text-foreground py-2 px-1 text-[11px] truncate">
                    Customer
                  </TableHead>
                  <TableHead className="w-[6%] font-semibold text-foreground py-2 px-1 text-right text-[11px] whitespace-nowrap">
                    Order Qty
                  </TableHead>
                  <TableHead className="w-[6%] font-semibold text-foreground py-2 px-1 text-right text-[11px] whitespace-nowrap">
                    Order FOB
                  </TableHead>
                  <TableHead className="w-[4%] font-semibold text-foreground py-2 px-1 text-center text-[11px] whitespace-nowrap">
                    Stage
                  </TableHead>
                  <TableHead className="w-[9%] font-semibold text-foreground py-2 px-1 text-center text-[11px] whitespace-nowrap">
                    Approval
                  </TableHead>
                  {/* <TableHead className="w-[6.5%] font-semibold text-foreground py-2 px-1 text-right text-[11px] whitespace-nowrap">
                    EBITDA/m
                  </TableHead> */}
                  <TableHead className="w-[6%] font-semibold text-foreground py-2 px-1 text-right text-[11px] whitespace-nowrap">
                    Profit/Pc
                  </TableHead>
                  <TableHead className="w-[5.5%] font-semibold text-foreground py-2 px-1 text-right text-[11px] whitespace-nowrap">
                    Profit %
                  </TableHead>
                  <TableHead className="w-[8%] font-semibold text-foreground py-2 pr-2 pl-1 text-right text-[11px] whitespace-nowrap">
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

                  const creatorDisplay = sheet.createdByName || (sheet.createdByEmail ? sheet.createdByEmail.split("@")[0] : "—");

                  return (
                    <TableRow
                      key={sheet.id}
                      className="hover:bg-muted/20 cursor-pointer"
                      onClick={() =>
                        router.push(`/cost-sheet?costSheetId=${sheet.id}&mode=view`)
                      }
                    >
                      <TableCell className="font-mono text-[10.5px] font-semibold text-primary py-2 pl-2 pr-1 truncate" title={sheet.costSheetNumber || sheet.id}>
                        {sheet.costSheetNumber || sheet.id}
                      </TableCell>
                      <TableCell className="font-semibold text-foreground text-[11px] py-2 px-1 truncate" title={sheet.referenceName}>
                        {sheet.referenceName}
                      </TableCell>
                      <TableCell className="text-[10px] text-muted-foreground py-2 px-1 whitespace-nowrap" title={sheet.savedAt}>
                        {formatDisplayDate(sheet.savedAt)}
                      </TableCell>
                      <TableCell className="text-[10.5px] py-2 px-1 truncate" title={sheet.createdByName || sheet.createdByEmail || "—"}>
                        <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                          {creatorDisplay}
                        </span>
                      </TableCell>
                      <TableCell className="text-[10px] py-2 px-1 font-mono truncate" title={sheet.workOrderNumber || "—"}>
                        {sheet.workOrderNumber ? (
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-[10px] bg-slate-100 dark:bg-slate-800/80 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700/60 inline-block truncate max-w-full">
                            {sheet.workOrderNumber}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[10.5px] py-2 px-1 leading-tight overflow-hidden">
                        <span className="font-semibold text-primary block text-[10.5px] truncate" title={sheet.styleId}>
                          {sheet.styleId}
                        </span>
                        <span className="text-muted-foreground text-[9.5px] block truncate" title={sheet.styleName}>
                          {sheet.styleName}
                        </span>
                      </TableCell>
                      <TableCell className="text-[10.5px] font-medium py-2 px-1 truncate" title={sheet.customerName}>
                        {sheet.customerName}
                      </TableCell>
                      <TableCell className="text-[10.5px] font-semibold text-muted-foreground text-right py-2 px-1 whitespace-nowrap">
                        {orderQuantity.toLocaleString()} pcs
                      </TableCell>
                      <TableCell className="text-[10.5px] font-bold text-foreground text-right py-2 px-1 whitespace-nowrap">
                        ${orderFOB.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center py-2 px-1">
                        <Badge
                          variant={
                            sheet.costingStage === "Final"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-[8.5px] px-1 py-0 font-bold whitespace-nowrap"
                        >
                          {sheet.costingStage || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center py-2 px-1 overflow-hidden">
                        {getApprovalBadge(sheet)}
                      </TableCell>
                      {/* <TableCell className="text-right text-[10.5px] font-semibold py-2 px-1 whitespace-nowrap">
                        {formattedEbitda}
                      </TableCell> */}
                      <TableCell
                        className={`text-right text-[10.5px] font-bold py-2 px-1 whitespace-nowrap ${isProfitPositive ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                      >
                        {formattedProfitUSD}
                      </TableCell>
                      <TableCell
                        className={`text-right text-[10.5px] font-extrabold py-2 px-1 whitespace-nowrap ${isProfitPositive ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
                      >
                        {profitPct.toFixed(2)}%
                      </TableCell>
                      <TableCell
                        className="text-right py-2 pr-2 pl-1 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-6 text-sky-600 border-sky-200 bg-sky-50/50 hover:bg-sky-50 hover:text-sky-700 shrink-0"
                            onClick={() =>
                              router.push(`/cost-sheet?costSheetId=${sheet.id}&mode=view`)
                            }
                            title="View Cost Sheet (Read-Only)"
                          >
                            <Eye className="size-3" />
                          </Button>
                          {!isAnyHeadApproved && canEdit && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-6 text-emerald-600 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 hover:text-emerald-700 shrink-0"
                              onClick={() =>
                                router.push(`/cost-sheet?costSheetId=${sheet.id}&mode=edit`)
                              }
                              title="Edit Cost Sheet"
                            >
                              <Pencil className="size-3" />
                            </Button>
                          )}
                          {!isAnyHeadApproved && canDelete && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-6 text-destructive border-destructive/20 hover:bg-destructive/5 shrink-0"
                              onClick={(e) => handleDelete(sheet.id, e)}
                              title="Delete"
                            >
                              <Trash2 className="size-3" />
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
