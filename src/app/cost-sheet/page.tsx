"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Save,
  RefreshCw,
  Layers,
  Calculator,
  Info,
  Copy,
  Printer,
  Plus,
  X,
  AlertTriangle,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import type { StyleWorkOrderRow } from "@/app/api/styles-and-workorders/route";
import type { IndusBOMData } from "@/app/api/bom/[styleCode]/route";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  getCostSheetById,
  getNextCostSheetId,
  saveCostSheet,
} from "@/lib/cost-sheet/api";
import type { SavedCostSheetItem } from "@/lib/cost-sheet/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import type { CatalogItemDB } from "@/app/api/bom/catalog-items/route";
import { subscribeToTable } from "@/lib/parameters/api";
import type {
  StyleMasterItem,
  BOMFabricItem,
  BOMLiningItem,
  BOMAccessoriesItem,
  BOMChemicalsItem,
  BOMSpecialChargesItem,
} from "@/lib/style-master/types";
import type {
  SimpleTableData,
  MatrixTableData,
  ProcessMatrixTableData,
  DropdownListsData,
} from "@/lib/parameters/types";
import { runFormulaEngine } from "@/lib/cost-sheet/formula-engine";

export default function CostSheetPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-sm text-muted-foreground">
          Loading Cost Sheet...
        </div>
      }
    >
      <CostSheetContent />
    </Suspense>
  );
}

const CUSTOM_STYLE: StyleMasterItem = {
  id: "custom",
  styleName: "",
  customerName: "",
  styleCategory: "Top Ware",
  orderType: "Denim",
  washType: "Rinse",
  orderQuantity: 0,
  sizeBracket: "<=500",
  smvSewing: 0,
  targetEfficiency: 0.47,
  rejectionPct: 0.0415,
  baseSellingPrice: 0,
  bomFabric: [],
  bomLining: [],
  bomAccessories: [],
  bomChemicals: [],
  bomSpecialCharges: [],
};

const DEFAULT_ACCESSORIES_TEMPLATES = [
  { category: "Zipper", itemName: "Zippers" },
  { category: "Thread", itemName: "Thread" },
  { category: "Label", itemName: "Labels" },
  { category: "Trims", itemName: "Trims Mix Materials" },
  { category: "Poly Bag", itemName: "Poly Bags" },
  { category: "Tag", itemName: "Tag" },
  { category: "Carton", itemName: "Cartons" },
  { category: "Button & Rivets", itemName: "Button & Rivets" },
  { category: "Packing Mix Materials", itemName: "Packing Mix Materials" },
  { category: "Sticker", itemName: "Sticker" },
];

const DEFAULT_CHEMICALS_TEMPLATES = [{ washItem: "Rinse" }];

const DEFAULT_SPECIAL_TEMPLATES = [
  { itemName: "Embroidery" },
  { itemName: "Printing Charges" },
  { itemName: "Testing Charges" },
  { itemName: "Inspection Charges" },
];

function ensureStyleBOMDefaults(style: StyleMasterItem): StyleMasterItem {
  const merged = { ...style };

  // Accessories
  const accList = [...(style.bomAccessories || [])];
  DEFAULT_ACCESSORIES_TEMPLATES.forEach((tmpl) => {
    const hasCategory = accList.some(
      (item) => item.category?.toLowerCase() === tmpl.category.toLowerCase(),
    );
    if (!hasCategory) {
      accList.push({
        category: tmpl.category,
        itemName: tmpl.itemName,
        consPerPc: 0,
        ratePKR: 0,
        totalCostPKR: 0,
      });
    }
  });
  merged.bomAccessories = accList;

  // Chemicals
  const chemList = [...(style.bomChemicals || [])];
  DEFAULT_CHEMICALS_TEMPLATES.forEach((tmpl) => {
    const hasItem = chemList.some(
      (item) => item.washItem?.toLowerCase() === tmpl.washItem.toLowerCase(),
    );
    if (!hasItem) {
      chemList.push({
        washItem: tmpl.washItem,
        consPerPc: 0,
        ratePKR: 0,
        totalCostPKR: 0,
      });
    }
  });
  merged.bomChemicals = chemList;

  // Special Charges
  const specialList = [...(style.bomSpecialCharges || [])];
  DEFAULT_SPECIAL_TEMPLATES.forEach((tmpl) => {
    const hasItem = specialList.some(
      (item) =>
        item.itemName?.toLowerCase().replace(/\s+/g, "") ===
        tmpl.itemName.toLowerCase().replace(/\s+/g, ""),
    );
    if (!hasItem) {
      specialList.push({
        itemName: tmpl.itemName,
        consPerPc: 0,
        ratePKR: 0,
        totalCostPKR: 0,
      });
    }
  });
  merged.bomSpecialCharges = specialList;

  return merged;
}

/**
 * Fetches BOM data from indus-plus for a given styleCode and returns
 * mapped BOM arrays ready to merge into a StyleMasterItem.
 * Returns null on error or empty styleCode.
 */
async function fetchIndusBOM(styleCode: string): Promise<IndusBOMData | null> {
  if (!styleCode || styleCode === "custom") return null;
  try {
    const res = await fetch(`/api/bom/${encodeURIComponent(styleCode)}`);
    if (!res.ok) return null;
    return (await res.json()) as IndusBOMData;
  } catch {
    return null;
  }
}

/**
 * Converts an IndusBOMData payload into the StyleMasterItem BOM arrays.
 */
function mapIndusBOMToStyle(bom: IndusBOMData, parityProc = 278) {
  const bomFabric = bom.fabric.map((r) => {
    const ratePKR = r.ratePKR || 0;
    const rateUSD = parityProc > 0 && ratePKR > 0 ? parseFloat((ratePKR / parityProc).toFixed(4)) : 0;
    return {
      itemName: r.itemName,
      consumptionPerPc: r.consumption,
      rateUSD,
      ratePKR,
      fabricCostPKR: r.consumption * ratePKR,
    };
  });

  const bomLining = bom.lining.map((r) => {
    const ratePKR = r.ratePKR || 0;
    const rateUSD = parityProc > 0 && ratePKR > 0 ? parseFloat((ratePKR / parityProc).toFixed(4)) : 0;
    return {
      itemName: r.itemName,
      consumptionPerPc: r.consumption,
      rateUSD,
      ratePKR,
      liningCostPKR: r.consumption * ratePKR,
    };
  });

  // For accessories, aggregate by category+itemName (view can have duplicates)
  const accMap = new Map<string, { category: string; itemName: string; consPerPc: number; ratePKR: number; totalCostPKR: number }>();
  for (const r of bom.accessories) {
    const key = `${r.category}|||${r.itemName}`;
    if (!accMap.has(key)) {
      accMap.set(key, {
        category: r.category,
        itemName: r.itemName,
        consPerPc: r.consumption,
        ratePKR: r.ratePKR,
        totalCostPKR: r.consumption * r.ratePKR,
      });
    }
  }
  const bomAccessories = Array.from(accMap.values());

  return {
    bomFabric,
    bomLining,
    bomAccessories,
    smvSewing: bom.smvSewing,
    washType: bom.wash || undefined,
    styleCategory: bom.category || undefined,
  };
}

function CostSheetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const styleIdParam = searchParams.get("styleId");
  const costSheetIdParam = searchParams.get("costSheetId");

  // Snapshot States
  const [loadedCostSheet, setLoadedCostSheet] =
    useState<SavedCostSheetItem | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Unsaved Changes & Navigation Guard States
  const [isDirty, setIsDirty] = useState(false);
  const [unsavedModalOpen, setUnsavedModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{
    type: "url" | "style" | "reset";
    target?: string;
  } | null>(null);

  const isDirtyRef = useRef(false);
  isDirtyRef.current = isDirty;

  const markDirty = () => {
    if (!isDirtyRef.current) {
      setIsDirty(true);
    }
  };

  // Active Style & Catalogs (MSSQL DB S_StyleCardBOMConsumptionSAMView)
  const [activeStyle, setActiveStyle] = useState<StyleMasterItem | null>(CUSTOM_STYLE);
  const [fabricCatalog, setFabricCatalog] = useState<CatalogItemDB[]>([]);
  const [liningCatalog, setLiningCatalog] = useState<CatalogItemDB[]>([]);
  const [trimsCatalog, setTrimsCatalog] = useState<CatalogItemDB[]>([]);
  const [chemicalsCatalog, setChemicalsCatalog] = useState<CatalogItemDB[]>([]);
  const [specialChargesCatalog, setSpecialChargesCatalog] = useState<CatalogItemDB[]>([]);
  const [newFabricRows, setNewFabricRows] = useState<Set<number>>(new Set());
  const [newLiningRows, setNewLiningRows] = useState<Set<number>>(new Set());
  const [newAccessoryRows, setNewAccessoryRows] = useState<Set<number>>(new Set());
  const [newChemicalRows, setNewChemicalRows] = useState<Set<number>>(new Set());
  const [newSpecialChargeRows, setNewSpecialChargeRows] = useState<Set<number>>(new Set());

  const [directLabourFoh, setDirectLabourFoh] = useState<
    SimpleTableData | undefined
  >(undefined);
  const [cutToShipGrid, setCutToShipGrid] = useState<
    MatrixTableData | undefined
  >(undefined);
  const [rejectionGrid, setRejectionGrid] = useState<
    ProcessMatrixTableData | undefined
  >(undefined);
  const [stylesCategoryGrid, setStylesCategoryGrid] = useState<
    SimpleTableData | undefined
  >(undefined);

  // Loading States
  const [loadingStyles, setLoadingStyles] = useState(true);

  // 1. Control & Input Parameters State
  const [costingDate, setCostingDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [costingStage, setCostingStage] = useState("Quote");
  const [country, setCountry] = useState("SPAIN");
  const [paymentTerms, setPaymentTerms] = useState("LC-60 days");
  const [shipmentMode, setShipmentMode] = useState("Sea");
  const [deliveryTerms, setDeliveryTerms] = useState("FOB");
  const [paritySale, setParitySale] = useState<number>();
  const [parityProcurement, setParityProcurement] = useState<number>();

  // New editable style fields
  const [customerName, setCustomerName] = useState("");
  const [styleCategory, setStyleCategory] = useState("Top Ware");
  const [washType, setWashType] = useState("Rinse");
  const [orderQuantity, setOrderQuantity] = useState(0);
  const [orderType, setOrderType] = useState<"Denim" | "Non Denim">("Denim");
  const [smvSewingInput, setSmvSewingInput] = useState<string>("");
  const [noOfColors, setNoOfColors] = useState<number>(1);
  const [merchGroup, setMerchGroup] = useState<string>("Ayaz");
  const [workOrderNumber, setWorkOrderNumber] = useState<string>("");
  const [deliveryDestination, setDeliveryDestination] =
    useState<string>("EURO");
  const [exFactoryDate, setExFactoryDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split("T")[0];
  });
  const [inhouseOrSubcontract, setInhouseOrSubcontract] =
    useState<string>("INHOUSE");
  const [rebatePct, setRebatePct] = useState<number>(0);

  // Operational Inputs
  const [manpower, setManpower] = useState(60);
  const [efficiencyOverride, setEfficiencyOverride] = useState<string>("");
  const [rejectionOverride, setRejectionOverride] = useState<string>("");
  const [lineTargetOverride, setLineTargetOverride] = useState<string>("");

  // Financial Parameters
  const [discountRate, setDiscountRate] = useState(0.12);
  const [taxEdsPct, setTaxEdsPct] = useState(0.025);
  const [inlandFreightPct, setInlandFreightPct] = useState(0.0125);
  const [localBankChargesPct, setLocalBankChargesPct] = useState(0.0085);
  const [paymentTermsDays, setPaymentTermsDays] = useState(60);
  const [factoringDays, setFactoringDays] = useState(0);
  const [commissionPct, setCommissionPct] = useState(0);
  const [foreignBankCharges, setForeignBankCharges] = useState(0);

  // Order FOB / Quoted Price / Freight & Insurance inputs
  const [quotedPriceInput, setQuotedPriceInput] = useState<string>("");
  const [intlFreight, setIntlFreight] = useState<string>("");
  const [intlInsurance, setIntlInsurance] = useState<string>("");

  // Global click listener to intercept internal link navigations
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!isDirtyRef.current) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      // Ignore hash anchors, javascript:, blank targets, or download links
      if (
        href.startsWith("#") ||
        href.startsWith("javascript:") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      // Check if navigating to another page/url
      const currentFullUrl = window.location.pathname + window.location.search;
      if (href === currentFullUrl || href === window.location.pathname) {
        return;
      }

      // Intercept navigation
      e.preventDefault();
      e.stopPropagation();

      setPendingNavigation({ type: "url", target: href });
      setUnsavedModalOpen(true);
    }

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, []);

  // Browser beforeunload event (tab close, refresh, external navigation)
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Options lists (will subscribe to parameter dropdown-lists if exists)
  const [paymentTermsList, setPaymentTermsList] = useState([
    "LC at Sight",
    "LC-30 days",
    "LC-45 days",
    "LC-60 days",
    "LC-75 days",
    "DA",
    "Advance",
  ]);
  const [deliveryTermsList, setDeliveryTermsList] = useState([
    "FOB",
    "CIF",
    "CFR",
    "DDP/LDP",
  ]);
  const [countriesList, setCountriesList] = useState([
    "SPAIN",
    "GERMANY",
    "USA",
    "UK",
    "FRANCE",
    "ITALY",
  ]);
  const [customersList, setCustomersList] = useState<string[]>([]);
  const [categoriesList, setCategoriesList] = useState([
    "Top Ware",
    "Men's Pant",
    "Ladies Pant",
    "Shorts",
    "Shirt",
  ]);
  const [washTypesList, setWashTypesList] = useState([
    "Rinse",
    "Dyeing",
    "Softner",
    "Stone Wash",
    "EW/Biopolish",
    "Silicon Ball",
  ]);
  const [orderTypesList, setOrderTypesList] = useState(["Denim", "Non Denim"]);

  // indus-plus: Styles & Work Orders from S_StyleAndWorkOrdersView
  const [indusStyleRows, setIndusStyleRows] = useState<StyleWorkOrderRow[]>([]);

  // Fetch customers from indus-plus DB on mount
  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data: { customers?: string[]; error?: string }) => {
        if (data.customers && data.customers.length > 0) {
          setCustomersList(data.customers);
        }
      })
      .catch((err) => console.error("[CostSheet] Failed to load customers:", err));
  }, []);

  // Fetch styles & work orders from indus-plus DB on mount
  useEffect(() => {
    fetch("/api/styles-and-workorders")
      .then((res) => res.json())
      .then((data: { rows?: StyleWorkOrderRow[]; error?: string }) => {
        if (data.rows && data.rows.length > 0) {
          setIndusStyleRows(data.rows);
          if (styleIdParam && !costSheetIdParam) {
            if (styleIdParam === "custom") {
              setActiveStyle(ensureStyleBOMDefaults(CUSTOM_STYLE));
            } else {
              const matchedRow = data.rows.find((r) => r.styleCode === styleIdParam);
              if (matchedRow) {
                const rawCust = matchedRow.customer?.trim() || "";
                setWorkOrderNumber(matchedRow.workOrderNo);
                setCustomerName(rawCust);
                const baseStyle = ensureStyleBOMDefaults({
                  ...CUSTOM_STYLE,
                  id: matchedRow.styleCode,
                  styleName: matchedRow.styleName,
                  customerName: rawCust,
                  orderQuantity: matchedRow.poQty ?? 1000,
                });
                setActiveStyle(baseStyle);
                fetchIndusBOM(matchedRow.styleCode).then((bom) => {
                  if (!bom) return;
                  const mapped = mapIndusBOMToStyle(bom);
                  setActiveStyle((prev) =>
                    prev
                      ? {
                          ...prev,
                          bomFabric: mapped.bomFabric.length ? mapped.bomFabric : prev.bomFabric,
                          bomLining: mapped.bomLining.length ? mapped.bomLining : prev.bomLining,
                          bomAccessories: mapped.bomAccessories.length ? mapped.bomAccessories : prev.bomAccessories,
                          smvSewing: mapped.smvSewing ?? prev.smvSewing,
                          washType: mapped.washType ?? prev.washType,
                          styleCategory: mapped.styleCategory ?? prev.styleCategory,
                        }
                      : prev
                  );
                  if (mapped.smvSewing) setSmvSewingInput(mapped.smvSewing.toString());
                  if (mapped.washType) setWashType(mapped.washType);
                  if (mapped.styleCategory) setStyleCategory(mapped.styleCategory);
                });
              }
            }
          }
        }
      })
      .catch((err) => console.error("[CostSheet] Failed to load styles/WOs:", err));
  }, [styleIdParam, costSheetIdParam]);

  useEffect(() => {
    setLoadingStyles(false);

    // Fetch MSSQL BOM Catalog Items from S_StyleCardBOMConsumptionSAMView
    fetch("/api/bom/catalog-items")
      .then((res) => res.json())
      .then((data) => {
        if (data.fabrics) setFabricCatalog(data.fabrics);
        if (data.linings) setLiningCatalog(data.linings);
        if (data.trims) setTrimsCatalog(data.trims);
        if (data.chemicals) setChemicalsCatalog(data.chemicals);
        if (data.specialCharges) setSpecialChargesCatalog(data.specialCharges);
      })
      .catch((err) => console.error("[CostSheet] Failed to load catalog items from MSSQL DB:", err));

    // Subscribe to POC Parameters
    const unsubDLF = subscribeToTable<SimpleTableData>(
      "direct-labour-foh",
      setDirectLabourFoh,
    );
    const unsubCTS = subscribeToTable<MatrixTableData>(
      "cut-to-ship-grid",
      setCutToShipGrid,
    );
    const unsubRej = subscribeToTable<ProcessMatrixTableData>(
      "rejection-grid",
      setRejectionGrid,
    );
    const unsubStylesGrid = subscribeToTable<SimpleTableData>(
      "styles",
      setStylesCategoryGrid,
    );
    const unsubOrderTypes = subscribeToTable<SimpleTableData>(
      "order-type",
      (data) => {
        if (data?.rows?.length) {
          const types = data.rows
            .map((r) => r.values?.orderType)
            .filter(Boolean) as string[];
          if (types.length > 0) setOrderTypesList(types);
        }
      },
    );

    const unsubDropdowns = subscribeToTable<DropdownListsData>(
      "dropdown-lists",
      (data) => {
        if (data?.lists) {
          const pTerms = data.lists.find(
            (l) => l.key === "paymentTerms",
          )?.items;
          const dTerms = data.lists.find(
            (l) => l.key === "deliveryTerms",
          )?.items;
          const countrs = data.lists.find(
            (l) => l.key === "countries" || l.key === "country",
          )?.items;
          const custs = data.lists.find(
            (l) => l.key === "customerName" || l.key === "customer",
          )?.items;
          const cats = data.lists.find((l) => l.key === "styleCategory")?.items;
          const washes = data.lists.find((l) => l.key === "washType")?.items;

          if (pTerms) setPaymentTermsList(pTerms);
          if (dTerms) setDeliveryTermsList(dTerms);
          if (countrs) setCountriesList(countrs);
          if (cats) setCategoriesList(cats);
          if (washes) setWashTypesList(washes);
          const orderTypes = data.lists.find(
            (l) => l.key === "orderType" || l.key === "Order Type",
          )?.items;
          if (orderTypes && orderTypes.length > 0)
            setOrderTypesList(orderTypes);
        }
      },
    );

    const unsubCostOfSales = subscribeToTable<SimpleTableData>(
      "cost-as-percent-of-sales",
      (data) => {
        if (data?.rows?.length) {
          const getVal = (desc: string) => {
            const row = data.rows.find(
              (r) =>
                r.values.description?.toLowerCase().trim() ===
                desc.toLowerCase().trim(),
            );
            return row?.values.percentOfSales
              ? parseFloat(row.values.percentOfSales)
              : null;
          };

          const eds = getVal("EDS");
          const taxes = getVal("Taxes");
          const rebate = getVal("Rebate");
          const exchangeRate = getVal("Exchange Rate");
          const inlandFreight = getVal("Inland Freight");
          const localBankCharges = getVal("Local Bank Charges");
          const discountRateVal = getVal("Discount Rate");

          if (!costSheetIdParam) {
            if (eds !== null || taxes !== null) {
              const totalTaxEds = (taxes || 0) + (eds || 0);
              if (totalTaxEds > 0) setTaxEdsPct(totalTaxEds / 100);
            }
            if (exchangeRate !== null && exchangeRate > 0) {
              setParitySale(exchangeRate);
              setParityProcurement(exchangeRate);
            }
            if (rebate !== null && rebate > 0) {
              setRebatePct(rebate);
            }
            if (inlandFreight !== null && inlandFreight > 0) {
              setInlandFreightPct(inlandFreight / 100);
            }
            if (localBankCharges !== null && localBankCharges > 0) {
              setLocalBankChargesPct(localBankCharges / 100);
            }
            if (discountRateVal !== null && discountRateVal > 0) {
              setDiscountRate(discountRateVal / 100);
            }
          }
        }
      },
    );

    return () => {
      unsubDLF();
      unsubCTS();
      unsubRej();
      unsubStylesGrid();
      unsubOrderTypes();
      unsubDropdowns();
      unsubCostOfSales();
    };
  }, [styleIdParam, costSheetIdParam]);

  // Load saved snapshot if costSheetId exists
  useEffect(() => {
    if (costSheetIdParam) {
      Promise.resolve().then(() => {
        setLoadingStyles(true);
      });
      getCostSheetById(costSheetIdParam).then((sheet) => {
        if (sheet) {
          setLoadedCostSheet(sheet);

          // Reconstruct activeStyle from snapshot
          const styleFromSheet: StyleMasterItem = {
            id: sheet.styleId,
            styleName: sheet.styleName,
            customerName: sheet.customerName,
            styleCategory: sheet.styleCategory,
            orderQuantity: sheet.orderQuantity,
            smvSewing: sheet.smvSewing,
            orderType: sheet.orderType as "Denim" | "Non Denim",
            washType: sheet.washType,
            sizeBracket: sheet.calculations.sizeBracket,
            targetEfficiency: sheet.calculations.efficiency,
            rejectionPct: sheet.calculations.rejectionPct,
            baseSellingPrice: sheet.orderFOB,
            bomFabric: sheet.bomFabric || [],
            bomLining: sheet.bomLining || [],
            bomAccessories: sheet.bomAccessories || [],
            bomChemicals: sheet.bomChemicals || [],
            bomSpecialCharges: sheet.bomSpecialCharges || [],
          };
          setActiveStyle(ensureStyleBOMDefaults(styleFromSheet));
          setNewFabricRows(new Set());
          setNewLiningRows(new Set());

          // Set state inputs
          setCostingDate(sheet.costingDate);
          setCostingStage(sheet.costingStage);
          setCountry(sheet.country);
          setPaymentTerms(sheet.paymentTerms);
          setShipmentMode(sheet.shipmentMode);
          setDeliveryTerms(sheet.deliveryTerms);
          setParitySale(sheet.paritySale);
          setParityProcurement(sheet.parityProcurement);
          setManpower(sheet.manpower);

          setEfficiencyOverride(
            sheet.efficiencyOverride !== null
              ? (sheet.efficiencyOverride * 100).toString()
              : "",
          );
          setRejectionOverride(
            sheet.rejectionOverride !== null
              ? (sheet.rejectionOverride * 100).toString()
              : "",
          );
          setLineTargetOverride(
            sheet.lineTargetOverride !== null
              ? sheet.lineTargetOverride.toString()
              : "",
          );

          setDiscountRate(sheet.discountRate);
          setPaymentTermsDays(sheet.paymentTermsDays);
          setFactoringDays(sheet.factoringDays);
          setCommissionPct(sheet.commissionPct * 100);
          setForeignBankCharges(sheet.foreignBankCharges);

          const qPrice =
            sheet.quotedPrice !== undefined
              ? sheet.quotedPrice
              : sheet.orderFOB;
          const iFreight =
            sheet.intlFreight !== undefined ? sheet.intlFreight : 0;
          const iInsurance =
            sheet.intlInsurance !== undefined ? sheet.intlInsurance : 0;
          setQuotedPriceInput(qPrice ? qPrice.toString() : "");
          setIntlFreight(iFreight ? iFreight.toString() : "");
          setIntlInsurance(iInsurance ? iInsurance.toString() : "");

          // Set editable style fields from loaded sheet
          setCustomerName(sheet.customerName || "");
          setStyleCategory(sheet.styleCategory || "Top Ware");
          setWashType(sheet.washType || "Rinse");
          setOrderQuantity(sheet.orderQuantity || 0);
          setOrderType((sheet.orderType || "Denim") as "Denim" | "Non Denim");
          setSmvSewingInput(
            sheet.smvSewing !== undefined
              ? sheet.smvSewing.toString()
              : styleFromSheet.smvSewing?.toString() || "",
          );
          setNoOfColors(sheet.noOfColors !== undefined ? sheet.noOfColors : 1);
          setMerchGroup(sheet.merchGroup || "Ayaz");
          setWorkOrderNumber(sheet.workOrderNumber || "");
          setDeliveryDestination(sheet.deliveryDestination || "EURO");
          setExFactoryDate(
            sheet.exFactoryDate || new Date().toISOString().split("T")[0],
          );
          setInhouseOrSubcontract(sheet.inhouseOrSubcontract || "INHOUSE");
          setRebatePct(
            sheet.rebatePct !== undefined ? sheet.rebatePct * 100 : 0,
          );
        } else {
          toast.error("Saved Cost Sheet not found");
        }
        setLoadingStyles(false);
      });
    }
  }, [costSheetIdParam]);

  // Sync state when activeStyle changes
  useEffect(() => {
    if (activeStyle && !costSheetIdParam) {
      Promise.resolve().then(() => {
        setQuotedPriceInput(
          activeStyle.baseSellingPrice ? activeStyle.baseSellingPrice.toString() : ""
        );
        setIntlFreight("");
        setIntlInsurance("");
        setRejectionOverride("");
        setEfficiencyOverride("");
        setLineTargetOverride("");

        // Set editable style fields from activeStyle defaults
        const rawCust = activeStyle.customerName?.trim() || "";
        const matchedCust =
          customersList.find(
            (c) => c.toLowerCase() === rawCust.toLowerCase(),
          ) || rawCust;
        setCustomerName(matchedCust);
        setStyleCategory(activeStyle.styleCategory || "Top Ware");
        setWashType(activeStyle.washType || "Rinse");
        setOrderQuantity(activeStyle.orderQuantity || 0);
        setOrderType(
          (activeStyle.orderType || "Denim") as "Denim" | "Non Denim",
        );
        setSmvSewingInput(
          activeStyle.smvSewing ? activeStyle.smvSewing.toString() : ""
        );
        setNoOfColors(1);
        setMerchGroup("Ayaz");
        setDeliveryDestination("EURO");
        setExFactoryDate(() => {
          const d = new Date();
          d.setMonth(d.getMonth() + 3);
          return d.toISOString().split("T")[0];
        });
        setInhouseOrSubcontract("INHOUSE");
        setRebatePct(0);
      });
    }
  }, [activeStyle, costSheetIdParam]);

  // Adjust payment days based on payment terms dropdown
  useEffect(() => {
    const match = paymentTerms.match(/(\d+)\s*days/i);
    Promise.resolve().then(() => {
      if (match) {
        setPaymentTermsDays(parseInt(match[1], 10));
      } else if (paymentTerms.toLowerCase() === "da") {
        setPaymentTermsDays(60); // DA default is 60 in Excel model
      } else {
        setPaymentTermsDays(0);
      }
    });
  }, [paymentTerms]);

  // Keep activeStyle.bomChemicals[0].washItem in sync with washType
  useEffect(() => {
    if (
      activeStyle &&
      activeStyle.bomChemicals &&
      activeStyle.bomChemicals.length > 0
    ) {
      if (activeStyle.bomChemicals[0].washItem !== washType) {
        const nextChem = [...activeStyle.bomChemicals];
        nextChem[0] = {
          ...nextChem[0],
          washItem: washType,
        };
        Promise.resolve().then(() => {
          setActiveStyle({
            ...activeStyle,
            bomChemicals: nextChem,
          });
        });
      }
    }
  }, [washType, activeStyle]);

  // Core Style Change Logic
  function executeStyleChange(id: string) {
    setIsDirty(false);
    setNewFabricRows(new Set());
    setNewLiningRows(new Set());
    setNewAccessoryRows(new Set());
    setNewChemicalRows(new Set());
    setNewSpecialChargeRows(new Set());
    if (id === "custom" || !id) {
      setLoadedCostSheet(null);
      setActiveStyle(ensureStyleBOMDefaults(CUSTOM_STYLE));
      setWorkOrderNumber("");
      router.push("/cost-sheet?styleId=custom");
    } else {
      const woRow = indusStyleRows.find((r) => r.styleCode === id);
      const rawCust = woRow?.customer?.trim() || "";
      const matchedCust =
        customersList.find(
          (c) => c.toLowerCase() === rawCust.toLowerCase(),
        ) || rawCust || customerName;
      if (woRow) {
        setWorkOrderNumber(woRow.workOrderNo);
        setCustomerName(matchedCust);
        setOrderQuantity(woRow.poQty ?? orderQuantity);
      } else {
        setWorkOrderNumber("");
      }
      const baseStyle = ensureStyleBOMDefaults({
        ...CUSTOM_STYLE,
        id: id,
        styleName: woRow?.styleName ?? id,
        customerName: matchedCust,
        orderQuantity: woRow?.poQty ?? orderQuantity,
      });
      setLoadedCostSheet(null);
      setActiveStyle(baseStyle);
      router.push(`/cost-sheet?styleCode=${encodeURIComponent(id)}`);
      fetchIndusBOM(id).then((bom) => {
        if (!bom) return;
        const mapped = mapIndusBOMToStyle(bom);
        setActiveStyle((prev) =>
          prev
            ? {
                ...prev,
                bomFabric: mapped.bomFabric.length ? mapped.bomFabric : prev.bomFabric,
                bomLining: mapped.bomLining.length ? mapped.bomLining : prev.bomLining,
                bomAccessories: mapped.bomAccessories.length ? mapped.bomAccessories : prev.bomAccessories,
                smvSewing: mapped.smvSewing ?? prev.smvSewing,
                washType: mapped.washType ?? prev.washType,
                styleCategory: mapped.styleCategory ?? prev.styleCategory,
              }
            : prev
        );
        if (mapped.smvSewing) setSmvSewingInput(mapped.smvSewing.toString());
        if (mapped.washType) setWashType(mapped.washType);
        if (mapped.styleCategory) setStyleCategory(mapped.styleCategory);
      });
    }
  }

  // Handle active style change from dropdown with unsaved changes interception
  function handleStyleChange(id: string) {
    if (isDirtyRef.current) {
      setPendingNavigation({ type: "style", target: id });
      setUnsavedModalOpen(true);
      return;
    }
    executeStyleChange(id);
  }

  // Core Reset Logic
  function executeReset() {
    setIsDirty(false);
    if (loadedCostSheet) {
      router.push(`/cost-sheet?costSheetId=${loadedCostSheet.id}`);
      toast.info("Calculator reset to snapshot defaults");
    } else if (activeStyle) {
      setActiveStyle({ ...activeStyle });
      toast.info("Calculator reset to Style Master defaults");
    }
  }

  function handleResetClick() {
    if (isDirtyRef.current) {
      setPendingNavigation({ type: "reset" });
      setUnsavedModalOpen(true);
    } else {
      executeReset();
    }
  }

  // Proceed with pending navigation after user chooses to discard or save
  async function proceedWithPendingNavigation() {
    const nav = pendingNavigation;
    setIsDirty(false);
    setUnsavedModalOpen(false);
    setPendingNavigation(null);
    if (!nav) return;

    if (nav.type === "url" && nav.target) {
      router.push(nav.target);
    } else if (nav.type === "style" && nav.target) {
      executeStyleChange(nav.target);
    } else if (nav.type === "reset") {
      executeReset();
    }
  }

  // Save changes and proceed with pending navigation
  async function handleSaveAndProceed() {
    if (!activeStyle || !calcs) return;
    if (loadedCostSheet) {
      await handleUpdateExisting();
      if (pendingNavigation) {
        const nav = pendingNavigation;
        setIsDirty(false);
        setUnsavedModalOpen(false);
        setPendingNavigation(null);
        if (nav.type === "url" && nav.target) {
          router.push(nav.target);
        } else if (nav.type === "style" && nav.target) {
          executeStyleChange(nav.target);
        } else if (nav.type === "reset") {
          executeReset();
        }
      }
    } else {
      setUnsavedModalOpen(false);
      setSaveDialogOpen(true);
    }
  }

  // Right Panel: Local BOM edits state helpers
  function updateFabricBOM(
    idx: number,
    keyOrPatch: string | Partial<BOMFabricItem>,
    val?: string | number
  ) {
    markDirty();
    setActiveStyle((prev) => {
      if (!prev) return prev;
      const nextFab = [...(prev.bomFabric || [])];
      for (let i = 0; i <= idx; i++) {
        if (!nextFab[i]) {
          nextFab[i] = {
            itemName: `Fabric ${i + 1}`,
            consumptionPerPc: 0,
            rateUSD: 0,
            ratePKR: 0,
            fabricCostPKR: 0,
          };
        }
      }
      const patch =
        typeof keyOrPatch === "string"
          ? { [keyOrPatch]: val }
          : keyOrPatch;

      const updated = {
        ...nextFab[idx],
        ...patch,
      } as BOMFabricItem;

      const procRate = parityProcurement || 0;
      if ("rateUSD" in patch && patch.rateUSD !== undefined) {
        updated.ratePKR = Number(patch.rateUSD) * procRate;
      } else if ("ratePKR" in patch && patch.ratePKR !== undefined) {
        updated.rateUSD = procRate > 0 ? Number(patch.ratePKR) / procRate : 0;
      }
      updated.fabricCostPKR =
        (updated.consumptionPerPc || 0) * (updated.ratePKR || 0);

      nextFab[idx] = updated;
      return {
        ...prev,
        bomFabric: nextFab,
      };
    });
  }

  // Pocket Lining BOM
  function updateLiningBOM(
    idx: number,
    keyOrPatch: string | Partial<BOMLiningItem>,
    val?: string | number
  ) {
    markDirty();
    setActiveStyle((prev) => {
      if (!prev) return prev;
      const nextLin = [...(prev.bomLining || [])];
      for (let i = 0; i <= idx; i++) {
        if (!nextLin[i]) {
          nextLin[i] = {
            itemName: `Lining ${i + 1}`,
            consumptionPerPc: 0,
            rateUSD: 0,
            ratePKR: 0,
            liningCostPKR: 0,
          };
        }
      }
      const patch =
        typeof keyOrPatch === "string"
          ? { [keyOrPatch]: val }
          : keyOrPatch;

      const updated = {
        ...nextLin[idx],
        ...patch,
      } as BOMLiningItem;

      const procRate = parityProcurement || 0;
      if ("rateUSD" in patch && patch.rateUSD !== undefined) {
        updated.ratePKR = Number(patch.rateUSD) * procRate;
      } else if ("ratePKR" in patch && patch.ratePKR !== undefined) {
        updated.rateUSD = procRate > 0 ? Number(patch.ratePKR) / procRate : 0;
      }
      updated.liningCostPKR =
        (updated.consumptionPerPc || 0) * (updated.ratePKR || 0);

      nextLin[idx] = updated;
      return {
        ...prev,
        bomLining: nextLin,
      };
    });
  }

  function updateAccessoriesBOM(
    idx: number,
    keyOrPatch: string | Partial<BOMAccessoriesItem>,
    val?: string | number
  ) {
    markDirty();
    setActiveStyle((prev) => {
      if (!prev) return prev;
      const nextAcc = [...(prev.bomAccessories || [])];
      for (let i = 0; i <= idx; i++) {
        if (!nextAcc[i]) {
          nextAcc[i] = {
            category: "Trims",
            itemName: "",
            consPerPc: 0,
            ratePKR: 0,
            rateUSD: 0,
            totalCostPKR: 0,
          };
        }
      }
      const patch =
        typeof keyOrPatch === "string"
          ? { [keyOrPatch]: val }
          : keyOrPatch;

      const updated = {
        ...nextAcc[idx],
        ...patch,
      } as BOMAccessoriesItem;

      const procRateAcc = parityProcurement || 0;
      if ("rateUSD" in patch && patch.rateUSD !== undefined) {
        updated.ratePKR = Number(patch.rateUSD) * procRateAcc;
      } else if ("ratePKR" in patch && patch.ratePKR !== undefined) {
        updated.rateUSD = procRateAcc > 0 ? Number(patch.ratePKR) / procRateAcc : 0;
      }

      updated.totalCostPKR =
        (updated.consPerPc || 0) * (updated.ratePKR || 0);

      nextAcc[idx] = updated;
      return {
        ...prev,
        bomAccessories: nextAcc,
      };
    });
  }

  function updateChemicalsBOM(
    idx: number,
    keyOrPatch: string | Partial<BOMChemicalsItem>,
    val?: string | number
  ) {
    markDirty();
    setActiveStyle((prev) => {
      if (!prev) return prev;
      const nextChem = [...(prev.bomChemicals || [])];
      for (let i = 0; i <= idx; i++) {
        if (!nextChem[i]) {
          nextChem[i] = {
            washItem: "",
            consPerPc: 1,
            ratePKR: 0,
            rateUSD: 0,
            totalCostPKR: 0,
          };
        }
      }
      const patch =
        typeof keyOrPatch === "string"
          ? { [keyOrPatch]: val }
          : keyOrPatch;

      const updated = {
        ...nextChem[idx],
        ...patch,
      } as BOMChemicalsItem;

      const procRateChem = parityProcurement || 0;
      if ("rateUSD" in patch && patch.rateUSD !== undefined) {
        updated.ratePKR = Number(patch.rateUSD) * procRateChem;
      } else if ("ratePKR" in patch && patch.ratePKR !== undefined) {
        updated.rateUSD = procRateChem > 0 ? Number(patch.ratePKR) / procRateChem : 0;
      }

      updated.consPerPc = 1;
      updated.totalCostPKR = updated.ratePKR || 0;

      nextChem[idx] = updated;
      return {
        ...prev,
        bomChemicals: nextChem,
      };
    });
  }

  function updateSpecialChargesBOM(
    idx: number,
    keyOrPatch: string | Partial<BOMSpecialChargesItem>,
    val?: string | number
  ) {
    markDirty();
    setActiveStyle((prev) => {
      if (!prev) return prev;
      const nextChg = [...(prev.bomSpecialCharges || [])];
      for (let i = 0; i <= idx; i++) {
        if (!nextChg[i]) {
          nextChg[i] = {
            itemName: "",
            consPerPc: 1,
            ratePKR: 0,
            rateUSD: 0,
            totalCostPKR: 0,
          };
        }
      }
      const patch =
        typeof keyOrPatch === "string"
          ? { [keyOrPatch]: val }
          : keyOrPatch;

      const updated = {
        ...nextChg[idx],
        ...patch,
      } as BOMSpecialChargesItem;

      const procRateChg = parityProcurement || 0;
      if ("rateUSD" in patch && patch.rateUSD !== undefined) {
        updated.ratePKR = Number(patch.rateUSD) * procRateChg;
      } else if ("ratePKR" in patch && patch.ratePKR !== undefined) {
        updated.rateUSD = procRateChg > 0 ? Number(patch.ratePKR) / procRateChg : 0;
      }

      updated.consPerPc = 1;
      updated.totalCostPKR = updated.ratePKR || 0;

      nextChg[idx] = updated;
      return {
        ...prev,
        bomSpecialCharges: nextChg,
      };
    });
  }

  // Save new snapshot
  async function handleSaveNew(name: string) {
    if (!activeStyle || !calcs) return;
    if (!name.trim()) {
      toast.error("Please enter a scenario reference name");
      return;
    }

    setIsSaving(true);
    const nextId = await getNextCostSheetId(activeStyle.id);
    const snapshot: SavedCostSheetItem = {
      id: nextId,
      referenceName: name,
      styleId: activeStyle.id,
      styleName: activeStyle.styleName,
      customerName,
      styleCategory,
      orderQuantity,
      smvSewing: parseFloat(smvSewingInput) || activeStyle.smvSewing,
      orderType,
      washType,
      noOfColors,
      merchGroup,
      workOrderNumber,
      deliveryDestination,
      exFactoryDate,
      inhouseOrSubcontract,
      rebatePct: rebatePct / 100,

      costingDate,
      costingStage,
      country,
      paymentTerms,
      shipmentMode,
      deliveryTerms,
      paritySale: paritySale ?? 0,
      parityProcurement: parityProcurement ?? 0,
      manpower,
      efficiencyOverride:
        efficiencyOverride !== "" ? parseFloat(efficiencyOverride) / 100 : null,
      rejectionOverride:
        rejectionOverride !== "" ? parseFloat(rejectionOverride) / 100 : null,
      lineTargetOverride:
        lineTargetOverride !== "" ? parseFloat(lineTargetOverride) : null,

      discountRate,
      paymentTermsDays,
      factoringDays,
      commissionPct: commissionPct / 100,
      foreignBankCharges,
      orderFOB: (() => {
        const q =
          quotedPriceInput !== ""
            ? parseFloat(quotedPriceInput)
            : activeStyle.baseSellingPrice;
        const f = parseFloat(intlFreight) || 0;
        const i = parseFloat(intlInsurance) || 0;
        if (deliveryTerms === "CFR") return q - f;
        if (deliveryTerms === "CIF" || deliveryTerms === "DDP/LDP")
          return q - f - i;
        return q;
      })(),
      quotedPrice:
        quotedPriceInput !== ""
          ? parseFloat(quotedPriceInput)
          : activeStyle.baseSellingPrice,
      intlFreight: parseFloat(intlFreight) || 0,
      intlInsurance: parseFloat(intlInsurance) || 0,

      bomFabric: activeStyle.bomFabric,
      bomLining: activeStyle.bomLining,
      bomAccessories: activeStyle.bomAccessories,
      bomChemicals: activeStyle.bomChemicals,
      bomSpecialCharges: activeStyle.bomSpecialCharges,

      calculations: {
        targetFobUSD: calcs.targetFobUSD,
        orderFobUSD: calcs.sellingPriceUSD,
        cmUSD: calcs.cmUSD,
        cmMinuteUSD: calcs.cmMinuteUSD,
        ebitdaUSD: calcs.ebitdaUSD,
        ebitdaMinCents: calcs.ebitdaMinCents,
        netProfitUSD: calcs.netProfitUSD,
        netProfitPct: calcs.netProfitPct,
        sizeBracket: calcs.sizeBracket,
        styleCategoryClass: calcs.styleCategory,
        efficiency: calcs.efficiency,
        rejectionPct: calcs.rejectionPct,
        lineTarget: calcs.lineTarget,
      },
      savedAt: new Date().toISOString(),
    };

    try {
      await saveCostSheet(snapshot);
      setLoadedCostSheet(snapshot);
      setSaveDialogOpen(false);
      setNewSnapshotName("");
      toast.success(`Cost Sheet snapshot "${name}" saved successfully`);
      setIsDirty(false);

      if (pendingNavigation) {
        const nav = pendingNavigation;
        setPendingNavigation(null);
        if (nav.type === "url" && nav.target) {
          router.push(nav.target);
        } else if (nav.type === "style" && nav.target) {
          executeStyleChange(nav.target);
        } else if (nav.type === "reset") {
          executeReset();
        }
      } else {
        router.push(`/cost-sheet?costSheetId=${nextId}`);
      }
    } catch (e) {
      toast.error("Failed to save cost sheet");
    } finally {
      setIsSaving(false);
    }
  }

  // Update existing snapshot
  async function handleUpdateExisting() {
    if (!activeStyle || !calcs || !loadedCostSheet) return;

    setIsSaving(true);
    const snapshot: SavedCostSheetItem = {
      ...loadedCostSheet,
      customerName,
      styleCategory,
      orderQuantity,
      smvSewing: parseFloat(smvSewingInput) || loadedCostSheet.smvSewing,
      orderType,
      washType,
      noOfColors,
      merchGroup,
      workOrderNumber,
      deliveryDestination,
      exFactoryDate,
      inhouseOrSubcontract,
      rebatePct: rebatePct / 100,
      costingDate,
      costingStage,
      country,
      paymentTerms,
      shipmentMode,
      deliveryTerms,
      paritySale: paritySale ?? 0,
      parityProcurement: parityProcurement ?? 0,
      manpower,
      efficiencyOverride:
        efficiencyOverride !== "" ? parseFloat(efficiencyOverride) / 100 : null,
      rejectionOverride:
        rejectionOverride !== "" ? parseFloat(rejectionOverride) / 100 : null,
      lineTargetOverride:
        lineTargetOverride !== "" ? parseFloat(lineTargetOverride) : null,

      discountRate,
      paymentTermsDays,
      factoringDays,
      commissionPct: commissionPct / 100,
      foreignBankCharges,
      orderFOB: (() => {
        const q =
          quotedPriceInput !== ""
            ? parseFloat(quotedPriceInput)
            : activeStyle.baseSellingPrice;
        const f = parseFloat(intlFreight) || 0;
        const i = parseFloat(intlInsurance) || 0;
        if (deliveryTerms === "CFR") return q - f;
        if (deliveryTerms === "CIF" || deliveryTerms === "DDP/LDP")
          return q - f - i;
        return q;
      })(),
      quotedPrice:
        quotedPriceInput !== ""
          ? parseFloat(quotedPriceInput)
          : activeStyle.baseSellingPrice,
      intlFreight: parseFloat(intlFreight) || 0,
      intlInsurance: parseFloat(intlInsurance) || 0,

      bomFabric: activeStyle.bomFabric,
      bomLining: activeStyle.bomLining,
      bomAccessories: activeStyle.bomAccessories,
      bomChemicals: activeStyle.bomChemicals,
      bomSpecialCharges: activeStyle.bomSpecialCharges,

      calculations: {
        targetFobUSD: calcs.targetFobUSD,
        orderFobUSD: calcs.sellingPriceUSD,
        cmUSD: calcs.cmUSD,
        cmMinuteUSD: calcs.cmMinuteUSD,
        ebitdaUSD: calcs.ebitdaUSD,
        ebitdaMinCents: calcs.ebitdaMinCents,
        netProfitUSD: calcs.netProfitUSD,
        netProfitPct: calcs.netProfitPct,
        sizeBracket: calcs.sizeBracket,
        styleCategoryClass: calcs.styleCategory,
        efficiency: calcs.efficiency,
        rejectionPct: calcs.rejectionPct,
        lineTarget: calcs.lineTarget,
      },
      savedAt: new Date().toISOString(),
    };

    try {
      await saveCostSheet(snapshot);
      setLoadedCostSheet(snapshot);
      toast.success("Saved Cost Sheet updated successfully");
      setIsDirty(false);
    } catch (e) {
      toast.error("Failed to update cost sheet");
    } finally {
      setIsSaving(false);
    }
  }

  // Reactive Calculation Engine
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const calcs = useMemo(() => {
    if (!activeStyle) return null;

    const effOv =
      efficiencyOverride !== "" ? parseFloat(efficiencyOverride) / 100 : null;
    const rejOv =
      rejectionOverride !== "" ? parseFloat(rejectionOverride) / 100 : null;
    const tgtOv =
      lineTargetOverride !== "" ? parseFloat(lineTargetOverride) : null;

    const qPrice =
      quotedPriceInput !== ""
        ? parseFloat(quotedPriceInput)
        : activeStyle.baseSellingPrice;
    const fVal = parseFloat(intlFreight) || 0;
    const iVal = parseFloat(intlInsurance) || 0;
    let calculatedOrderFOB = qPrice;
    if (deliveryTerms === "CFR") {
      calculatedOrderFOB = qPrice - fVal;
    } else if (deliveryTerms === "CIF" || deliveryTerms === "DDP/LDP") {
      calculatedOrderFOB = qPrice - fVal - iVal;
    }

    // Create overridden style item with live inputs
    const overriddenStyle: StyleMasterItem = {
      ...activeStyle,
      customerName,
      styleCategory,
      washType,
      orderQuantity,
      orderType,
      smvSewing: parseFloat(smvSewingInput) || activeStyle.smvSewing,
    };

    return runFormulaEngine(
      overriddenStyle,
      {
        orderFOB: calculatedOrderFOB,
        paritySale: paritySale ?? 0,
        parityProcurement: parityProcurement ?? 0,
        manpower,
        efficiencyOverride: effOv,
        rejectionOverride: rejOv,
        lineTargetOverride: tgtOv,
        costingStage,
        paymentTerms,
        discountRate,
        paymentTermsDays,
        factoringDays,
        commissionPct: commissionPct / 100,
        foreignBankCharges,
        taxEdsPct,
        inlandFreightPct,
        localBankChargesPct,
        inhouseOrSubcontract,
        rebatePct: rebatePct / 100,
      },
      {
        directLabourFoh,
        cutToShipGrid,
        rejectionGrid,
        stylesCategoryGrid,
      },
    );
  }, [
    activeStyle,
    customerName,
    styleCategory,
    washType,
    orderQuantity,
    orderType,
    quotedPriceInput,
    intlFreight,
    intlInsurance,
    deliveryTerms,
    paritySale,
    parityProcurement,
    manpower,
    efficiencyOverride,
    rejectionOverride,
    lineTargetOverride,
    costingStage,
    paymentTerms,
    discountRate,
    taxEdsPct,
    inlandFreightPct,
    localBankChargesPct,
    paymentTermsDays,
    factoringDays,
    commissionPct,
    foreignBankCharges,
    inhouseOrSubcontract,
    rebatePct,
    directLabourFoh,
    cutToShipGrid,
    rejectionGrid,
    stylesCategoryGrid,
    smvSewingInput,
  ]);

  if (loadingStyles || !activeStyle || !calcs) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Loading Cost Sheet calculator…
      </div>
    );
  }

  // Helper formatting classes
  const isProfitPositive = calcs.netProfitUSD >= 0;
  const isEbitdaPositive = calcs.ebitdaUSD >= 0;
  const isDbSelected = Boolean(
    activeStyle && activeStyle.id && activeStyle.id !== "custom"
  );
  const bomCostUSD =
    calcs.fabricCostUSD +
    calcs.liningCostUSD +
    calcs.accessoriesCostUSD +
    calcs.chemicalsCostUSD +
    calcs.specialChargesCostUSD;

  return (
    <div
      onChangeCapture={markDirty}
      onInputCapture={markDirty}
      className="space-y-6 max-w-7xl mx-auto"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Cost Sheet Calculator
            </h1>
            {loadedCostSheet && (
              <Badge
                variant="outline"
                className="text-xs border-blue-200 bg-blue-50 text-blue-800 font-semibold px-2.5 py-1 rounded-md"
              >
                Snapshot: {loadedCostSheet.id} ({loadedCostSheet.referenceName})
              </Badge>
            )}
            {isDirty && (
              <Badge
                variant="outline"
                className="text-xs border-amber-300 bg-amber-50 text-amber-800 font-semibold px-2.5 py-1 rounded-md flex items-center gap-1.5 shadow-sm"
              >
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Unsaved Changes
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time interactive order costing dashboard connected directly
            with style specifications and factory overheads.
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-9"
          >
            <Printer className="mr-1.5 size-4" /> Print
          </Button>
          {loadedCostSheet && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const targetUrl = `/cost-sheet?styleId=${activeStyle.id}`;
                if (isDirtyRef.current) {
                  setPendingNavigation({ type: "url", target: targetUrl });
                  setUnsavedModalOpen(true);
                } else {
                  setLoadedCostSheet(null);
                  router.push(targetUrl);
                }
              }}
              className="h-9"
            >
              Exit Snapshot Mode
            </Button>
          )}
        </div>
      </div>{" "}
      {/* ZONE 1: 4-COLUMN PARAMETERS SPREADSHEET LAYOUT */}
      <Card className="shadow-sm border-slate-200/85 bg-white dark:bg-slate-900 overflow-visible">
        <div className="bg-blue-50/50 dark:bg-slate-800/45 px-4 py-2.5 border-b border-slate-200/80 rounded-t-xl">
          <h2 className="text-xs font-bold text-blue-900/85 dark:text-blue-300 uppercase tracking-wider">
            📊 Pre-Order Cost Sheet Header
          </h2>
        </div>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 text-xs">
            {/* COLUMN 1: Basic Style & Quantity Specs */}
            <div className="space-y-2.5">
              <div className="font-bold text-blue-900/80 dark:text-blue-300 uppercase tracking-wide border-b border-slate-100 pb-1 mb-1">
                Style &amp; Qty Specs
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Costing Date
                </span>
                <input
                  type="date"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={costingDate}
                  onChange={(e) => setCostingDate(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Customer Name:
                </span>
                <input
                  type="text"
                  disabled={isDbSelected}
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none disabled:bg-slate-200/60 disabled:text-slate-500 disabled:cursor-not-allowed"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Order Type
                </span>
                <input
                  type="text"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={orderType}
                  onChange={(e) =>
                    setOrderType(e.target.value as "Denim" | "Non Denim")
                  }
                />
              </div>

              {/* ── Style Select ──────────────────────────── */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Style Select
                </span>
                <SearchableSelect
                  className="w-32"
                  placeholder="Search style…"
                  value={activeStyle.id === "custom" ? "" : activeStyle.id}
                  onChange={(val) => {
                    handleStyleChange(val || "custom");
                  }}
                  options={[
                    { value: "custom", label: "-- Custom Style --" },
                    // Indus-plus styles from SQL Server (deduplicated by StyleCode)
                    ...Array.from(
                      new Map(indusStyleRows.map((r) => [r.styleCode, r])).values()
                    ).map((r) => ({
                      value: r.styleCode,
                      label: `${r.styleCode}${r.styleName ? ` — ${r.styleName}` : ""}${r.customer ? ` (${r.customer})` : ""}`,
                    })),
                  ]}
                />
              </div>

              {/* ── Work Order No. ────────────────────────── */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Work Order No.
                </span>
                <SearchableSelect
                  className="w-32"
                  placeholder="Search WO…"
                  value={workOrderNumber}
                  onChange={(id) => {
                    setWorkOrderNumber(id);
                    if (!id) return;
                    // If from indus-plus, sync style code
                    const indusWO = indusStyleRows.find((r) => r.workOrderNo === id);
                    if (indusWO) {
                      const rawCust = indusWO.customer?.trim() || "";
                      const matchedCust =
                        customersList.find(
                          (c) => c.toLowerCase() === rawCust.toLowerCase(),
                        ) || rawCust || customerName;
                      setCustomerName(matchedCust);
                      setOrderQuantity(indusWO.poQty ?? orderQuantity);
                      const baseStyle = ensureStyleBOMDefaults({
                        ...CUSTOM_STYLE,
                        id: indusWO.styleCode,
                        styleName: indusWO.styleName,
                        customerName: matchedCust,
                        orderQuantity: indusWO.poQty ?? orderQuantity,
                      });
                      setActiveStyle(baseStyle);
                      // Async: fetch BOM from indus-plus and merge
                      fetchIndusBOM(indusWO.styleCode).then((bom) => {
                        if (!bom) return;
                        const mapped = mapIndusBOMToStyle(bom);
                        setActiveStyle((prev) =>
                          prev
                            ? {
                                ...prev,
                                bomFabric: mapped.bomFabric.length ? mapped.bomFabric : prev.bomFabric,
                                bomLining: mapped.bomLining.length ? mapped.bomLining : prev.bomLining,
                                bomAccessories: mapped.bomAccessories.length ? mapped.bomAccessories : prev.bomAccessories,
                                smvSewing: mapped.smvSewing ?? prev.smvSewing,
                                washType: mapped.washType ?? prev.washType,
                                styleCategory: mapped.styleCategory ?? prev.styleCategory,
                              }
                            : prev
                        );
                        if (mapped.smvSewing) setSmvSewingInput(mapped.smvSewing.toString());
                        if (mapped.washType) setWashType(mapped.washType);
                        if (mapped.styleCategory) setStyleCategory(mapped.styleCategory);
                      });
                    }
                  }}
                  options={[
                    { value: "", label: "-- Select --" },
                    // Indus-plus WOs — deduplicated by workOrderNo, filtered to current style if chosen
                    ...Array.from(
                      new Map(
                        indusStyleRows
                          .filter((r) =>
                            !activeStyle?.id || activeStyle.id === "custom" || activeStyle.id === ""
                              ? true
                              : r.styleCode === activeStyle.id
                          )
                          .map((r) => [r.workOrderNo, r])
                      ).values()
                    ).map((r) => ({
                      value: r.workOrderNo,
                      label: `${r.workOrderNo}${r.styleName ? ` — ${r.styleName}` : ""}${r.customer ? ` (${r.customer})` : ""}`,
                    })),
                  ]}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Style Category
                </span>
                <input
                  type="text"
                  disabled={isDbSelected}
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none disabled:bg-slate-200/60 disabled:text-slate-500 disabled:cursor-not-allowed"
                  value={styleCategory}
                  onChange={(e) => setStyleCategory(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Order Size
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 pr-2">
                  {calcs.sizeBracket}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Order Quantity pcs
                </span>
                <input
                  type="number"
                  disabled={isDbSelected}
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none disabled:bg-slate-200/60 disabled:text-slate-500 disabled:cursor-not-allowed"
                  value={orderQuantity || ""}
                  onChange={(e) => setOrderQuantity(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Per Color Quantity pcs
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 pr-2">
                  {Math.round(orderQuantity / noOfColors)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  No of Color
                </span>
                <input
                  type="number"
                  min="1"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={noOfColors}
                  onChange={(e) =>
                    setNoOfColors(Math.max(1, Number(e.target.value)))
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Wash Type:
                </span>
                <input
                  type="text"
                  disabled={isDbSelected}
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none disabled:bg-slate-200/60 disabled:text-slate-500 disabled:cursor-not-allowed"
                  value={washType}
                  onChange={(e) => setWashType(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Rejection %
                </span>
                <input
                  type="number"
                  step="0.01"
                  className="w-32 h-7 px-2 text-xs border border-yellow-200 bg-yellow-50/70 hover:bg-yellow-50 font-bold text-yellow-900 rounded text-right focus:bg-white focus:outline-none"
                  placeholder={`${(calcs.rejectionPct * 100).toFixed(2)}%`}
                  value={rejectionOverride}
                  onChange={(e) => setRejectionOverride(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Ex fty Date(mm/dd/yy)
                </span>
                <input
                  type="date"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={exFactoryDate}
                  onChange={(e) => setExFactoryDate(e.target.value)}
                />
              </div>
            </div>

            {/* COLUMN 2: Logistics & Commercial Parameters */}
            <div className="space-y-2.5">
              <div className="font-bold text-blue-900/80 dark:text-blue-300 uppercase tracking-wide border-b border-slate-100 pb-1 mb-1">
                Logistics &amp; Commercial
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Current Date
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 pr-2">
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Costing Stage
                </span>
                <input
                  type="text"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={costingStage}
                  onChange={(e) => setCostingStage(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Country
                </span>
                <input
                  type="text"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Payment Terms
                </span>
                <input
                  type="text"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Shipment mode
                </span>
                <input
                  type="text"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={shipmentMode}
                  onChange={(e) => setShipmentMode(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Delivery terms
                </span>
                <input
                  type="text"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Merch_Group
                </span>
                <input
                  type="text"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={merchGroup}
                  onChange={(e) => setMerchGroup(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Delv. Destination
                </span>
                <input
                  type="text"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={deliveryDestination}
                  onChange={(e) => setDeliveryDestination(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Parity-Sale
                </span>
                <input
                  type="number"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={paritySale || ""}
                  onChange={(e) => setParitySale(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Parity-Procurement
                </span>
                <input
                  type="number"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={parityProcurement || ""}
                  onChange={(e) => setParityProcurement(Number(e.target.value))}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Inhouse/Sub-contract
                </span>
                <input
                  type="text"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={inhouseOrSubcontract}
                  onChange={(e) => setInhouseOrSubcontract(e.target.value)}
                />
              </div>
            </div>

            {/* COLUMNS 3+4: FOB/CM Targets & Profitability. A single 2-col grid so each row is
                shared by both columns and rows (incl. the divider) align by construction. */}
            <div className="xl:col-span-2 grid grid-cols-2 gap-x-6 gap-y-2.5 items-center xl:border-l xl:border-slate-700 xl:pl-6 dark:xl:border-slate-700">
              <div className="font-bold text-blue-900/80 dark:text-blue-300 uppercase tracking-wide border-b border-slate-100 pb-1 mb-1">
                FOB / CM &amp; Labor Metrics
              </div>
              <div className="font-bold text-blue-900/80 dark:text-blue-300 uppercase tracking-wide border-b border-slate-100 pb-1 mb-1">
                Profitability &amp; Financial Rates
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Target FOB/PC
                </span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 pr-2">
                  US$ {calcs.targetFobUSD.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  EBITDA/Min-Cents
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 pr-2">
                  {(
                    (calcs.ebitdaUSD * 100) /
                    (parseFloat(smvSewingInput) || 1)
                  ).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Order FOB/PC
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400 font-semibold">US$</span>
                  <input
                    type="number"
                    step="0.01"
                    className="w-24 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-extrabold text-slate-900 rounded text-right focus:bg-white focus:outline-none transition-colors"
                    value={quotedPriceInput}
                    onChange={(e) => setQuotedPriceInput(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  EBITDA/PC
                </span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 pr-2">
                  US$ {calcs.ebitdaUSD.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Order CM/PC
                </span>
                <span className="font-extrabold text-slate-800 dark:text-slate-200 pr-2">
                  US$ {calcs.cmUSD.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Net Profit/Min-Cents
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 pr-2">
                  {(
                    (calcs.netProfitUSD * 100) /
                    (parseFloat(smvSewingInput) || 1)
                  ).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Target CM/SMV-Cents
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 pr-2">
                  {(
                    ((calcs.targetFobUSD - bomCostUSD) * 100) /
                    (parseFloat(smvSewingInput) || 1)
                  ).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Net Profit/PC
                </span>
                <span
                  className={`font-extrabold pr-2 ${isProfitPositive ? "text-green-600 dark:text-green-400" : "text-red-600"}`}
                >
                  US$ {calcs.netProfitUSD.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Order CM-SMV-Cents
                </span>
                <span className="font-bold text-slate-800 dark:text-slate-200 pr-2">
                  {(
                    (calcs.cmUSD * 100) /
                    (parseFloat(smvSewingInput) || 1)
                  ).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Net Profit % on FOB
                </span>
                <span
                  className={`font-extrabold pr-2 ${isProfitPositive ? "text-green-600 dark:text-green-400" : "text-red-600"}`}
                >
                  {(calcs.netProfitPct * 100).toFixed(2)}%
                </span>
              </div>

              <div className="border-t border-slate-700 self-end" />
              <div className="border-t border-slate-700 self-end" />

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">SMV</span>
                <input
                  type="number"
                  step="0.01"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={smvSewingInput}
                  onChange={(e) => setSmvSewingInput(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Commission %
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    className="w-24 h-7 px-2 text-xs border border-yellow-250 bg-yellow-50/70 hover:bg-yellow-50 text-yellow-900 font-bold rounded text-right focus:bg-white focus:outline-none"
                    value={
                      commissionPct ? (commissionPct * 100).toFixed(2) : ""
                    }
                    onChange={(e) =>
                      setCommissionPct(Number(e.target.value) / 100)
                    }
                  />
                  <span className="text-yellow-750 font-bold">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Manpower Per Line
                </span>
                <input
                  type="number"
                  className="w-32 h-7 px-2 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-right focus:bg-white focus:outline-none"
                  value={manpower || ""}
                  onChange={(e) => setManpower(Number(e.target.value))}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Tax &amp; EDS
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    className="w-24 h-7 px-2 text-xs border border-yellow-250 bg-yellow-50/70 hover:bg-yellow-50 text-yellow-900 font-bold rounded text-right focus:bg-white focus:outline-none"
                    value={taxEdsPct ? (taxEdsPct * 100).toFixed(2) : ""}
                    onChange={(e) => setTaxEdsPct(Number(e.target.value) / 100)}
                  />
                  <span className="text-yellow-750 font-bold">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Avg. Efficiency
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.1"
                    className="w-28 h-7 px-2 text-xs border border-yellow-250 bg-yellow-50/70 hover:bg-yellow-50 font-bold text-yellow-900 rounded text-right focus:bg-white focus:outline-none"
                    placeholder={`${(calcs.efficiency * 100).toFixed(1)}%`}
                    value={efficiencyOverride}
                    onChange={(e) => setEfficiencyOverride(e.target.value)}
                  />
                  <span className="text-yellow-700 font-bold">%</span>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Inland Freight &amp; Clearing
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    className="w-24 h-7 px-2 text-xs border border-yellow-250 bg-yellow-50/70 hover:bg-yellow-50 text-yellow-900 font-bold rounded text-right focus:bg-white focus:outline-none"
                    value={
                      inlandFreightPct
                        ? (inlandFreightPct * 100).toFixed(2)
                        : ""
                    }
                    onChange={(e) =>
                      setInlandFreightPct(Number(e.target.value) / 100)
                    }
                  />
                  <span className="text-yellow-750 font-bold">%</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Avg. Line Target
                </span>
                <input
                  type="number"
                  className="w-32 h-7 px-2 text-xs border border-yellow-250 bg-yellow-50/70 hover:bg-yellow-50 font-bold text-yellow-900 rounded text-right focus:bg-white focus:outline-none"
                  placeholder={`${calcs.lineTarget.toFixed(0)}`}
                  value={lineTargetOverride}
                  onChange={(e) => setLineTargetOverride(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground">
                  Local Bank Charges
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    className="w-24 h-7 px-2 text-xs border border-yellow-250 bg-yellow-50/70 hover:bg-yellow-50 text-yellow-900 font-bold rounded text-right focus:bg-white focus:outline-none"
                    value={
                      localBankChargesPct
                        ? (localBankChargesPct * 100).toFixed(2)
                        : ""
                    }
                    onChange={(e) =>
                      setLocalBankChargesPct(Number(e.target.value) / 100)
                    }
                  />
                  <span className="text-yellow-750 font-bold">%</span>
                </div>
              </div>

              <div />
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-muted-foreground font-bold text-yellow-950">
                  Discount Rate
                </span>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step="0.01"
                    className="w-24 h-7 px-2 text-xs border border-yellow-300 bg-yellow-50/70 hover:bg-yellow-50 text-yellow-900 font-bold rounded text-right focus:bg-white focus:outline-none"
                    value={discountRate ? (discountRate * 100).toFixed(0) : ""}
                    onChange={(e) =>
                      setDiscountRate(Number(e.target.value) / 100)
                    }
                  />
                  <span className="text-yellow-700 font-bold">%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* ZONE 2: KPI PROFITABILITY HEADER CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-10 gap-3">
        <Card className="shadow-sm border-muted/50">
          <CardContent className="p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              Target FOB
            </span>
            <p className="text-lg font-extrabold text-foreground mt-0.5">
              ${calcs.targetFobUSD.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-muted/50 bg-blue-50/10 border-blue-100">
          <CardContent className="p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-300">
              {deliveryTerms === "FOB"
                ? "Order FOB"
                : `Quoted Price (${deliveryTerms})`}
            </span>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <span className="text-xs font-bold text-muted-foreground">$</span>
              <input
                type="number"
                step="0.01"
                className="w-16 font-extrabold text-lg bg-transparent border-b border-dashed border-blue-400 text-center focus:outline-none"
                value={quotedPriceInput}
                onChange={(e) => setQuotedPriceInput(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
        {deliveryTerms !== "FOB" && (
          <Card className="shadow-sm border-muted/50 bg-blue-50/10 border-blue-100 animate-in fade-in duration-200">
            <CardContent className="p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-300">
                Intl. Freight/Pc
              </span>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span className="text-xs font-bold text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  className="w-16 font-extrabold text-lg bg-transparent border-b border-dashed border-blue-400 text-center focus:outline-none"
                  value={intlFreight}
                  onChange={(e) => setIntlFreight(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}
        {(deliveryTerms === "CIF" || deliveryTerms === "DDP/LDP") && (
          <Card className="shadow-sm border-muted/50 bg-blue-50/10 border-blue-100 animate-in fade-in duration-200">
            <CardContent className="p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-300">
                Intl. Insurance/Pc
              </span>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span className="text-xs font-bold text-muted-foreground">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  className="w-16 font-extrabold text-lg bg-transparent border-b border-dashed border-blue-400 text-center focus:outline-none"
                  value={intlInsurance}
                  onChange={(e) => setIntlInsurance(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        )}
        {deliveryTerms !== "FOB" && (
          <Card className="shadow-sm border-muted/50 bg-slate-50 border-slate-200">
            <CardContent className="p-3 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500">
                Net Order FOB
              </span>
              <p className="text-lg font-extrabold text-slate-800 mt-0.5">
                ${calcs.sellingPriceUSD.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        )}
        <Card className="shadow-sm border-muted/50">
          <CardContent className="p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              Order CM/PC
            </span>
            <p className="text-lg font-extrabold text-foreground mt-0.5">
              $
              {(quotedPriceInput === "" || parseFloat(quotedPriceInput) === 0
                ? 0
                : calcs.cmUSD
              ).toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-muted/50">
          <CardContent className="p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">
              Order CM/SMV
            </span>
            <p className="text-lg font-extrabold text-foreground mt-0.5">
              {(quotedPriceInput === "" || parseFloat(quotedPriceInput) === 0
                ? 0
                : calcs.cmMinuteUSD
              ).toFixed(2)}
              ¢
            </p>
          </CardContent>
        </Card>
        <Card
          className={`shadow-sm transition-colors border-muted/50 ${isEbitdaPositive ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200" : "bg-red-50/50 dark:bg-red-950/20 border-red-200"}`}
        >
          <CardContent className="p-3 text-center">
            <span
              className={`text-[10px] uppercase font-bold ${isEbitdaPositive ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}
            >
              EBITDA / Min
            </span>
            <p
              className={`text-lg font-extrabold mt-0.5 ${isEbitdaPositive ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}
            >
              {(quotedPriceInput === "" || parseFloat(quotedPriceInput) === 0
                ? 0
                : calcs.ebitdaMinCents
              ).toFixed(2)}
              ¢
            </p>
          </CardContent>
        </Card>
        <Card
          className={`shadow-sm transition-colors border-muted/50 ${isProfitPositive ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200" : "bg-red-50/50 dark:bg-red-950/20 border-red-200"}`}
        >
          <CardContent className="p-3 text-center">
            <span
              className={`text-[10px] uppercase font-bold ${isProfitPositive ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}
            >
              Net Profit/PC
            </span>
            <p
              className={`text-lg font-extrabold mt-0.5 ${isProfitPositive ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}
            >
              $
              {(quotedPriceInput === "" || parseFloat(quotedPriceInput) === 0
                ? 0
                : calcs.netProfitUSD
              ).toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card
          className={`shadow-sm transition-colors border-muted/50 ${isProfitPositive ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200" : "bg-red-50/50 dark:bg-red-950/20 border-red-200"}`}
        >
          <CardContent className="p-3 text-center">
            <span
              className={`text-[10px] uppercase font-bold ${isProfitPositive ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}
            >
              Net Profit %
            </span>
            <p
              className={`text-lg font-extrabold mt-0.5 ${isProfitPositive ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}
            >
              {(
                (quotedPriceInput === "" || parseFloat(quotedPriceInput) === 0
                  ? 0
                  : calcs.netProfitPct) * 100
              ).toFixed(2)}
              %
            </p>
          </CardContent>
        </Card>
      </div>
      {/* ZONE 3: SPLIT PANEL VIEW */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT PANEL: FINANCIAL SUMMARY TABLE */}
        <Card className="lg:col-span-5 shadow-md border-muted/60 bg-card overflow-hidden">
          <div className="bg-muted/40 p-4 border-b flex justify-between items-center">
            <h2 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
              <Calculator className="size-4 text-primary" /> Cost &
              Profitability Summary
            </h2>
            <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 font-semibold px-2 py-0.5 rounded-full">
              Per Pc Calculations
            </span>
          </div>
          <CardContent className="p-0 text-xs">
            {(() => {
              const fmtPct = (val: number, decimals: number = 2): string => {
                if (!isFinite(val) || isNaN(val)) return "0.00%";
                return `${(val * 100).toFixed(decimals)}%`;
              };

              return (
                <Table className="table-fixed w-full text-xs">
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead className="w-[43%] font-semibold text-foreground px-2.5 py-2 text-left">
                        Cost Element
                      </TableHead>
                      <TableHead className="w-[21%] text-right font-semibold text-foreground px-1.5 py-2">
                        PKR
                      </TableHead>
                      <TableHead className="w-[18%] text-right font-semibold text-foreground px-1.5 py-2">
                        USD
                      </TableHead>
                      <TableHead className="w-[18%] text-right font-semibold text-foreground px-1.5 py-2">
                        % Sales
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* REVENUE */}
                    <TableRow className="bg-muted/10 font-semibold">
                      <TableCell className="px-2.5 py-1 text-foreground">Selling Price (FOB)</TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-medium">
                        Rs. {calcs.sellingPricePKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-medium">
                        ${calcs.sellingPriceUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap">100.0%</TableCell>
                    </TableRow>

                    {/* DEDUCTIONS */}
                    <TableRow>
                      <TableCell className="pl-3.5 pr-1.5 py-1 text-muted-foreground truncate">
                        Tax &amp; EDS ({fmtPct(taxEdsPct, 2)})
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {calcs.taxEDS_PKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        ${calcs.taxEDS_USD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.taxEDS_Pct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-3.5 pr-1.5 py-1 text-muted-foreground">
                        Rebate (add)
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            %:
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            className="w-10 h-5 text-[11px] bg-blue-50/50 border border-blue-200 text-center rounded focus:outline-none"
                            value={rebatePct || ""}
                            onChange={(e) => setRebatePct(Number(e.target.value))}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        ${calcs.rebateUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.rebatePct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-3.5 pr-1.5 py-1 text-muted-foreground truncate">
                        Inland Freight & Clearing
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {calcs.freightPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        ${calcs.freightUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.freightPct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-3.5 pr-1.5 py-1 text-muted-foreground truncate">
                        Local Bank Charges ({fmtPct(localBankChargesPct, 2)})
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {calcs.bankChargesPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        ${calcs.bankChargesUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.bankChargesPct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-3.5 pr-1.5 py-1 text-muted-foreground truncate">
                        <span className="inline-flex items-center gap-1">
                          Markup & Discounting
                          <span
                            className="cursor-help"
                            title="Rs Selling Price * (Discount Rate / 365) * Discount Days"
                          >
                            <Info className="size-3 text-muted-foreground" />
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            Days:
                          </span>
                          <input
                            type="number"
                            className="w-10 h-5 text-[11px] bg-blue-50/50 border border-blue-200 text-center rounded focus:outline-none"
                            value={paymentTermsDays || ""}
                            onChange={(e) =>
                              setPaymentTermsDays(Number(e.target.value))
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        ${calcs.markupDiscountUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.markupDiscountPct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-3.5 pr-1.5 py-1 text-muted-foreground truncate">
                        <span className="inline-flex items-center gap-1">
                          Factoring Cost
                          <span
                            className="cursor-help"
                            title="Rs Selling Price * (Discount Rate / 365) * Factoring Days"
                          >
                            <Info className="size-3 text-muted-foreground" />
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            Days:
                          </span>
                          <input
                            type="number"
                            className="w-10 h-5 text-[11px] bg-blue-50/50 border border-blue-200 text-center rounded focus:outline-none"
                            value={factoringDays || ""}
                            onChange={(e) =>
                              setFactoringDays(Number(e.target.value))
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        ${calcs.factoringUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.factoringPct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-3.5 pr-1.5 py-1 text-muted-foreground truncate">
                        Customer Commission
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            %:
                          </span>
                          <input
                            type="number"
                            className="w-10 h-5 text-[11px] bg-blue-50/50 border border-blue-200 text-center rounded focus:outline-none"
                            value={commissionPct || ""}
                            onChange={(e) =>
                              setCommissionPct(Number(e.target.value))
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        ${calcs.commissionUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.commissionPct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-3.5 pr-1.5 py-1 text-muted-foreground truncate">
                        Foreign Bank Charges ($)
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">
                            $
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            className="w-12 h-5 text-[11px] bg-blue-50/50 border border-blue-200 text-center rounded focus:outline-none"
                            value={foreignBankCharges || ""}
                            onChange={(e) =>
                              setForeignBankCharges(Number(e.target.value))
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        ${calcs.foreignBankChargesUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.foreignBankChargesPct, 2)}
                      </TableCell>
                    </TableRow>

                    {/* NET SELLING PRICE */}
                    <TableRow className="bg-blue-50/30 dark:bg-blue-950/20 font-semibold border-t border-b">
                      <TableCell className="px-2.5 py-1 text-foreground">Net Selling Price</TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-semibold">
                        Rs. {calcs.netPricePKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-semibold">
                        ${calcs.netPriceUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-semibold">
                        {fmtPct(calcs.netPricePct, 1)}
                      </TableCell>
                    </TableRow>

                    {/* VARIABLE COSTS */}
                    <TableRow>
                      <TableCell className="px-2.5 py-1 font-medium text-foreground truncate">
                        Fabric Cost
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        Rs. {calcs.fabricCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        ${calcs.fabricCostUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.fabricCostPct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="px-2.5 py-1 font-medium text-foreground truncate">
                        Lining Cost
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        Rs. {calcs.liningCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        ${calcs.liningCostUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.liningCostPct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="px-2.5 py-1 font-medium text-foreground truncate">
                        Accessories Cost
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        Rs. {calcs.accessoriesCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        ${calcs.accessoriesCostUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.accessoriesCostPct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="px-2.5 py-1 font-medium text-foreground truncate">
                        Chemical &amp; Washing Cost
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        Rs. {calcs.chemicalsCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        ${calcs.chemicalsCostUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.chemicalsCostPct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="px-2.5 py-1 font-medium text-foreground truncate">
                        Special Charges Cost
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        Rs. {calcs.specialChargesCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        ${calcs.specialChargesCostUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.specialChargesCostPct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="px-2.5 py-1 font-medium text-foreground truncate">
                        Direct Labor Cost (CPM-linked)
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        Rs. {calcs.directLaborCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        ${calcs.directLaborCostUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.directLaborCostPct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="px-2.5 py-1 font-medium text-foreground truncate">
                        Utilities Cost (CPM-linked)
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        Rs. {calcs.utilitiesCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        ${calcs.utilitiesCostUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.utilitiesCostPct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="px-2.5 py-1 font-medium text-foreground truncate">
                        Leftover Factor Cost
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        Rs. {calcs.leftoverCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right font-medium tabular-nums whitespace-nowrap">
                        ${calcs.leftoverCostUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.leftoverCostPct, 2)}
                      </TableCell>
                    </TableRow>

                    {/* TOTAL VARIABLE COST */}
                    <TableRow className="bg-[#fcf5e3]/60 dark:bg-amber-950/20 font-semibold border-t border-b">
                      <TableCell className="px-2.5 py-1 text-foreground">Total Variable Cost</TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-semibold">
                        Rs. {calcs.totalVariableCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-semibold">
                        ${calcs.totalVariableCostUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-semibold">
                        {fmtPct(calcs.totalVariableCostPct, 1)}
                      </TableCell>
                    </TableRow>

                    {/* CM / PC */}
                    <TableRow className="bg-emerald-50/30 dark:bg-emerald-950/10 font-bold text-emerald-800 dark:text-emerald-400">
                      <TableCell className="px-2.5 py-1">Gross CM / PC</TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-bold">
                        Rs. {calcs.cmPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-bold">
                        ${calcs.cmUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-bold">
                        {fmtPct(calcs.cmPct, 1)}
                      </TableCell>
                    </TableRow>

                    {/* OVERHEADS */}
                    <TableRow>
                      <TableCell className="pl-3.5 pr-1.5 py-1 text-muted-foreground truncate">
                        Salaries Cost (CPM-linked)
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {calcs.salariesCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        ${calcs.salariesCostUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.salariesCostPct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-3.5 pr-1.5 py-1 text-muted-foreground truncate">
                        FOH/Admin Cost (CPM-linked)
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {calcs.fohAdminCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        ${calcs.fohAdminCostUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.fohAdminCostPct, 2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-3.5 pr-1.5 py-1 text-muted-foreground truncate">
                        Repair &amp; Maintenance (CPM-linked)
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {calcs.repairMtcCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        ${calcs.repairMtcCostUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.repairMtcCostPct, 2)}
                      </TableCell>
                    </TableRow>

                    {/* TOTAL COST */}
                    <TableRow className="font-semibold border-t">
                      <TableCell className="px-2.5 py-1 text-foreground">Total Cost</TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-semibold">
                        Rs. {calcs.totalCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-semibold">
                        ${calcs.totalCostUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-semibold">
                        {fmtPct(calcs.totalCostPct, 1)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="pl-3.5 pr-1.5 py-1 text-muted-foreground truncate">
                        Conversion Cost per Minute
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        Rs. {calcs.conversionCostPerMinPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {calcs.conversionCostPerMinUSD.toFixed(2)}¢
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        -
                      </TableCell>
                    </TableRow>

                    {/* EBITDA */}
                    <TableRow
                      className={`font-extrabold border-t border-b ${isEbitdaPositive ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50/10" : "text-red-700 dark:text-red-400 bg-red-50/10"}`}
                    >
                      <TableCell className="px-2.5 py-1">EBITDA / PC</TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-extrabold">
                        Rs. {calcs.ebitdaPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-extrabold">
                        ${calcs.ebitdaUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right tabular-nums whitespace-nowrap font-extrabold">
                        {fmtPct(calcs.ebitdaPct, 1)}
                      </TableCell>
                    </TableRow>

                    {/* DEPRECIATION */}
                    <TableRow>
                      <TableCell className="pl-3.5 pr-1.5 py-1 text-muted-foreground truncate">
                        Depreciation Cost (CPM-linked)
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {calcs.depreciationCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        ${calcs.depreciationCostUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1 text-right text-muted-foreground tabular-nums whitespace-nowrap">
                        {fmtPct(calcs.depreciationCostPct, 2)}
                      </TableCell>
                    </TableRow>

                    {/* NET PROFIT */}
                    <TableRow
                      className={`font-black border-t-2 text-sm ${isProfitPositive ? "text-emerald-800 dark:text-emerald-400 bg-emerald-50/40" : "text-red-800 dark:text-red-400 bg-red-50/40"}`}
                    >
                      <TableCell className="px-2.5 py-1.5 font-bold">Net Profit / PC</TableCell>
                      <TableCell className="px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap font-bold">
                        Rs. {calcs.netProfitPKR.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap font-bold">
                        ${calcs.netProfitUSD.toFixed(3)}
                      </TableCell>
                      <TableCell className="px-1.5 py-1.5 text-right tabular-nums whitespace-nowrap font-bold">
                        {fmtPct(calcs.netProfitPct, 1)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              );
            })()}
          </CardContent>
        </Card>

        {/* RIGHT PANEL: DETAILED INTERACTIVE BOM & EXPENSE TABLES */}
        <div className="lg:col-span-7 space-y-6">
          {/* FABRIC BOM */}
          <Card className="shadow-md border-muted/60 bg-card overflow-visible">
            <div className="bg-muted/40 px-4 py-3 border-b flex justify-between items-center">
              <h2 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Layers className="size-4 text-primary" /> Fabric Details (USD
                input)
              </h2>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  markDirty();
                  const newIdx = activeStyle.bomFabric.length;
                  setActiveStyle({
                    ...activeStyle,
                    bomFabric: [
                      ...activeStyle.bomFabric,
                      {
                        itemName: "",
                        consumptionPerPc: 0,
                        rateUSD: 0,
                        ratePKR: 0,
                        fabricCostPKR: 0,
                      },
                    ],
                  });
                  setNewFabricRows((prev) => new Set(prev).add(newIdx));
                }}
              >
                <Plus className="mr-1 size-3.5" /> Add Fabric
              </Button>
            </div>
            <CardContent className="p-0 text-xs">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Fabric Item Name</TableHead>
                    <TableHead className="w-20">Cons. (Mtr)</TableHead>
                    <TableHead className="w-24">Rate ($)</TableHead>
                    <TableHead className="w-24 text-right">Rate (Rs)</TableHead>
                    <TableHead className="w-28 text-right">Cost (Rs)</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({
                    length: Math.max(activeStyle.bomFabric.length, 1),
                  }).map((_, idx) => {
                    const rawItem = activeStyle.bomFabric[idx];
                    const item = {
                      itemName: rawItem?.itemName ?? `Fabric ${idx + 1}`,
                      consumptionPerPc: rawItem?.consumptionPerPc ?? 0,
                      rateUSD: rawItem?.rateUSD ?? 0,
                      ratePKR: rawItem?.ratePKR ?? 0,
                      fabricCostPKR: rawItem?.fabricCostPKR ?? 0,
                    };
                    const isEditable =
                      activeStyle.id === "custom" || newFabricRows.has(idx);
                    return (
                      <TableRow key={idx}>
                        <TableCell className="p-1.5">
                          {isEditable ? (
                            <SearchableSelect
                              className="w-full"
                              placeholder="Search fabric…"
                              value={item.itemName}
                              onChange={(val) => {
                                const chosen = val;
                                const found = fabricCatalog.find(
                                  (c) => c.itemName === chosen,
                                );
                                updateFabricBOM(idx, {
                                  itemName: chosen,
                                  ...(found && found.ratePKR ? { ratePKR: found.ratePKR } : {}),
                                });
                              }}
                              options={[
                                { value: "", label: "-- Select Fabric --" },
                                ...fabricCatalog.map((c) => ({
                                  value: c.itemName,
                                  label: c.itemName,
                                })),
                              ]}
                            />
                          ) : (
                            <input
                              type="text"
                              disabled
                              placeholder={`Fabric ${idx + 1}`}
                              className="w-full h-7 px-2 border bg-transparent text-xs rounded focus:outline-none disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                              value={item.itemName}
                              onChange={(e) =>
                                updateFabricBOM(idx, "itemName", e.target.value)
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full h-7 px-2 border bg-transparent text-xs rounded text-center focus:outline-none bg-blue-50/10 focus:bg-white"
                            value={item.consumptionPerPc || ""}
                            onChange={(e) =>
                              updateFabricBOM(
                                idx,
                                "consumptionPerPc",
                                Number(e.target.value),
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            disabled
                            readOnly
                            step="0.0001"
                            placeholder="0.0000"
                            className="w-full h-7 px-2 border bg-slate-100/50 dark:bg-slate-800/40 text-muted-foreground text-xs rounded text-center cursor-not-allowed select-none"
                            value={
                              item.rateUSD !== undefined && item.rateUSD > 0
                                ? Number(item.rateUSD.toFixed(4))
                                : item.ratePKR && parityProcurement && parityProcurement > 0
                                ? Number((item.ratePKR / parityProcurement).toFixed(4))
                                : ""
                            }
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full h-7 px-2 border bg-transparent text-xs rounded text-center focus:outline-none bg-blue-50/10 focus:bg-white"
                            value={item.ratePKR || ""}
                            onChange={(e) =>
                              updateFabricBOM(
                                idx,
                                "ratePKR",
                                Number(e.target.value),
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="p-1.5 text-right font-semibold text-foreground align-middle pr-4">
                          Rs. {item.fabricCostPKR.toFixed(1)}
                        </TableCell>
                        <TableCell className="p-1.5">
                          {isEditable && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 text-destructive"
                              onClick={() => {
                                markDirty();
                                setActiveStyle({
                                  ...activeStyle,
                                  bomFabric: activeStyle.bomFabric.filter(
                                    (_, i) => i !== idx,
                                  ),
                                });
                                setNewFabricRows((prev) => {
                                  const next = new Set<number>();
                                  prev.forEach((i) => {
                                    if (i < idx) next.add(i);
                                    else if (i > idx) next.add(i - 1);
                                  });
                                  return next;
                                });
                              }}
                            >
                              <X className="size-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/10 font-bold">
                    <TableCell colSpan={4} className="text-right">
                      Total Fabric Cost:
                    </TableCell>
                    <TableCell className="text-right text-primary pr-4">
                      Rs. {calcs.fabricCostPKR.toFixed(1)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* POCKET LINING BOM */}
          <Card className="shadow-md border-muted/60 bg-card overflow-visible">
            <div className="bg-muted/40 px-4 py-3 border-b flex justify-between items-center">
              <h2 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Layers className="size-4 text-primary" /> Pocket Lining Details
                (USD input)
              </h2>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  markDirty();
                  const newIdx = activeStyle.bomLining.length;
                  setActiveStyle({
                    ...activeStyle,
                    bomLining: [
                      ...activeStyle.bomLining,
                      {
                        itemName: "",
                        consumptionPerPc: 0,
                        rateUSD: 0,
                        ratePKR: 0,
                        liningCostPKR: 0,
                      },
                    ],
                  });
                  setNewLiningRows((prev) => new Set(prev).add(newIdx));
                }}
              >
                <Plus className="mr-1 size-3.5" /> Add Lining
              </Button>
            </div>
            <CardContent className="p-0 text-xs">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead>Lining Item Name</TableHead>
                    <TableHead className="w-20">Cons. (Mtr)</TableHead>
                    <TableHead className="w-24">Rate ($)</TableHead>
                    <TableHead className="w-24 text-right">Rate (Rs)</TableHead>
                    <TableHead className="w-28 text-right">Cost (Rs)</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({
                    length: Math.max(activeStyle.bomLining.length, 1),
                  }).map((_, idx) => {
                    const rawItem = activeStyle.bomLining[idx];
                    const item = {
                      itemName: rawItem?.itemName ?? `Lining ${idx + 1}`,
                      consumptionPerPc: rawItem?.consumptionPerPc ?? 0,
                      rateUSD: rawItem?.rateUSD ?? 0,
                      ratePKR: rawItem?.ratePKR ?? 0,
                      liningCostPKR: rawItem?.liningCostPKR ?? 0,
                    };
                    const isEditable =
                      activeStyle.id === "custom" || newLiningRows.has(idx);
                    return (
                      <TableRow key={idx}>
                        <TableCell className="p-1.5">
                          {isEditable ? (
                            <SearchableSelect
                              className="w-full"
                              placeholder="Search lining…"
                              value={item.itemName}
                              onChange={(val) => {
                                const chosen = val;
                                const found = liningCatalog.find(
                                  (c) => c.itemName === chosen,
                                );
                                updateLiningBOM(idx, {
                                  itemName: chosen,
                                  ...(found && found.ratePKR ? { ratePKR: found.ratePKR } : {}),
                                });
                              }}
                              options={[
                                { value: "", label: "-- Select Lining --" },
                                ...liningCatalog.map((c) => ({
                                  value: c.itemName,
                                  label: c.itemName,
                                })),
                              ]}
                            />
                          ) : (
                            <input
                              type="text"
                              disabled
                              placeholder={`Lining ${idx + 1}`}
                              className="w-full h-7 px-2 border bg-transparent text-xs rounded focus:outline-none disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                              value={item.itemName}
                              onChange={(e) =>
                                updateLiningBOM(idx, "itemName", e.target.value)
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full h-7 px-2 border bg-transparent text-xs rounded text-center focus:outline-none bg-blue-50/10 focus:bg-white"
                            value={item.consumptionPerPc || ""}
                            onChange={(e) =>
                              updateLiningBOM(
                                idx,
                                "consumptionPerPc",
                                Number(e.target.value),
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            disabled
                            readOnly
                            step="0.0001"
                            placeholder="0.0000"
                            className="w-full h-7 px-2 border bg-slate-100/50 dark:bg-slate-800/40 text-muted-foreground text-xs rounded text-center cursor-not-allowed select-none"
                            value={
                              item.rateUSD !== undefined && item.rateUSD > 0
                                ? Number(item.rateUSD.toFixed(4))
                                : item.ratePKR && parityProcurement && parityProcurement > 0
                                ? Number((item.ratePKR / parityProcurement).toFixed(4))
                                : ""
                            }
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full h-7 px-2 border bg-transparent text-xs rounded text-center focus:outline-none bg-blue-50/10 focus:bg-white"
                            value={item.ratePKR || ""}
                            onChange={(e) =>
                              updateLiningBOM(
                                idx,
                                "ratePKR",
                                Number(e.target.value),
                              )
                            }
                          />
                        </TableCell>
                        <TableCell className="p-1.5 text-right font-semibold text-foreground align-middle pr-4">
                          Rs. {item.liningCostPKR.toFixed(1)}
                        </TableCell>
                        <TableCell className="p-1.5">
                          {isEditable && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-6 text-destructive"
                              onClick={() => {
                                markDirty();
                                setActiveStyle({
                                  ...activeStyle,
                                  bomLining: activeStyle.bomLining.filter(
                                    (_, i) => i !== idx,
                                  ),
                                });
                                setNewLiningRows((prev) => {
                                  const next = new Set<number>();
                                  prev.forEach((i) => {
                                    if (i < idx) next.add(i);
                                    else if (i > idx) next.add(i - 1);
                                  });
                                  return next;
                                });
                              }}
                            >
                              <X className="size-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/10 font-bold">
                    <TableCell colSpan={4} className="text-right">
                      Total Lining Cost:
                    </TableCell>
                    <TableCell className="text-right text-primary pr-4">
                      Rs. {calcs.liningCostPKR.toFixed(1)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* ACCESSORIES, CHEMICALS, & SPECIAL CHARGES */}
          <Card className="shadow-md border-muted/60 bg-card overflow-visible">
            <div className="bg-muted/40 px-4 py-3 border-b flex flex-wrap justify-between items-center gap-2">
              <h2 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Layers className="size-4 text-primary" /> Trims, Chemicals &
                Special Charges (PKR Input)
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    markDirty();
                    const newIdx = activeStyle.bomAccessories.length;
                    setActiveStyle({
                      ...activeStyle,
                      bomAccessories: [
                        ...activeStyle.bomAccessories,
                        {
                          category: "Trims Mix Materials",
                          itemName: "",
                          consPerPc: 0,
                          rateUSD: 0,
                          ratePKR: 0,
                          totalCostPKR: 0,
                        },
                      ],
                    });
                    setNewAccessoryRows((prev) => new Set(prev).add(newIdx));
                  }}
                >
                  <Plus className="mr-1 size-3.5" /> Add Trim
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    markDirty();
                    const newIdx = activeStyle.bomChemicals.length;
                    setActiveStyle({
                      ...activeStyle,
                      bomChemicals: [
                        ...activeStyle.bomChemicals,
                        {
                          washItem: "",
                          consPerPc: 0,
                          rateUSD: 0,
                          ratePKR: 0,
                          totalCostPKR: 0,
                        },
                      ],
                    });
                    setNewChemicalRows((prev) => new Set(prev).add(newIdx));
                  }}
                >
                  <Plus className="mr-1 size-3.5" /> Add Chemical
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => {
                    markDirty();
                    const newIdx = activeStyle.bomSpecialCharges.length;
                    setActiveStyle({
                      ...activeStyle,
                      bomSpecialCharges: [
                        ...activeStyle.bomSpecialCharges,
                        {
                          itemName: "",
                          consPerPc: 0,
                          rateUSD: 0,
                          ratePKR: 0,
                          totalCostPKR: 0,
                        },
                      ],
                    });
                    setNewSpecialChargeRows((prev) => new Set(prev).add(newIdx));
                  }}
                >
                  <Plus className="mr-1 size-3.5" /> Add Special Charge
                </Button>
              </div>
            </div>
            <CardContent className="p-0 text-xs">
              <div>
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-32">Category</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="w-16">Cons.</TableHead>
                      <TableHead className="w-24 text-center">
                        Rate ($)
                      </TableHead>
                      <TableHead className="w-24 text-center">
                        Rate (Rs)
                      </TableHead>
                      <TableHead className="w-28 text-right">
                        Cost (Rs)
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* ACCESSORIES */}
                    <TableRow className="bg-muted/20 font-bold">
                      <TableCell colSpan={7}>
                        Accessories (Before & After Wash)
                      </TableCell>
                    </TableRow>
                    {activeStyle.bomAccessories.map((item, idx) => {
                      const isAccEditable =
                        activeStyle.id === "custom" ||
                        newAccessoryRows.has(idx);
                      return (
                        <TableRow key={`acc-${idx}`}>
                          <TableCell className="p-1.5 pl-4 text-[10px] text-muted-foreground font-semibold uppercase">
                            {isAccEditable ? (
                              <input
                                type="text"
                                className="w-full h-7 px-1.5 text-[10px] border rounded bg-background"
                                value={item.category}
                                placeholder="Category"
                                onChange={(e) =>
                                  updateAccessoriesBOM(
                                    idx,
                                    "category",
                                    e.target.value,
                                  )
                                }
                              />
                            ) : (
                              item.category
                            )}
                          </TableCell>
                          <TableCell className="p-1.5">
                            {isAccEditable ? (
                              <SearchableSelect
                                className="w-full"
                                placeholder="Search trim…"
                                value={item.itemName}
                                onChange={(val) => {
                                  const chosen = val;
                                  const found = trimsCatalog.find(
                                    (t) => t.itemName === chosen,
                                  );
                                  updateAccessoriesBOM(idx, {
                                    itemName: chosen,
                                    ...(found?.category ? { category: found.category } : {}),
                                    ...(found?.ratePKR ? { ratePKR: found.ratePKR } : {}),
                                  });
                                }}
                                options={[
                                  { value: "", label: "-- Select Trim --" },
                                  ...trimsCatalog.map((t) => ({
                                    value: t.itemName,
                                    label: `[${t.category ?? t.groupName ?? "Trim"}] ${t.itemName}`,
                                  })),
                                ]}
                              />
                            ) : (
                              <input
                                type="text"
                                disabled
                                className="w-full h-7 px-2 border bg-transparent text-xs rounded focus:outline-none disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                                value={item.itemName}
                                onChange={(e) =>
                                  updateAccessoriesBOM(
                                    idx,
                                    "itemName",
                                    e.target.value,
                                  )
                                }
                              />
                            )}
                          </TableCell>
                          <TableCell className="p-1.5">
                            <input
                              type="number"
                              step="0.01"
                              className="w-full h-7 px-1 border bg-transparent text-xs text-center rounded focus:outline-none bg-blue-50/10 focus:bg-white"
                              value={item.consPerPc || ""}
                              onChange={(e) =>
                                updateAccessoriesBOM(
                                  idx,
                                  "consPerPc",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="p-1.5">
                            <input
                              type="number"
                              disabled
                              readOnly
                              step="0.0001"
                              placeholder="0.0000"
                              className="w-full h-7 px-2 border bg-slate-100/50 dark:bg-slate-800/40 text-muted-foreground text-xs rounded text-center cursor-not-allowed select-none"
                              value={
                                item.rateUSD !== undefined && item.rateUSD > 0
                                  ? Number(item.rateUSD.toFixed(4))
                                  : item.ratePKR &&
                                      parityProcurement &&
                                      parityProcurement > 0
                                    ? Number(
                                        (
                                          item.ratePKR / parityProcurement
                                        ).toFixed(4),
                                      )
                                    : ""
                              }
                            />
                          </TableCell>
                          <TableCell className="p-1.5">
                            <input
                              type="number"
                              className="w-full h-7 px-2 border bg-transparent text-xs text-center rounded focus:outline-none bg-blue-50/10 focus:bg-white"
                              value={item.ratePKR || ""}
                              onChange={(e) =>
                                updateAccessoriesBOM(
                                  idx,
                                  "ratePKR",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="p-1.5 text-right font-semibold text-foreground align-middle pr-4">
                            Rs. {(item.totalCostPKR || 0).toFixed(1)}
                          </TableCell>
                          <TableCell className="p-1.5">
                            {isAccEditable && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-destructive"
                                onClick={() => {
                                  markDirty();
                                  setActiveStyle({
                                    ...activeStyle,
                                    bomAccessories:
                                      activeStyle.bomAccessories.filter(
                                        (_, i) => i !== idx,
                                      ),
                                  });
                                  setNewAccessoryRows((prev) => {
                                    const next = new Set<number>();
                                    prev.forEach((i) => {
                                      if (i < idx) next.add(i);
                                      else if (i > idx) next.add(i - 1);
                                    });
                                    return next;
                                  });
                                }}
                              >
                                <X className="size-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/10 font-bold">
                      <TableCell colSpan={5} className="text-right">
                        Total Accessories Cost:
                      </TableCell>
                      <TableCell className="text-right text-primary pr-4">
                        Rs. {calcs.accessoriesCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell />
                    </TableRow>

                    {/* CHEMICALS */}
                    <TableRow className="bg-muted/20 font-bold">
                      <TableCell colSpan={7}>Chemical Costs</TableCell>
                    </TableRow>
                    {activeStyle.bomChemicals.map((item, idx) => {
                      const isChemEditable =
                        activeStyle.id === "custom" ||
                        newChemicalRows.has(idx);
                      return (
                        <TableRow key={`chem-${idx}`}>
                          <TableCell className="p-1.5 pl-4 text-[10px] text-muted-foreground font-semibold uppercase">
                            Chemicals
                          </TableCell>
                          <TableCell colSpan={2} className="p-1.5">
                            {isChemEditable ? (
                              <SearchableSelect
                                className="w-full"
                                placeholder="Search chemical…"
                                value={item.washItem}
                                onChange={(val) => {
                                  const chosen = val;
                                  const found = chemicalsCatalog.find(
                                    (c) => c.itemName === chosen,
                                  );
                                  updateChemicalsBOM(idx, {
                                    washItem: chosen,
                                    ...(found && found.ratePKR ? { ratePKR: found.ratePKR } : {}),
                                  });
                                }}
                                options={[
                                  { value: "", label: "-- Select Chemical --" },
                                  ...chemicalsCatalog.map((c) => ({
                                    value: c.itemName,
                                    label: c.itemName,
                                  })),
                                ]}
                              />
                            ) : (
                              <input
                                type="text"
                                disabled
                                className="w-full h-7 px-2 border bg-transparent text-xs rounded focus:outline-none disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                                value={item.washItem}
                                onChange={(e) =>
                                  updateChemicalsBOM(
                                    idx,
                                    "washItem",
                                    e.target.value,
                                  )
                                }
                              />
                            )}
                          </TableCell>
                          <TableCell className="p-1.5">
                            <input
                              type="number"
                              disabled
                              readOnly
                              step="0.0001"
                              placeholder="0.0000"
                              className="w-full h-7 px-2 border bg-slate-100/50 dark:bg-slate-800/40 text-muted-foreground text-xs rounded text-center cursor-not-allowed select-none"
                              value={
                                item.rateUSD !== undefined && item.rateUSD > 0
                                  ? Number(item.rateUSD.toFixed(4))
                                  : item.ratePKR &&
                                      parityProcurement &&
                                      parityProcurement > 0
                                    ? Number(
                                        (
                                          item.ratePKR / parityProcurement
                                        ).toFixed(4),
                                      )
                                    : ""
                              }
                            />
                          </TableCell>
                          <TableCell className="p-1.5">
                            <input
                              type="number"
                              className="w-full h-7 px-2 border bg-transparent text-xs text-center rounded focus:outline-none bg-blue-50/10 focus:bg-white"
                              value={item.ratePKR || ""}
                              onChange={(e) =>
                                updateChemicalsBOM(
                                  idx,
                                  "ratePKR",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="p-1.5 text-right font-semibold text-foreground align-middle pr-4">
                            Rs. {(item.totalCostPKR || item.ratePKR || 0).toFixed(1)}
                          </TableCell>
                          <TableCell className="p-1.5">
                            {isChemEditable && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-destructive"
                                onClick={() => {
                                  markDirty();
                                  setActiveStyle({
                                    ...activeStyle,
                                    bomChemicals:
                                      activeStyle.bomChemicals.filter(
                                        (_, i) => i !== idx,
                                      ),
                                  });
                                  setNewChemicalRows((prev) => {
                                    const next = new Set<number>();
                                    prev.forEach((i) => {
                                      if (i < idx) next.add(i);
                                      else if (i > idx) next.add(i - 1);
                                    });
                                    return next;
                                  });
                                }}
                              >
                                <X className="size-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/10 font-bold">
                      <TableCell colSpan={5} className="text-right">
                        Total Chemical Cost:
                      </TableCell>
                      <TableCell className="text-right text-primary pr-4">
                        Rs. {calcs.chemicalsCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell />
                    </TableRow>

                    {/* SPECIAL CHARGES */}
                    <TableRow className="bg-muted/20 font-bold">
                      <TableCell colSpan={7}>
                        Special Charges (Embroidery, Testing, etc.)
                      </TableCell>
                    </TableRow>
                    {activeStyle.bomSpecialCharges.map((item, idx) => {
                      const isChgEditable =
                        activeStyle.id === "custom" ||
                        newSpecialChargeRows.has(idx);
                      return (
                        <TableRow key={`chg-${idx}`}>
                          <TableCell className="p-1.5 pl-4 text-[10px] text-muted-foreground font-semibold uppercase">
                            {item.itemName || "Charges"}
                          </TableCell>
                          <TableCell colSpan={2} className="p-1.5 font-medium text-xs align-middle">
                            {isChgEditable ? (
                              <SearchableSelect
                                className="w-full"
                                placeholder="Search charge…"
                                value={item.itemName}
                                onChange={(val) => {
                                  const chosen = val;
                                  const found = specialChargesCatalog.find(
                                    (c) => c.itemName === chosen,
                                  );
                                  updateSpecialChargesBOM(idx, {
                                    itemName: chosen,
                                    ...(found && found.ratePKR ? { ratePKR: found.ratePKR } : {}),
                                  });
                                }}
                                options={[
                                  { value: "", label: "-- Select Charge --" },
                                  ...specialChargesCatalog.map((c) => ({
                                    value: c.itemName,
                                    label: c.itemName,
                                  })),
                                ]}
                              />
                            ) : (
                              `${item.itemName} Charges`
                            )}
                          </TableCell>
                          <TableCell className="p-1.5">
                            <input
                              type="number"
                              disabled
                              readOnly
                              step="0.0001"
                              placeholder="0.0000"
                              className="w-full h-7 px-2 border bg-slate-100/50 dark:bg-slate-800/40 text-muted-foreground text-xs rounded text-center cursor-not-allowed select-none"
                              value={
                                item.rateUSD !== undefined && item.rateUSD > 0
                                  ? Number(item.rateUSD.toFixed(4))
                                  : item.ratePKR &&
                                      parityProcurement &&
                                      parityProcurement > 0
                                    ? Number(
                                        (
                                          item.ratePKR / parityProcurement
                                        ).toFixed(4),
                                      )
                                    : ""
                              }
                            />
                          </TableCell>
                          <TableCell className="p-1.5">
                            <input
                              type="number"
                              className="w-full h-7 px-2 border bg-transparent text-xs text-center rounded focus:outline-none bg-blue-50/10 focus:bg-white"
                              value={item.ratePKR || ""}
                              onChange={(e) =>
                                updateSpecialChargesBOM(
                                  idx,
                                  "ratePKR",
                                  Number(e.target.value),
                                )
                              }
                            />
                          </TableCell>
                          <TableCell className="p-1.5 text-right font-semibold text-foreground align-middle pr-4">
                            Rs. {(item.totalCostPKR || item.ratePKR || 0).toFixed(1)}
                          </TableCell>
                          <TableCell className="p-1.5">
                            {isChgEditable && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-6 text-destructive"
                                onClick={() => {
                                  markDirty();
                                  setActiveStyle({
                                    ...activeStyle,
                                    bomSpecialCharges:
                                      activeStyle.bomSpecialCharges.filter(
                                        (_, i) => i !== idx,
                                      ),
                                  });
                                  setNewSpecialChargeRows((prev) => {
                                    const next = new Set<number>();
                                    prev.forEach((i) => {
                                      if (i < idx) next.add(i);
                                      else if (i > idx) next.add(i - 1);
                                    });
                                    return next;
                                  });
                                }}
                              >
                                <X className="size-3.5" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow className="bg-muted/10 font-bold">
                      <TableCell colSpan={5} className="text-right">
                        Total Special Charges Cost:
                      </TableCell>
                      <TableCell className="text-right text-primary pr-4">
                        Rs. {calcs.specialChargesCostPKR.toFixed(1)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ACTION BUTTONS PANEL */}
          <div className="flex gap-2 justify-end print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetClick}
              className="h-9"
            >
              <RefreshCw className="mr-1.5 size-4" /> Reset Calculator
            </Button>
            {loadedCostSheet ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSaveDialogOpen(true)}
                  className="h-9 border-primary text-primary hover:bg-primary/5"
                >
                  <Copy className="mr-1.5 size-4" /> Save as New Sheet
                </Button>
                <Button
                  size="sm"
                  onClick={handleUpdateExisting}
                  disabled={isSaving}
                  className="h-9"
                >
                  {isSaving ? (
                    <RefreshCw className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 size-4" />
                  )}
                  {isSaving ? "Updating…" : "Update Cost Sheet"}
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={() => setSaveDialogOpen(true)}
                className="h-9"
              >
                <Save className="mr-1.5 size-4" /> Save Cost Sheet
              </Button>
            )}
          </div>

          {/* Snapshot Naming Dialog */}
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Save Cost Sheet</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Enter a short description or scenario name to save this run
                  snapshot (e.g. &quot;Scenario A - Base Quote&quot;).
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Snapshot Reference Name
                  </label>
                  <Input
                    value={newSnapshotName}
                    onChange={(e) => setNewSnapshotName(e.target.value)}
                    placeholder="e.g. V1 - Initial Target FOB"
                    maxLength={50}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveDialogOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleSaveNew(newSnapshotName)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <RefreshCw className="mr-1.5 size-4 animate-spin" />
                  ) : null}
                  {isSaving ? "Saving…" : "Save"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Unsaved Changes Confirmation Dialog */}
          <Dialog open={unsavedModalOpen} onOpenChange={setUnsavedModalOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-5 text-amber-600" />
                  Unsaved Changes
                </DialogTitle>
                <DialogDescription className="pt-2 text-sm text-slate-600 dark:text-slate-300">
                  You have unsaved changes on this cost sheet. If you leave or change page without saving, your changes will be lost.
                </DialogDescription>
              </DialogHeader>
              <div className="py-2 text-xs text-muted-foreground">
                Do you want to save your changes to this cost sheet before proceeding?
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setUnsavedModalOpen(false);
                    setPendingNavigation(null);
                  }}
                >
                  Stay on Page
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    proceedWithPendingNavigation();
                  }}
                >
                  Discard Changes
                </Button>
                <Button
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleSaveAndProceed}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <RefreshCw className="mr-1.5 size-4 animate-spin" />
                  ) : (
                    <Save className="mr-1.5 size-4" />
                  )}
                  Save &amp; Continue
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
