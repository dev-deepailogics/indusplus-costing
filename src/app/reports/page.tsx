"use client";

import { useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  FileSpreadsheet,
  Search,
  Filter,
  Download,
  Eye,
  RefreshCw,
  TrendingUp,
  Package,
  Scissors,
  Layers,
  Building,
  UserCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  X,
  ExternalLink,
  UsersRound,
  FileCheck,
  DollarSign,
  Boxes,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { BOMUsageItem } from "@/app/api/reports/bom/route";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ── Interfaces for Costing DB Reports ─────────────────────────────────
interface WorkOrderCostingRow {
  id: string;
  workOrderNo: string;
  referenceName: string;
  costSheetNumber: string;
  styleCode: string;
  styleName: string;
  customer: string;
  orderQuantity: number;
  orderFob: number;
  targetFob: number;
  quotedPrice: number;
  totalOrderValueUSD: number;
  cmUSD: number;
  netProfitUSD: number;
  netProfitPct: number;
  smvSewing: number;
  styleCategory: string;
  approvalStatus: string;
  costingDate: string | null;
  createdByName: string;
}

interface StyleCostingRow {
  styleCode: string;
  styleName: string;
  customer: string;
  category: string;
  costSheetsCount: number;
  approvedSheetsCount: number;
  totalUnitsCosted: number;
  totalValueUSD: number;
  avgFob: number;
  avgSmv: number;
  avgCmUSD: number;
  avgProfitPct: number;
  latestCostingDate: string;
}

interface CustomerCostingRow {
  customer: string;
  costSheetsCount: number;
  approvedCount: number;
  inReviewCount: number;
  draftCount: number;
  totalUnitsCosted: number;
  totalValueUSD: number;
  avgFob: number;
  avgProfitMarginPct: number;
  latestDate: string;
}

interface EmployeeCostingRow {
  id: number;
  name: string;
  email: string;
  role: string;
  assignedCustomer: string;
  teams: string[];
  isActive: boolean;
  totalSheetsCreated: number;
  approvedSheets: number;
  inReviewSheets: number;
  draftSheets: number;
  totalUnitsCosted: number;
  totalValueUSD: number;
  avgFob: number;
}

export default function ReportsHubPage() {
  const [activeTab, setActiveTab] = useState<"work-orders" | "styles" | "customers" | "employees" | "bom">("work-orders");

  // Search & Filters
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedBomType, setSelectedBomType] = useState("");

  // Loading States
  const [loading, setLoading] = useState(false);

  // Work Orders Data
  const [workOrdersData, setWorkOrdersData] = useState<{
    summary: { totalWorkOrders: number; totalUnits: number; totalOrderValueUSD: number; avgFob: number; approvedCount: number };
    rows: WorkOrderCostingRow[];
  }>({
    summary: { totalWorkOrders: 0, totalUnits: 0, totalOrderValueUSD: 0, avgFob: 0, approvedCount: 0 },
    rows: [],
  });

  // Styles Data
  const [stylesData, setStylesData] = useState<{
    summary: { totalStyles: number; totalCostSheets: number; totalUnitsCosted: number; totalCostedValueUSD: number };
    rows: StyleCostingRow[];
  }>({
    summary: { totalStyles: 0, totalCostSheets: 0, totalUnitsCosted: 0, totalCostedValueUSD: 0 },
    rows: [],
  });

  // Customers Data
  const [customersData, setCustomersData] = useState<{
    summary: { totalCustomers: number; totalCostSheets: number; totalUnitsCosted: number; totalCommercialValueUSD: number };
    rows: CustomerCostingRow[];
  }>({
    summary: { totalCustomers: 0, totalCostSheets: 0, totalUnitsCosted: 0, totalCommercialValueUSD: 0 },
    rows: [],
  });

  // Employees Data
  const [employeesData, setEmployeesData] = useState<{
    summary: { totalEmployees: number; totalSheetsCosted: number; totalUnitsCosted: number; totalCommercialValueUSD: number };
    employees: EmployeeCostingRow[];
    teams: any[];
  }>({
    summary: { totalEmployees: 0, totalSheetsCosted: 0, totalUnitsCosted: 0, totalCommercialValueUSD: 0 },
    employees: [],
    teams: [],
  });

  // BOM Usage Data
  const [bomData, setBomData] = useState<{
    summary: {
      totalBOMRows: number;
      fabricCount: number;
      liningCount: number;
      trimsCount: number;
      chemicalsCount: number;
      specialCount: number;
      totalMaterialsUSD: number;
      totalMaterialsPKR: number;
    };
    rows: BOMUsageItem[];
  }>({
    summary: {
      totalBOMRows: 0,
      fabricCount: 0,
      liningCount: 0,
      trimsCount: 0,
      chemicalsCount: 0,
      specialCount: 0,
      totalMaterialsUSD: 0,
      totalMaterialsPKR: 0,
    },
    rows: [],
  });

  // Drilldown Dialog State
  const [drilldownType, setDrilldownType] = useState<"wo" | "style" | "cust" | "emp" | null>(null);
  const [drilldownTitle, setDrilldownTitle] = useState("");
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [drilldownData, setDrilldownData] = useState<any>(null);

  // Fetch data on tab change or filter update
  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === "work-orders") {
        const queryParams = new URLSearchParams();
        if (search) queryParams.set("search", search);
        if (selectedCustomer) queryParams.set("customer", selectedCustomer);
        if (selectedStatus) queryParams.set("status", selectedStatus);
        const res = await fetch(`/api/reports/work-orders?${queryParams.toString()}`);
        const data = await res.json();
        if (res.ok) setWorkOrdersData(data);
      } else if (activeTab === "styles") {
        const queryParams = new URLSearchParams();
        if (search) queryParams.set("search", search);
        if (selectedCustomer) queryParams.set("customer", selectedCustomer);
        const res = await fetch(`/api/reports/styles?${queryParams.toString()}`);
        const data = await res.json();
        if (res.ok) setStylesData(data);
      } else if (activeTab === "customers") {
        const queryParams = new URLSearchParams();
        if (search) queryParams.set("search", search);
        const res = await fetch(`/api/reports/customers?${queryParams.toString()}`);
        const data = await res.json();
        if (res.ok) setCustomersData(data);
      } else if (activeTab === "employees") {
        const queryParams = new URLSearchParams();
        if (search) queryParams.set("search", search);
        if (selectedRole) queryParams.set("role", selectedRole);
        const res = await fetch(`/api/reports/employees?${queryParams.toString()}`);
        const data = await res.json();
        if (res.ok) setEmployeesData(data);
      } else if (activeTab === "bom") {
        const queryParams = new URLSearchParams();
        if (search) queryParams.set("search", search);
        if (selectedCustomer) queryParams.set("customer", selectedCustomer);
        if (selectedBomType) queryParams.set("bomType", selectedBomType);
        const res = await fetch(`/api/reports/bom?${queryParams.toString()}`);
        const data = await res.json();
        if (res.ok) setBomData(data);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedCustomer, selectedStatus, selectedRole, selectedBomType]);

  // Distinct customer list for filters
  const customerList = useMemo(() => {
    if (customersData.rows.length > 0) {
      return customersData.rows.map((c) => c.customer).filter((c) => c !== "Unassigned Customer");
    }
    return [];
  }, [customersData]);

  // Initial customer fetch for dropdown
  useEffect(() => {
    fetch(`/api/reports/customers`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.rows) setCustomersData(d);
      })
      .catch(() => {});
  }, []);

  // Drilldown Fetchers
  const openWorkOrderDrilldown = async (id: string, label?: string) => {
    setDrilldownType("wo");
    setDrilldownTitle(`Work Order Costing: ${label || id}`);
    setDrilldownLoading(true);
    setDrilldownData(null);
    try {
      const res = await fetch(`/api/reports/work-orders?workOrderNo=${encodeURIComponent(id)}`);
      const data = await res.json();
      setDrilldownData(data);
    } catch {
      toast.error("Failed to load work order drilldown");
    } finally {
      setDrilldownLoading(false);
    }
  };

  const openStyleDrilldown = async (styleCode: string) => {
    setDrilldownType("style");
    setDrilldownTitle(`Style Costing Breakdown: ${styleCode}`);
    setDrilldownLoading(true);
    setDrilldownData(null);
    try {
      const res = await fetch(`/api/reports/styles?styleCode=${encodeURIComponent(styleCode)}`);
      const data = await res.json();
      setDrilldownData(data);
    } catch {
      toast.error("Failed to load style drilldown");
    } finally {
      setDrilldownLoading(false);
    }
  };

  const openCustomerDrilldown = async (customerName: string) => {
    setDrilldownType("cust");
    setDrilldownTitle(`Customer Commercial Portfolio: ${customerName}`);
    setDrilldownLoading(true);
    setDrilldownData(null);
    try {
      const res = await fetch(`/api/reports/customers?customer=${encodeURIComponent(customerName)}`);
      const data = await res.json();
      setDrilldownData(data);
    } catch {
      toast.error("Failed to load customer details");
    } finally {
      setDrilldownLoading(false);
    }
  };

  const openEmployeeDrilldown = (emp: EmployeeCostingRow) => {
    setDrilldownType("emp");
    setDrilldownTitle(`Costing Merchandiser: ${emp.name}`);
    setDrilldownData(emp);
  };

  // Status Badge Helper
  const renderStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "approved" || s === "fully_approved") {
      return (
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
          Approved
        </Badge>
      );
    }
    if (s === "in_review") {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
          In Review
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">
        Draft
      </Badge>
    );
  };

  // Export to Excel
  const handleExport = () => {
    let exportData: any[] = [];
    let sheetName = "Costing_Report";

    if (activeTab === "work-orders") {
      sheetName = "Work_Order_Costing";
      exportData = workOrdersData.rows.map((r) => ({
        "Work Order / Ref": r.workOrderNo,
        "Cost Sheet Number": r.costSheetNumber,
        "Reference Name": r.referenceName,
        "Customer": r.customer,
        "Style": r.styleName,
        "Order Qty (pcs)": r.orderQuantity,
        "Order FOB ($)": r.orderFob,
        "Target FOB ($)": r.targetFob,
        "Total Value ($)": r.totalOrderValueUSD,
        "CM ($)": r.cmUSD,
        "Net Profit ($)": r.netProfitUSD,
        "Profit Margin %": `${r.netProfitPct}%`,
        "SMV Sewing": r.smvSewing,
        "Status": r.approvalStatus,
        "Costing Date": r.costingDate || "N/A",
        "Created By": r.createdByName,
      }));
    } else if (activeTab === "styles") {
      sheetName = "Style_Costing";
      exportData = stylesData.rows.map((s) => ({
        "Style Code": s.styleCode,
        "Style Name": s.styleName,
        "Customer": s.customer,
        "Category": s.category,
        "Cost Sheets": s.costSheetsCount,
        "Approved Sheets": s.approvedSheetsCount,
        "Units Costed": s.totalUnitsCosted,
        "Commercial Value ($)": s.totalValueUSD,
        "Avg FOB ($)": s.avgFob,
        "Avg SMV": s.avgSmv,
        "Avg CM ($)": s.avgCmUSD,
        "Profit Margin %": `${s.avgProfitPct}%`,
        "Latest Costing": s.latestCostingDate,
      }));
    } else if (activeTab === "customers") {
      sheetName = "Customer_Costing";
      exportData = customersData.rows.map((c) => ({
        "Customer Name": c.customer,
        "Cost Sheets": c.costSheetsCount,
        "Approved": c.approvedCount,
        "In Review": c.inReviewCount,
        "Draft": c.draftCount,
        "Total Units Costed": c.totalUnitsCosted,
        "Commercial Value ($)": c.totalValueUSD,
        "Avg FOB ($)": c.avgFob,
        "Avg Margin %": `${c.avgProfitMarginPct}%`,
        "Latest Activity": c.latestDate,
      }));
    } else if (activeTab === "employees") {
      sheetName = "Employee_Productivity";
      exportData = employeesData.employees.map((e) => ({
        "Name": e.name,
        "Email": e.email,
        "Role": e.role,
        "Assigned Customer": e.assignedCustomer,
        "Assigned Teams": e.teams.join(", ") || "None",
        "Cost Sheets Authored": e.totalSheetsCreated,
        "Approved": e.approvedSheets,
        "In Review": e.inReviewSheets,
        "Draft": e.draftSheets,
        "Units Costed": e.totalUnitsCosted,
        "Commercial Value ($)": e.totalValueUSD,
        "Avg FOB ($)": e.avgFob,
      }));
    } else if (activeTab === "bom") {
      sheetName = "BOM_Usage_Report";
      exportData = bomData.rows.map((b) => ({
        "BOM Type": b.bomType,
        "Category": b.category,
        "Item Description": b.itemName,
        "Customer": b.customerName,
        "Style": b.styleName,
        "Work Order / Ref": b.workOrderNo,
        "Cost Sheet #": b.costSheetNumber,
        "Batch Qty (pcs)": b.orderQuantity,
        "Cons / Pc": b.consumptionPerPc,
        "Rate ($)": b.rateUSD,
        "Rate (PKR)": b.ratePKR,
        "Unit Cost (PKR)": b.unitCostPKR,
        "Total Cost ($)": b.totalBatchCostUSD,
        "Total Cost (PKR)": b.totalBatchCostPKR,
        "Costing Date": b.costingDate || "N/A",
      }));
    }

    if (exportData.length === 0) {
      toast.error("No data available to export");
      return;
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName}_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel report exported successfully");
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-card border p-4 sm:p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendingUp className="h-4 w-4" />
            </span>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Pre-Order Costing Reports</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Commercial analytics and financial performance sourced directly from pre-order cost sheets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={handleExport}
            className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Download className="h-4 w-4" />
            Export to Excel
          </Button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => {
          setActiveTab(val as any);
          setSearch("");
        }}
        className="space-y-5"
      >
        <div className="flex items-center justify-between border-b pb-1">
          <TabsList className="inline-flex h-10 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground w-auto">
            <TabsTrigger
              value="work-orders"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <Package className="h-4 w-4 shrink-0" />
              Work Orders
            </TabsTrigger>
            <TabsTrigger
              value="styles"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <Scissors className="h-4 w-4 shrink-0" />
              Styles & BOM
            </TabsTrigger>
            <TabsTrigger
              value="customers"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <Building className="h-4 w-4 shrink-0" />
              Customers
            </TabsTrigger>
            <TabsTrigger
              value="employees"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <UserCheck className="h-4 w-4 shrink-0" />
              Employees & Teams
            </TabsTrigger>
            <TabsTrigger
              value="bom"
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs sm:text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <Boxes className="h-4 w-4 shrink-0" />
              BOM Usage
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Global Filter Bar */}
        <Card className="shadow-xs border">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative w-full sm:flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={`Search ${activeTab.replace("-", " ")} in Costing Database...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && fetchData()}
                  className="pl-9 bg-background h-9 text-xs sm:text-sm"
                />
                {search && (
                  <button
                    onClick={() => {
                      setSearch("");
                      fetchData();
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Customer Filter */}
              {(activeTab === "work-orders" || activeTab === "styles" || activeTab === "bom") && (
                <div className="w-full sm:w-56">
                  <select
                    value={selectedCustomer}
                    onChange={(e) => setSelectedCustomer(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">All Customers</option>
                    {customerList.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* BOM Type Filter */}
              {activeTab === "bom" && (
                <div className="w-full sm:w-52">
                  <select
                    value={selectedBomType}
                    onChange={(e) => setSelectedBomType(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">All BOM Categories</option>
                    <option value="Fabric">Fabric</option>
                    <option value="Lining">Lining</option>
                    <option value="Trims & Accessories">Trims & Accessories</option>
                    <option value="Chemicals & Washing">Chemicals & Washing</option>
                    <option value="Special Charges">Special Charges</option>
                  </select>
                </div>
              )}

              {/* Status Filter */}
              {activeTab === "work-orders" && (
                <div className="w-full sm:w-44">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="in_review">In Review</option>
                    <option value="approved">Approved</option>
                  </select>
                </div>
              )}

              {/* Role Filter */}
              {activeTab === "employees" && (
                <div className="w-full sm:w-48">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">All Roles</option>
                    <option value="admin">Admin</option>
                    <option value="merchant">Merchant</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="fabric_head">Fabric Head</option>
                  </select>
                </div>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={fetchData}
                className="w-full sm:w-auto h-9 text-xs gap-1.5"
              >
                <Filter className="h-3.5 w-3.5" />
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ══════════════════════════════════════════════════════════════
            1. WORK ORDERS COSTING TAB
        ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="work-orders" className="space-y-5">
          {/* Work Orders KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Work Orders Costed</div>
                <div className="text-2xl font-bold mt-1 text-foreground">
                  {workOrdersData.summary.totalWorkOrders}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Pre-order costing sheets</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Total Units Costed</div>
                <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                  {workOrdersData.summary.totalUnits.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">pcs</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Cumulative order batch</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Total Order Value</div>
                <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                  ${workOrdersData.summary.totalOrderValueUSD.toLocaleString()}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Confirmed FOB value</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Approved Pipeline</div>
                <div className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
                  {workOrdersData.summary.approvedCount} <span className="text-xs font-normal text-muted-foreground">sheets</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Fully authorized</p>
              </CardContent>
            </Card>
          </div>

          {/* Work Orders Table */}
          <Card className="border shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/30">
              <CardTitle className="text-base font-semibold">Work Order Costing Registry</CardTitle>
              <CardDescription className="text-xs">
                Detailed commercial specs, margins, CM, and approval progress for each work order cost sheet.
              </CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-semibold text-xs">Cost Sheet #</TableHead>
                    <TableHead className="font-semibold text-xs">Description</TableHead>
                    <TableHead className="font-semibold text-xs">Work Order #</TableHead>
                    <TableHead className="font-semibold text-xs">Customer</TableHead>
                    <TableHead className="font-semibold text-xs">Style</TableHead>
                    <TableHead className="text-right font-semibold text-xs">Order Qty</TableHead>
                    <TableHead className="text-right font-semibold text-xs">Order FOB</TableHead>
                    <TableHead className="text-right font-semibold text-xs">Total Value ($)</TableHead>
                    <TableHead className="text-right font-semibold text-xs">CM ($)</TableHead>
                    <TableHead className="text-right font-semibold text-xs">Margin %</TableHead>
                    <TableHead className="text-center font-semibold text-xs">Status</TableHead>
                    <TableHead className="text-center font-semibold text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workOrdersData.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="h-32 text-center text-muted-foreground text-sm">
                        {loading ? "Loading work order costing data..." : "No cost sheets match your filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    workOrdersData.rows.map((row) => (
                      <TableRow key={row.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="text-xs font-mono font-bold text-primary whitespace-nowrap">
                          <Link href={`/cost-sheet?id=${row.id}`} className="hover:underline">
                            {row.costSheetNumber && row.costSheetNumber !== "—" ? row.costSheetNumber : row.id}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs font-medium max-w-[140px] truncate" title={row.referenceName}>
                          {row.referenceName}
                        </TableCell>
                        <TableCell className="text-xs font-mono">
                          {row.workOrderNo && !row.workOrderNo.startsWith("PCS-") && !row.workOrderNo.startsWith("POC") ? (
                            <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-mono font-semibold">
                              {row.workOrderNo}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs max-w-[130px] truncate" title={row.customer}>
                          {row.customer}
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate" title={row.styleName}>
                          {row.styleName}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold whitespace-nowrap">
                          {row.orderQuantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-medium whitespace-nowrap">
                          ${row.orderFob.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          ${row.totalOrderValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono whitespace-nowrap">
                          ${row.cmUSD.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono whitespace-nowrap">
                          <span className={row.netProfitPct < 0 ? "text-red-500 font-medium" : "text-emerald-600 font-semibold"}>
                            {row.netProfitPct}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center text-xs whitespace-nowrap">
                          {renderStatusBadge(row.approvalStatus)}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openWorkOrderDrilldown(row.id, `${row.costSheetNumber || row.id} - ${row.referenceName}`)}
                            className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Drill Down
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════
            2. STYLES COSTING TAB
        ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="styles" className="space-y-5">
          {/* Styles KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Unique Styles Costed</div>
                <div className="text-2xl font-bold mt-1 text-foreground">
                  {stylesData.summary.totalStyles}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Product style profiles</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Total Cost Sheets</div>
                <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                  {stylesData.summary.totalCostSheets}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Authored for styles</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Cumulative Volume Costed</div>
                <div className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
                  {stylesData.summary.totalUnitsCosted.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">pcs</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Sum of order batches</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Total Commercial Value</div>
                <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                  ${stylesData.summary.totalCostedValueUSD.toLocaleString()}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Combined FOB value</p>
              </CardContent>
            </Card>
          </div>

          {/* Styles Table */}
          <Card className="border shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/30">
              <CardTitle className="text-base font-semibold">Style Costing & Profitability Summary</CardTitle>
              <CardDescription className="text-xs">
                Aggregated performance across styles, average FOB pricing, SMV requirements, and profit margins.
              </CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-semibold text-xs">Style Identifier</TableHead>
                    <TableHead className="font-semibold text-xs">Style Name</TableHead>
                    <TableHead className="font-semibold text-xs">Customer</TableHead>
                    <TableHead className="text-center font-semibold text-xs">Sheets</TableHead>
                    <TableHead className="text-right font-semibold text-xs">Units Costed</TableHead>
                    <TableHead className="text-right font-semibold text-xs">Avg FOB ($)</TableHead>
                    <TableHead className="text-right font-semibold text-xs">Avg SMV</TableHead>
                    <TableHead className="text-right font-semibold text-xs">Avg CM ($)</TableHead>
                    <TableHead className="text-right font-semibold text-xs">Avg Margin %</TableHead>
                    <TableHead className="text-center font-semibold text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stylesData.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-32 text-center text-muted-foreground text-sm">
                        {loading ? "Loading styles costing..." : "No styles found in costing database."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    stylesData.rows.map((row) => (
                      <TableRow key={row.styleCode} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-mono text-xs font-semibold text-primary">
                          {row.styleCode}
                        </TableCell>
                        <TableCell className="text-xs max-w-[180px] truncate" title={row.styleName}>
                          {row.styleName}
                        </TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate" title={row.customer}>
                          {row.customer}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          <Badge variant="secondary" className="text-[10px]">
                            {row.costSheetsCount}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold">
                          {row.totalUnitsCosted.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-medium">
                          ${row.avgFob.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {row.avgSmv} min
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          ${row.avgCmUSD.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          <span className={row.avgProfitPct < 0 ? "text-red-500" : "text-emerald-600 font-semibold"}>
                            {row.avgProfitPct}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openStyleDrilldown(row.styleCode)}
                            className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Cost Sheets
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════
            3. CUSTOMERS COSTING TAB
        ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="customers" className="space-y-5">
          {/* Customers KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Active Customers Costed</div>
                <div className="text-2xl font-bold mt-1 text-foreground">
                  {customersData.summary.totalCustomers}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Costing portfolio accounts</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Total Cost Sheets</div>
                <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                  {customersData.summary.totalCostSheets}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Pre-order quotes generated</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Total Units Costed</div>
                <div className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
                  {customersData.summary.totalUnitsCosted.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">pcs</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Commercial volume</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Total Commercial Value</div>
                <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                  ${customersData.summary.totalCommercialValueUSD.toLocaleString()}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Total pipeline FOB</p>
              </CardContent>
            </Card>
          </div>

          {/* Customers Table */}
          <Card className="border shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/30">
              <CardTitle className="text-base font-semibold">Customer Portfolio & Commercial Value</CardTitle>
              <CardDescription className="text-xs">
                Detailed customer-wise breakdown of cost sheet volumes, approvals, and profit margins.
              </CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-semibold text-xs">Customer Name</TableHead>
                    <TableHead className="text-center font-semibold text-xs">Total Sheets</TableHead>
                    <TableHead className="text-center font-semibold text-xs">Approved</TableHead>
                    <TableHead className="text-center font-semibold text-xs">In Review</TableHead>
                    <TableHead className="text-center font-semibold text-xs">Draft</TableHead>
                    <TableHead className="text-right font-semibold text-xs">Total Units Costed</TableHead>
                    <TableHead className="text-right font-semibold text-xs">Avg FOB ($)</TableHead>
                    <TableHead className="text-right font-semibold text-xs">Commercial Value ($)</TableHead>
                    <TableHead className="text-center font-semibold text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customersData.rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-32 text-center text-muted-foreground text-sm">
                        {loading ? "Loading customer costing data..." : "No customers found in costing DB."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    customersData.rows.map((row) => (
                      <TableRow key={row.customer} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-medium text-xs text-foreground">
                          {row.customer}
                        </TableCell>
                        <TableCell className="text-center text-xs font-semibold">
                          {row.costSheetsCount}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {row.approvedCount > 0 ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                              {row.approvedCount}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {row.inReviewCount > 0 ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                              {row.inReviewCount}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs text-muted-foreground">
                          {row.draftCount}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-blue-600 dark:text-blue-400">
                          {row.totalUnitsCosted.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-medium">
                          ${row.avgFob.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          ${row.totalValueUSD.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openCustomerDrilldown(row.customer)}
                            className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Portfolio
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════
            4. EMPLOYEES & TEAMS COSTING TAB
        ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="employees" className="space-y-6">
          {/* Employee KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Active Team Members</div>
                <div className="text-2xl font-bold mt-1 text-foreground">
                  {employeesData.summary.totalEmployees}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Users in costing database</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Total Cost Sheets Authored</div>
                <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                  {employeesData.summary.totalSheetsCosted}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Pre-order quotes created</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Units Handled</div>
                <div className="text-2xl font-bold mt-1 text-purple-600 dark:text-purple-400">
                  {employeesData.summary.totalUnitsCosted.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">pcs</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Combined garment units</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Commercial Pipeline Value</div>
                <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                  ${employeesData.summary.totalCommercialValueUSD.toLocaleString()}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Value of authored sheets</p>
              </CardContent>
            </Card>
          </div>

          {/* Section 1: Merchandisers & Costing Personnel */}
          <Card className="border shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/30">
              <CardTitle className="text-base font-semibold">Costing Personnel & Merchandiser Output</CardTitle>
              <CardDescription className="text-xs">
                Performance tracking for cost sheet authors, assigned customer portfolios, approvals, and order value.
              </CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="font-semibold text-xs">Team Member</TableHead>
                    <TableHead className="font-semibold text-xs">Email</TableHead>
                    <TableHead className="font-semibold text-xs">Role</TableHead>
                    <TableHead className="font-semibold text-xs">Assigned Customer / Team</TableHead>
                    <TableHead className="text-center font-semibold text-xs">Sheets</TableHead>
                    <TableHead className="text-center font-semibold text-xs">Approved</TableHead>
                    <TableHead className="text-center font-semibold text-xs">In Review</TableHead>
                    <TableHead className="text-right font-semibold text-xs">Units Costed</TableHead>
                    <TableHead className="text-right font-semibold text-xs">Value ($)</TableHead>
                    <TableHead className="text-center font-semibold text-xs">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeesData.employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="h-28 text-center text-muted-foreground text-sm">
                        {loading ? "Loading team members..." : "No team members found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    employeesData.employees.map((emp) => (
                      <TableRow key={emp.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-medium text-xs text-foreground">
                          {emp.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground font-mono">
                          {emp.email}
                        </TableCell>
                        <TableCell className="text-xs">
                          <Badge variant="secondary" className="capitalize text-[10px]">
                            {emp.role.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {emp.teams.length > 0 ? (
                            <span className="font-medium text-primary">{emp.teams.join(", ")}</span>
                          ) : emp.assignedCustomer && emp.assignedCustomer !== "None" ? (
                            <span>{emp.assignedCustomer}</span>
                          ) : (
                            <span className="text-muted-foreground">General</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs font-semibold">
                          {emp.totalSheetsCreated}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {emp.approvedSheets > 0 ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                              {emp.approvedSheets}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {emp.inReviewSheets > 0 ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                              {emp.inReviewSheets}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold">
                          {emp.totalUnitsCosted.toLocaleString()} pcs
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          ${emp.totalValueUSD.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEmployeeDrilldown(emp)}
                            className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Profile
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Section 2: Cross-Functional Teams Overview */}
          {employeesData.teams.length > 0 && (
            <Card className="border shadow-xs overflow-hidden">
              <CardHeader className="p-4 border-b bg-muted/30">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <UsersRound className="h-4 w-4 text-primary" />
                  Costing Teams Portfolio Configuration
                </CardTitle>
                <CardDescription className="text-xs">
                  Active customer teams configured in management settings.
                </CardDescription>
              </CardHeader>
              <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                {employeesData.teams.map((t) => (
                  <div key={t.id} className="p-3 bg-muted/20 border rounded-lg space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs">{t.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{t.membersCount} Members</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Assigned Customers:{" "}
                      <span className="text-foreground font-medium">
                        {t.customers.length > 0 ? t.customers.join(", ") : "None"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ══════════════════════════════════════════════════════════════
            5. BOM USAGE & MATERIALS REPORT TAB
        ══════════════════════════════════════════════════════════════ */}
        <TabsContent value="bom" className="space-y-5">
          {/* BOM KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Total Material Lines</div>
                <div className="text-2xl font-bold mt-1 text-foreground">
                  {bomData.summary.totalBOMRows}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {bomData.summary.fabricCount} Fabric | {bomData.summary.liningCount} Lining | {bomData.summary.trimsCount} Trims
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Chemical & Special Operations</div>
                <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                  {bomData.summary.chemicalsCount + bomData.summary.specialCount}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {bomData.summary.chemicalsCount} Washing | {bomData.summary.specialCount} Special Charges
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Total Materials Value (USD)</div>
                <div className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                  ${bomData.summary.totalMaterialsUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Cumulative batch materials</p>
              </CardContent>
            </Card>

            <Card className="bg-card/70 border shadow-xs">
              <CardContent className="p-4">
                <div className="text-xs font-medium text-muted-foreground">Total Materials Value (PKR)</div>
                <div className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">
                  Rs. {bomData.summary.totalMaterialsPKR.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">Procurement currency</p>
              </CardContent>
            </Card>
          </div>

          {/* BOM Items Table */}
          <Card className="border shadow-xs overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <CardTitle className="text-base font-semibold">Bill of Materials (BOM) Usage Registry</CardTitle>
                <CardDescription className="text-xs">
                  Cross-reference showing which Fabric, Lining, Trims, Chemicals & Special Charges are used in which Work Order, Style, and Customer, with complete pricing.
                </CardDescription>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                  Fabric: {bomData.summary.fabricCount}
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                  Lining: {bomData.summary.liningCount}
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200">
                  Trims: {bomData.summary.trimsCount}
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                  Chemicals: {bomData.summary.chemicalsCount}
                </Badge>
                <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">
                  Special: {bomData.summary.specialCount}
                </Badge>
              </div>
            </CardHeader>
            <Table className="w-full text-xs table-fixed" containerClassName="overflow-x-hidden">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[8%] font-semibold text-xs whitespace-nowrap">Category</TableHead>
                  <TableHead className="w-[24%] font-semibold text-xs">Item Description</TableHead>
                  <TableHead className="w-[10%] font-semibold text-xs">Customer</TableHead>
                  <TableHead className="w-[12%] font-semibold text-xs">Style</TableHead>
                  <TableHead className="w-[8%] font-semibold text-xs whitespace-nowrap">Work Order #</TableHead>
                  <TableHead className="w-[8%] font-semibold text-xs whitespace-nowrap">Cost Sheet #</TableHead>
                  <TableHead className="w-[6%] text-right font-semibold text-xs whitespace-nowrap">Order Qty</TableHead>
                  <TableHead className="w-[5%] text-right font-semibold text-xs whitespace-nowrap">Cons</TableHead>
                  <TableHead className="w-[8%] text-right font-semibold text-xs whitespace-nowrap">Rate / Unit Cost</TableHead>
                  <TableHead className="w-[6%] text-right font-semibold text-xs whitespace-nowrap">Total ($)</TableHead>
                  <TableHead className="w-[5%] text-center font-semibold text-xs whitespace-nowrap">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bomData.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="h-32 text-center text-muted-foreground text-sm">
                      {loading ? "Loading BOM usage records..." : "No BOM material records found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  bomData.rows.map((row) => {
                    let typeBadgeColor = "bg-slate-100 text-slate-800 border-slate-200";
                    if (row.bomType === "Fabric") typeBadgeColor = "bg-blue-50 text-blue-700 border-blue-200";
                    else if (row.bomType === "Lining") typeBadgeColor = "bg-purple-50 text-purple-700 border-purple-200";
                    else if (row.bomType === "Trims & Accessories") typeBadgeColor = "bg-amber-50 text-amber-700 border-amber-200";
                    else if (row.bomType === "Chemicals & Washing") typeBadgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
                    else if (row.bomType === "Special Charges") typeBadgeColor = "bg-rose-50 text-rose-700 border-rose-200";

                    return (
                      <TableRow key={row.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="text-xs whitespace-nowrap align-top py-2.5 overflow-hidden">
                          <Badge variant="outline" className={`text-[10px] font-medium ${typeBadgeColor}`}>
                            {row.bomType === "Trims & Accessories" ? "Trims" : row.bomType === "Chemicals & Washing" ? "Chemicals" : row.bomType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs align-top py-2.5 overflow-hidden">
                          <div className="font-medium text-foreground leading-snug break-words">
                            {row.itemName}
                          </div>
                          {row.category && row.category !== row.bomType && (
                            <span className="text-[10px] text-muted-foreground block mt-0.5 truncate" title={row.category}>
                              Category: {row.category}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs align-top py-2.5 overflow-hidden" title={row.customerName}>
                          <span className="block truncate font-medium">{row.customerName}</span>
                        </TableCell>
                        <TableCell className="text-xs align-top py-2.5 overflow-hidden" title={row.styleName}>
                          <span className="block truncate">{row.styleName}</span>
                        </TableCell>
                        <TableCell className="text-xs font-mono align-top py-2.5 overflow-hidden whitespace-nowrap">
                          {row.workOrderNo && !row.workOrderNo.startsWith("PCS-") && !row.workOrderNo.startsWith("POC") ? (
                            <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-[10px] font-mono font-semibold">
                              {row.workOrderNo}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-bold text-primary align-top py-2.5 overflow-hidden whitespace-nowrap">
                          <Link href={`/cost-sheet?id=${row.costSheetId}`} className="hover:underline">
                            {row.costSheetNumber}
                          </Link>
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold whitespace-nowrap align-top py-2.5 overflow-hidden">
                          {row.orderQuantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono whitespace-nowrap align-top py-2.5 overflow-hidden">
                          {row.consumptionPerPc}
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono whitespace-nowrap align-top py-2.5 overflow-hidden">
                          <div className="font-medium text-foreground">${row.rateUSD.toFixed(3)}</div>
                          <div className="text-[10px] text-muted-foreground">Rs. {row.unitCostPKR.toFixed(2)}/pc</div>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap align-top py-2.5 overflow-hidden">
                          ${row.totalBatchCostUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center whitespace-nowrap align-top py-2 overflow-hidden">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openWorkOrderDrilldown(row.costSheetId, `${row.costSheetNumber} - ${row.referenceName}`)}
                            className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ══════════════════════════════════════════════════════════════
          DRILLDOWN MODAL DIALOG
      ══════════════════════════════════════════════════════════════ */}
      <Dialog open={drilldownType !== null} onOpenChange={(open) => !open && setDrilldownType(null)}>
        <DialogContent className="sm:max-w-4xl w-[95vw] max-h-[88vh] overflow-y-auto p-4 sm:p-6 shadow-xl border bg-background">
          <DialogHeader className="border-b pb-3">
            <DialogTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {drilldownTitle}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Detailed pre-order costing data, financial calculations, and BOM materials.
            </DialogDescription>
          </DialogHeader>

          {drilldownLoading ? (
            <div className="py-16 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              Loading costing records...
            </div>
          ) : drilldownType === "wo" && drilldownData?.costSheet ? (
            <div className="space-y-6 pt-2">
              {/* Cost Sheet Header Banner */}
              <div className="p-4 bg-muted/30 border rounded-lg grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Reference Name</span>
                  <span className="text-xs font-semibold">{drilldownData.costSheet.referenceName}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Customer</span>
                  <span className="text-xs font-semibold">{drilldownData.costSheet.customerName || "Unassigned"}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Order Qty & FOB</span>
                  <span className="text-xs font-semibold">
                    {drilldownData.costSheet.orderQuantity.toLocaleString()} pcs @ ${drilldownData.costSheet.orderFob}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Approval Status</span>
                  <div className="mt-0.5">{renderStatusBadge(drilldownData.costSheet.approvalStatus)}</div>
                </div>
              </div>

              {/* Financial Calculations Summary */}
              {drilldownData.costSheet.calculations && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Financial Calculations & Profitability
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-card border rounded-lg">
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Target FOB</span>
                      <span className="text-xs font-mono font-bold text-primary">
                        ${drilldownData.costSheet.calculations.targetFobUSD?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block">CM per Pc</span>
                      <span className="text-xs font-mono font-bold text-foreground">
                        ${drilldownData.costSheet.calculations.cmUSD?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block">EBITDA per Pc</span>
                      <span className="text-xs font-mono font-bold text-purple-600">
                        ${drilldownData.costSheet.calculations.ebitdaUSD?.toFixed(2) || "0.00"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block">Net Profit %</span>
                      <span className="text-xs font-mono font-bold text-emerald-600">
                        {drilldownData.costSheet.calculations.netProfitPct
                          ? `${(drilldownData.costSheet.calculations.netProfitPct * 100).toFixed(1)}%`
                          : "0.0%"}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bill of Materials (BOM) Breakdown */}
              {drilldownData.costSheet.bomSummary && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    BOM Materials Breakdown ({drilldownData.costSheet.bomSummary.fabricItems} Fabric, {drilldownData.costSheet.bomSummary.liningItems} Lining, {drilldownData.costSheet.bomSummary.accessoriesItems} Accessories)
                  </h4>
                  <div className="border rounded-md overflow-x-auto max-h-56">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="text-xs font-semibold">Material Type</TableHead>
                          <TableHead className="text-xs font-semibold">Description</TableHead>
                          <TableHead className="text-right text-xs font-semibold">Consumption</TableHead>
                          <TableHead className="text-right text-xs font-semibold">Rate ($)</TableHead>
                          <TableHead className="text-right text-xs font-semibold">Line Cost (PKR)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {drilldownData.costSheet.bomSummary.fabric.map((f: any, i: number) => (
                          <TableRow key={`f-${i}`}>
                            <TableCell className="text-xs font-medium text-blue-600">Fabric</TableCell>
                            <TableCell className="text-xs">{f.itemName}</TableCell>
                            <TableCell className="text-right text-xs font-mono">{f.consumptionPerPc || f.consumption || 0}</TableCell>
                            <TableCell className="text-right text-xs font-mono">${(f.rateUSD || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right text-xs font-mono">Rs. {Math.round(f.fabricCostPKR || f.lineCostPKR || 0)}</TableCell>
                          </TableRow>
                        ))}
                        {drilldownData.costSheet.bomSummary.lining.map((l: any, i: number) => (
                          <TableRow key={`l-${i}`}>
                            <TableCell className="text-xs font-medium text-purple-600">Lining</TableCell>
                            <TableCell className="text-xs">{l.itemName}</TableCell>
                            <TableCell className="text-right text-xs font-mono">{l.consumptionPerPc || l.consumption || 0}</TableCell>
                            <TableCell className="text-right text-xs font-mono">${(l.rateUSD || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right text-xs font-mono">Rs. {Math.round(l.lineCostPKR || 0)}</TableCell>
                          </TableRow>
                        ))}
                        {drilldownData.costSheet.bomSummary.accessories.map((a: any, i: number) => (
                          <TableRow key={`a-${i}`}>
                            <TableCell className="text-xs font-medium text-amber-600">Accessories</TableCell>
                            <TableCell className="text-xs">{a.itemName}</TableCell>
                            <TableCell className="text-right text-xs font-mono">{a.consumptionPerPc || a.consumption || 0}</TableCell>
                            <TableCell className="text-right text-xs font-mono">${(a.rateUSD || 0).toFixed(2)}</TableCell>
                            <TableCell className="text-right text-xs font-mono">Rs. {Math.round(a.lineCostPKR || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Link
                  href={`/cost-sheet?id=${drilldownData.costSheet.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                >
                  Open Full Cost Sheet in Editor <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          ) : drilldownType === "style" && drilldownData ? (
            <div className="space-y-6 pt-2">
              <div className="p-3.5 bg-muted/30 border rounded-lg flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-foreground">Style: {drilldownData.styleCode}</span>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {drilldownData.summary.totalSheets} Cost Sheets | Total Order Batch:{" "}
                    <span className="font-semibold text-primary">{drilldownData.summary.totalUnits.toLocaleString()} pcs</span>
                  </div>
                </div>
                <div className="text-xs font-mono font-bold text-emerald-600">
                  ${drilldownData.summary.totalCostedValueUSD.toLocaleString()}
                </div>
              </div>

              {/* Cost Sheets list for style */}
              <div className="border rounded-md overflow-x-auto max-h-72">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Description</TableHead>
                      <TableHead className="text-xs font-semibold">Customer</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Quantity</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Order FOB ($)</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Total Value ($)</TableHead>
                      <TableHead className="text-center text-xs font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drilldownData.costSheets?.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs font-medium text-primary">
                          <Link href={`/cost-sheet?id=${c.id}`} className="hover:underline">
                            {c.referenceName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs">{c.customerName}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">{c.orderQuantity.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs font-mono">${c.orderFob.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-xs font-mono font-semibold">${c.totalValueUSD.toLocaleString()}</TableCell>
                        <TableCell className="text-center text-xs">{renderStatusBadge(c.approvalStatus)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : drilldownType === "cust" && drilldownData ? (
            <div className="space-y-6 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-muted/30 border rounded-lg">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Customer Account</span>
                  <span className="text-xs font-semibold">{drilldownData.customer}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Cost Sheets Count</span>
                  <span className="text-xs font-semibold">{drilldownData.summary.totalCostSheets}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Total Volume</span>
                  <span className="text-xs font-semibold text-blue-600">{drilldownData.summary.totalUnits.toLocaleString()} pcs</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Total Pipeline Value</span>
                  <span className="text-xs font-mono font-semibold text-emerald-600">
                    ${drilldownData.summary.totalValueUSD.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Customer Sheets List */}
              <div className="border rounded-md overflow-x-auto max-h-72">
                <Table>
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Description</TableHead>
                      <TableHead className="text-xs font-semibold">Style</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Quantity</TableHead>
                      <TableHead className="text-right text-xs font-semibold">FOB ($)</TableHead>
                      <TableHead className="text-right text-xs font-semibold">Value ($)</TableHead>
                      <TableHead className="text-center text-xs font-semibold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drilldownData.costSheets?.map((c: any) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs font-medium text-primary">
                          <Link href={`/cost-sheet?id=${c.id}`} className="hover:underline">
                            {c.referenceName}
                          </Link>
                        </TableCell>
                        <TableCell className="text-xs">{c.styleName}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">{c.orderQuantity.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs font-mono">${c.orderFob.toFixed(2)}</TableCell>
                        <TableCell className="text-right text-xs font-mono font-semibold text-emerald-600">
                          ${c.orderValueUSD.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-center text-xs">{renderStatusBadge(c.approvalStatus)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : drilldownType === "emp" && drilldownData ? (
            <div className="space-y-5 pt-2">
              <div className="p-4 bg-muted/30 border rounded-lg space-y-2">
                <div className="text-sm font-semibold">{drilldownData.name}</div>
                <div className="text-xs text-muted-foreground">
                  Email: <span className="font-mono text-foreground">{drilldownData.email}</span> | Role:{" "}
                  <Badge variant="secondary" className="capitalize text-[10px]">
                    {drilldownData.role.replace("_", " ")}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Assigned Teams:{" "}
                  <span className="font-medium text-foreground">
                    {drilldownData.teams?.length > 0 ? drilldownData.teams.join(", ") : "None"}
                  </span>
                </div>
              </div>

              {/* Creator Output Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-card border rounded-lg">
                <div>
                  <span className="text-[11px] text-muted-foreground block">Sheets Created</span>
                  <span className="text-xs font-bold text-primary">{drilldownData.totalSheetsCreated}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Approved Sheets</span>
                  <span className="text-xs font-bold text-emerald-600">{drilldownData.approvedSheets}</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Units Costed</span>
                  <span className="text-xs font-bold text-foreground">{drilldownData.totalUnitsCosted.toLocaleString()} pcs</span>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground block">Total Value Costed</span>
                  <span className="text-xs font-mono font-bold text-emerald-600">${drilldownData.totalValueUSD.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
