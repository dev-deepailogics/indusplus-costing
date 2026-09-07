"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { StyleMasterService } from "../services/StyleMasterService";
import type {
  StyleMasterItem,
  StyleFormMeta,
  BOMFabricItem,
  BOMLiningItem,
  BOMAccessoriesItem,
  BOMChemicalsItem,
  BOMSpecialChargesItem,
} from "../types";
import { ParametersService } from "@/features/parameters";
import type { SimpleTableData, DropdownListsData } from "@/features/parameters";
import { ItemCatalogService, FABRIC_COLLECTION, LINING_COLLECTION } from "@/features/item-catalog";
import type { CatalogItem } from "@/features/item-catalog";

export const DEFAULT_CUSTOMERS = [
  "Duer",
  "Zara",
  "Mustang",
  "Miniconf",
  "Mohito",
  "Retrojeans",
];

export const DEFAULT_CATEGORIES = [
  "Top Ware",
  "Men's Pant",
  "Ladies Pant",
  "Shorts",
  "Shirt",
];

export const DEFAULT_WASHES = [
  "Rinse",
  "Dyeing",
  "Softner",
  "Stone Wash",
  "EW/Biopolish",
  "Silicon Ball",
];

interface ImportedStyleRow {
  Style_ID?: string;
  Style_Name?: string;
  SMV_Sewing?: string | number;
  Efficiency?: string | number;
  Rejection_Pct?: string | number;
  Base_Price_USD?: string | number;
}

