"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { CostSheetService } from "../services/CostSheetService";
import { useAuth } from "@/features/auth/context/AuthProvider";
import type { SavedCostSheetItem } from "../types";

export function useCostSheetsListFacade() {
  const { user } = useAuth();
  const assignedCustomers = useMemo(() => {
    if (user?.role === "admin" || !user?.assignedCustomer) return [];
    return user.assignedCustomer
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
  }, [user?.role, user?.assignedCustomer]);

  const [costSheets, setCostSheets] = useState<SavedCostSheetItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");

  useEffect(() => {
    setLoading(true);
    const unsub = CostSheetService.subscribe(
      (data) => {
        setCostSheets(data);
        setLoading(false);
      },
      () => {
        setLoading(false);
        toast.error("Failed to load cost sheets");
      }
    );
    return () => unsub();
  }, []);

  const scopedCostSheets = useMemo(() => {
    if (user?.role === "admin") return costSheets;

    return costSheets.filter((sheet) => {
      const isCustom =
        sheet.styleId?.trim().toLowerCase() === "custom" ||
        sheet.id?.toLowerCase().startsWith("pcs-custom-") ||
        sheet.styleName?.trim().toLowerCase() === "custom";

      const sheetCust = sheet.customerName?.trim().toLowerCase();
      const hasMatchingCustomer =
        sheetCust &&
        assignedCustomers.length > 0 &&
        assignedCustomers.includes(sheetCust);

      const isAuthor =
        (user?.id !== undefined && sheet.createdById === user.id) ||
        (user?.email &&
          sheet.createdByEmail &&
          sheet.createdByEmail.trim().toLowerCase() === user.email.trim().toLowerCase());

      if (isCustom) {
        if (isAuthor) return true;
        if (hasMatchingCustomer) return true;
        if (assignedCustomers.length === 0) return true;
        return false;
      } else {
        if (assignedCustomers.length === 0) return true;
        if (hasMatchingCustomer) return true;
        if (isAuthor) return true;
        return false;
      }
    });
  }, [costSheets, user, assignedCustomers]);

  const uniqueCustomers = useMemo(() => {
    if (assignedCustomers.length > 0) return assignedCustomers;
    const set = new Set<string>();
    costSheets.forEach((s) => s.customerName && set.add(s.customerName));
    return Array.from(set).sort();
  }, [costSheets, assignedCustomers]);

  const uniqueStages = useMemo(() => {
    const set = new Set<string>();
    scopedCostSheets.forEach((s) => s.costingStage && set.add(s.costingStage));
    return Array.from(set).sort();
  }, [scopedCostSheets]);

  const filteredSheets = useMemo(() => {
    return scopedCostSheets.filter((sheet) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        sheet.id.toLowerCase().includes(q) ||
        sheet.referenceName.toLowerCase().includes(q) ||
        sheet.styleId.toLowerCase().includes(q) ||
        sheet.styleName.toLowerCase().includes(q) ||
        sheet.customerName.toLowerCase().includes(q);

      const matchesCustomer =
        assignedCustomers.length > 0 ||
        customerFilter === "all" ||
        sheet.customerName === customerFilter;

      const matchesStage =
        stageFilter === "all" || sheet.costingStage === stageFilter;

      return matchesSearch && matchesCustomer && matchesStage;
    });
  }, [scopedCostSheets, search, customerFilter, stageFilter, assignedCustomers]);

  const handleDelete = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      if (!confirm("Are you sure you want to permanently delete this costing snapshot?")) {
        return;
      }
      try {
        await CostSheetService.delete(id);
        toast.success("Costing snapshot deleted");
      } catch (err) {
        console.error("Delete cost sheet error:", err);
        toast.error("Failed to delete cost sheet");
      }
    },
    []
  );

  const handleExport = useCallback(() => {
    const dataToExport = filteredSheets.map((s) => ({
      "Cost Sheet ID": s.id,
      "Scenario Reference": s.referenceName,
      "Style ID": s.styleId,
      "Style Name": s.styleName,
      Customer: s.customerName,
      Category: s.styleCategory,
      "Order Qty": s.orderQuantity,
      "Costing Stage": s.costingStage,
      "Target FOB ($)": s.calculations?.targetFobUSD ?? 0,
      "Order FOB ($)": s.orderFOB,
      "CM ($/pc)": s.calculations?.cmUSD ?? 0,
      "EBITDA ($/pc)": s.calculations?.ebitdaUSD ?? 0,
      "Net Profit ($)": s.calculations?.netProfitUSD ?? 0,
      "Net Profit (%)": `${((s.calculations?.netProfitPct ?? 0) * 100).toFixed(2)}%`,
      SavedAt: s.savedAt,
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Cost Sheets");
    XLSX.writeFile(workbook, "Cost_Sheets_Export.xlsx");
    toast.success("Exported to Excel");
  }, [filteredSheets]);

  return {
    costSheets,
    filteredSheets,
    loading,
    search,
    setSearch,
    customerFilter,
    setCustomerFilter,
    stageFilter,
    setStageFilter,
    uniqueCustomers,
    uniqueStages,
    handleDelete,
    handleExport,
  };
}