export function useStyleMasterFacade() {
  const [styles, setStyles] = useState<StyleMasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<StyleMasterItem | null>(null);
  const [exchangeRate, setExchangeRate] = useState<number>(278);

  // Dropdowns lists & Catalog items
  const [customerOptions, setCustomerOptions] = useState<string[]>(DEFAULT_CUSTOMERS);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORIES);
  const [washOptions, setWashOptions] = useState<string[]>(DEFAULT_WASHES);
  const [fabricCatalog, setFabricCatalog] = useState<CatalogItem[]>([]);
  const [liningCatalog, setLiningCatalog] = useState<CatalogItem[]>([]);

  // Form Fields State
  const [formMeta, setFormMeta] = useState<StyleFormMeta>({
    id: "",
    styleName: "",
    smvSewing: 0,
    targetEfficiency: 0.47,
    rejectionPct: 0.0415,
    baseSellingPrice: 0,
  });

  const [customerName, setCustomerName] = useState("Duer");
  const [styleCategory, setStyleCategory] = useState("Top Ware");
  const [orderType, setOrderType] = useState<"Denim" | "Non Denim">("Denim");
  const [washType, setWashType] = useState("Rinse");
  const [orderQuantity, setOrderQuantity] = useState(1000);

  const [formFabric, setFormFabric] = useState<BOMFabricItem[]>([]);
  const [formLining, setFormLining] = useState<BOMLiningItem[]>([]);
  const [formAccessories, setFormAccessories] = useState<BOMAccessoriesItem[]>([]);
  const [formChemicals, setFormChemicals] = useState<BOMChemicalsItem[]>([]);
  const [formSpecialCharges, setFormSpecialCharges] = useState<BOMSpecialChargesItem[]>([]);

  useEffect(() => {
    setLoading(true);
    const unsubStyles = StyleMasterService.subscribe(
      (data) => {
        setStyles(data);
        setLoading(false);
      },
      () => {
        setLoading(false);
        toast.error("Failed to load styles");
      }
    );

    const unsubCostOfSales = ParametersService.subscribeToTable<SimpleTableData>(
      "cost-as-percent-of-sales",
      (data) => {
        if (data?.rows?.length) {
          const row = data.rows.find(
            (r) => r.values.description?.toLowerCase().trim() === "exchange rate"
          );
          if (row?.values.percentOfSales) {
            const parsed = parseFloat(row.values.percentOfSales);
            if (!isNaN(parsed) && parsed > 0) {
              setExchangeRate(parsed);
            }
          }
        }
      }
    );

    const unsubDropdowns = ParametersService.subscribeToTable<DropdownListsData>(
      "dropdown-lists",
      (data) => {
        if (data?.lists) {
          const cust = data.lists.find((l) => l.key === "customers");
          if (cust?.items?.length) setCustomerOptions(cust.items);
          const wash = data.lists.find((l) => l.key === "washes");
          if (wash?.items?.length) setWashOptions(wash.items);
        }
      }
    );

    const unsubCategories = ParametersService.subscribeToTable<SimpleTableData>(
      "styles",
      (data) => {
        if (data?.rows?.length) {
          const cats = data.rows.map((r) => r.values.styleName).filter(Boolean);
          if (cats.length) setCategoryOptions(cats);
        }
      }
    );

    const unsubFabric = ItemCatalogService.subscribe(FABRIC_COLLECTION, setFabricCatalog);
    const unsubLining = ItemCatalogService.subscribe(LINING_COLLECTION, setLiningCatalog);

    return () => {
      unsubStyles();
      unsubCostOfSales();
      unsubDropdowns();
      unsubCategories();
      unsubFabric();
      unsubLining();
    };
  }, []);

  const openEditDialog = useCallback(
    (style: StyleMasterItem | null) => {
      if (style) {
        setEditingStyle(style);
        setFormMeta({
          id: style.id,
          styleName: style.styleName,
          smvSewing: style.smvSewing || 0,
          targetEfficiency: style.targetEfficiency || 0.47,
          rejectionPct: style.rejectionPct || 0.0415,
          baseSellingPrice: style.baseSellingPrice || 0,
        });
        setCustomerName(style.customerName || "Duer");
        setStyleCategory(style.styleCategory || "Top Ware");
        setOrderType(style.orderType || "Denim");
        setWashType(style.washType || "Rinse");
        setOrderQuantity(style.orderQuantity || 1000);

        setFormFabric(
          style.bomFabric && style.bomFabric.length > 0
            ? style.bomFabric
            : Array.from({ length: 5 }, (_, i) => ({
                itemName: `Fabric ${i + 1}`,
                consumptionPerPc: 0,
                rateUSD: 0,
                ratePKR: 0,
                fabricCostPKR: 0,
              }))
        );

        setFormLining(
          style.bomLining && style.bomLining.length > 0
            ? style.bomLining
            : Array.from({ length: 5 }, (_, i) => ({
                itemName: `Lining ${i + 1}`,
                consumptionPerPc: 0,
                rateUSD: 0,
                ratePKR: 0,
                liningCostPKR: 0,
              }))
        );

        setFormAccessories(StyleMasterService.mergeAccessories(style.bomAccessories));
        setFormChemicals(StyleMasterService.mergeChemicals(style.bomChemicals));
        setFormSpecialCharges(StyleMasterService.mergeSpecialCharges(style.bomSpecialCharges));
      } else {
        setEditingStyle(null);
        setFormMeta({
          id: `STY-${String(styles.length + 1).padStart(3, "0")}`,
          styleName: "",
          smvSewing: 15,
          targetEfficiency: 0.47,
          rejectionPct: 0.0415,
          baseSellingPrice: 10,
        });
        setCustomerName("Duer");
        setStyleCategory("Top Ware");
        setOrderType("Denim");
        setWashType("Rinse");
        setOrderQuantity(1000);

        setFormFabric(
          Array.from({ length: 5 }, (_, i) => ({
            itemName: `Fabric ${i + 1}`,
            consumptionPerPc: 0,
            rateUSD: 0,
            ratePKR: 0,
            fabricCostPKR: 0,
          }))
        );
        setFormLining(
          Array.from({ length: 5 }, (_, i) => ({
            itemName: `Lining ${i + 1}`,
            consumptionPerPc: 0,
            rateUSD: 0,
            ratePKR: 0,
            liningCostPKR: 0,
          }))
        );
        setFormAccessories(StyleMasterService.mergeAccessories([]));
        setFormChemicals(StyleMasterService.mergeChemicals([]));
        setFormSpecialCharges(StyleMasterService.mergeSpecialCharges([]));
      }
      setDialogOpen(true);
    },
    [styles.length]
  );

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingStyle(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!formMeta.id || !formMeta.styleName) {
      toast.error("Style ID and Style Name are required");
      return;
    }

    const calculatedBracket = StyleMasterService.calculateSizeBracket(orderQuantity);

    const styleItem: StyleMasterItem = {
      ...formMeta,
      customerName,
      styleCategory,
      orderType,
      washType,
      orderQuantity,
      sizeBracket: calculatedBracket,
      bomFabric: formFabric.filter((f) => f.consumptionPerPc > 0 || f.rateUSD > 0),
      bomLining: formLining.filter((l) => l.consumptionPerPc > 0 || l.rateUSD > 0),
      bomAccessories: formAccessories,
      bomChemicals: formChemicals,
      bomSpecialCharges: formSpecialCharges,
    };

    try {
      await StyleMasterService.save(styleItem);
      toast.success(
        editingStyle ? "Style updated successfully" : "New Style added successfully"
      );
      setDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save style to database");
    }
  }, [
    formMeta,
    orderQuantity,
    customerName,
    styleCategory,
    orderType,
    washType,
    formFabric,
    formLining,
    formAccessories,
    formChemicals,
    formSpecialCharges,
    editingStyle,
  ]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this style?")) return;
    try {
      await StyleMasterService.delete(id);
      toast.success("Style deleted");
    } catch (e) {
      console.error(e);
      toast.error("Delete failed");
    }
  }, []);

  const handleExport = useCallback(() => {
    StyleMasterService.exportToExcel(styles);
    toast.success("Exported to Excel");
  }, [styles]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: "binary" });
        const wsname = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[wsname];
        const importedData = XLSX.utils.sheet_to_json<ImportedStyleRow>(worksheet);

        for (const row of importedData) {
          const qty = 1000;
          const item: StyleMasterItem = {
            id: row.Style_ID || `STY-${Date.now().toString().slice(-4)}`,
            styleName: row.Style_Name || "Unnamed Import",
            customerName: "Duer",
            styleCategory: "Top Ware",
            orderType: "Denim",
            washType: "Rinse",
            orderQuantity: qty,
            sizeBracket: StyleMasterService.calculateSizeBracket(qty),
            smvSewing: Number(row.SMV_Sewing || 15),
            targetEfficiency: Number(row.Efficiency || 0.47),
            rejectionPct: Number(row.Rejection_Pct || 0.0415),
            baseSellingPrice: Number(row.Base_Price_USD || 0),
            bomFabric: [],
            bomLining: [],
            bomAccessories: [],
            bomChemicals: [],
            bomSpecialCharges: [],
          };
          await StyleMasterService.save(item);
        }
        toast.success("Successfully imported styles");
      } catch (err) {
        console.error(err);
        toast.error("Failed to parse Excel sheet");
      }
    };
    reader.readAsBinaryString(file);
  }, []);

  const filteredStyles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return styles;
    return styles.filter(
      (s) => s.id.toLowerCase().includes(q) || s.styleName.toLowerCase().includes(q)
    );
  }, [styles, search]);

  return {
    styles,
    filteredStyles,
    loading,
    search,
    setSearch,
    dialogOpen,
    setDialogOpen,
    editingStyle,
    exchangeRate,
    customerOptions,
    categoryOptions,
    washOptions,
    fabricCatalog,
    liningCatalog,
    formMeta,
    setFormMeta,
    customerName,
    setCustomerName,
    styleCategory,
    setStyleCategory,
    orderType,
    setOrderType,
    washType,
    setWashType,
    orderQuantity,
    setOrderQuantity,
    formFabric,
    setFormFabric,
    formLining,
    setFormLining,
    formAccessories,
    setFormAccessories,
    formChemicals,
    setFormChemicals,
    formSpecialCharges,
    setFormSpecialCharges,
    openEditDialog,
    closeDialog,
    handleSave,
    handleDelete,
    handleExport,
    handleImport,
  };
}
