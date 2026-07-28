"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save, RefreshCw, Layers, Calculator, TrendingUp, Info, Copy } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { getCostSheetById, saveCostSheet } from "@/lib/cost-sheet/firestore";
import type { SavedCostSheetItem } from "@/lib/cost-sheet/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { subscribeToStyles, saveStyle } from "@/lib/style-master/firestore";
import { subscribeToTable } from "@/lib/parameters/firestore";
import type {
  StyleMasterItem,
  BOMFabricItem,
  BOMLiningItem,
  BOMAccessoriesItem,
  BOMChemicalsItem,
  BOMSpecialChargesItem,
} from "@/lib/style-master/types";
import type { SimpleTableData, MatrixTableData, ProcessMatrixTableData, DropdownListsData } from "@/lib/parameters/types";
import { runFormulaEngine, calculateSizeBracket, mapSMVToCategory, getWashingRejection } from "@/lib/cost-sheet/formula-engine";

export default function CostSheetPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Loading Cost Sheet...</div>}>
      <CostSheetContent />
    </Suspense>
  );
}

// Helper to generate a unique cost sheet ID. Placed outside component to prevent purity rules violation in React Compiler.
function generateCostSheetId(styleId: string): string {
  return `PCS-${styleId}-${Date.now().toString().slice(-4)}`;
}

const CUSTOM_STYLE: StyleMasterItem = {
  id: "custom",
  styleName: "Custom Style",
  customerName: "Duer",
  styleCategory: "Top Ware",
  orderType: "Denim",
  washType: "Rinse",
  orderQuantity: 1000,
  sizeBracket: "<=500",
  smvSewing: 15,
  targetEfficiency: 0.47,
  rejectionPct: 0.0415,
  baseSellingPrice: 10,
  bomFabric: [],
  bomLining: [],
  bomAccessories: [],
  bomChemicals: [],
  bomSpecialCharges: [],
};

function CostSheetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const styleIdParam = searchParams.get("styleId");
  const costSheetIdParam = searchParams.get("costSheetId");

  // Snapshot States
  const [loadedCostSheet, setLoadedCostSheet] = useState<SavedCostSheetItem | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState("");

  // Subscribed Database Data
  const [styles, setStyles] = useState<StyleMasterItem[]>([]);
  const [activeStyle, setActiveStyle] = useState<StyleMasterItem | null>(null);
  
  const [directLabourFoh, setDirectLabourFoh] = useState<SimpleTableData | undefined>(undefined);
  const [cutToShipGrid, setCutToShipGrid] = useState<MatrixTableData | undefined>(undefined);
  const [rejectionGrid, setRejectionGrid] = useState<ProcessMatrixTableData | undefined>(undefined);

  // Loading States
  const [loadingStyles, setLoadingStyles] = useState(true);

  // 1. Control & Input Parameters State
  const [costingDate, setCostingDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [costingStage, setCostingStage] = useState("Quote");
  const [country, setCountry] = useState("SPAIN");
  const [paymentTerms, setPaymentTerms] = useState("LC-60 days");
  const [shipmentMode, setShipmentMode] = useState("Sea");
  const [deliveryTerms, setDeliveryTerms] = useState("FOB");
  const [paritySale, setParitySale] = useState(278);
  const [parityProcurement, setParityProcurement] = useState(278);

  // New editable style fields
  const [customerName, setCustomerName] = useState("Duer");
  const [styleCategory, setStyleCategory] = useState("Top Ware");
  const [washType, setWashType] = useState("Rinse");
  const [orderQuantity, setOrderQuantity] = useState(1000);
  const [orderType, setOrderType] = useState<"Denim" | "Non Denim">("Denim");
  const [noOfColors, setNoOfColors] = useState<number>(1);
  const [merchGroup, setMerchGroup] = useState<string>("Ayaz");
  const [deliveryDestination, setDeliveryDestination] = useState<string>("EURO");
  const [exFactoryDate, setExFactoryDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    return d.toISOString().split("T")[0];
  });
  const [inhouseOrSubcontract, setInhouseOrSubcontract] = useState<string>("INHOUSE");
  const [rebatePct, setRebatePct] = useState<number>(0);

  // Operational Inputs
  const [manpower, setManpower] = useState(60);
  const [efficiencyOverride, setEfficiencyOverride] = useState<string>("");
  const [rejectionOverride, setRejectionOverride] = useState<string>("");
  const [lineTargetOverride, setLineTargetOverride] = useState<string>("");

  // Financial Parameters
  const [discountRate, setDiscountRate] = useState(0.12);
  const [paymentTermsDays, setPaymentTermsDays] = useState(60);
  const [factoringDays, setFactoringDays] = useState(0);
  const [commissionPct, setCommissionPct] = useState(0);
  const [foreignBankCharges, setForeignBankCharges] = useState(0);

  // Order FOB / Quoted Price / Freight & Insurance inputs
  const [quotedPriceInput, setQuotedPriceInput] = useState<string>("");
  const [intlFreight, setIntlFreight] = useState<string>("0");
  const [intlInsurance, setIntlInsurance] = useState<string>("0");

  // Options lists (will subscribe to parameter dropdown-lists if exists)
  const [paymentTermsList, setPaymentTermsList] = useState(["LC at Sight", "LC-30 days", "LC-45 days", "LC-60 days", "LC-75 days", "DA", "Advance"]);
  const [deliveryTermsList, setDeliveryTermsList] = useState(["FOB", "CIF", "CFR", "DDP/LDP"]);
  const [countriesList, setCountriesList] = useState(["SPAIN", "GERMANY", "USA", "UK", "FRANCE", "ITALY"]);
  const [customersList, setCustomersList] = useState(["Duer", "Zara", "Mustang", "Miniconf", "Mohito", "Retrojeans"]);
  const [categoriesList, setCategoriesList] = useState(["Top Ware", "Men's Pant", "Ladies Pant", "Shorts", "Shirt"]);
  const [washTypesList, setWashTypesList] = useState(["Rinse", "Dyeing", "Softner", "Stone Wash", "EW/Biopolish", "Silicon Ball"]);

  useEffect(() => {
    // Subscribe to Style Master
    const unsubStyles = subscribeToStyles((data) => {
      setStyles(data);
      setLoadingStyles(false);

      // Select active style from param or select first one
      if (data.length > 0 && !costSheetIdParam) {
        const targetId = styleIdParam || data[0].id;
        if (targetId === "custom") {
          setActiveStyle(CUSTOM_STYLE);
        } else {
          const found = data.find((s) => s.id === targetId) || data[0];
          setActiveStyle(found);
        }
      }
    });

    // Subscribe to POC Parameters
    const unsubDLF = subscribeToTable<SimpleTableData>("direct-labour-foh", setDirectLabourFoh);
    const unsubCTS = subscribeToTable<MatrixTableData>("cut-to-ship-grid", setCutToShipGrid);
    const unsubRej = subscribeToTable<ProcessMatrixTableData>("rejection-grid", setRejectionGrid);

    const unsubDropdowns = subscribeToTable<DropdownListsData>("dropdown-lists", (data) => {
      if (data?.lists) {
        const pTerms = data.lists.find((l) => l.key === "paymentTerms")?.items;
        const dTerms = data.lists.find((l) => l.key === "deliveryTerms")?.items;
        const countrs = data.lists.find((l) => l.key === "countries" || l.key === "country")?.items;
        const custs = data.lists.find((l) => l.key === "customerName" || l.key === "customer")?.items;
        const cats = data.lists.find((l) => l.key === "styleCategory")?.items;
        const washes = data.lists.find((l) => l.key === "washType")?.items;

        if (pTerms) setPaymentTermsList(pTerms);
        if (dTerms) setDeliveryTermsList(dTerms);
        if (countrs) setCountriesList(countrs);
        if (custs) setCustomersList(custs);
        if (cats) setCategoriesList(cats);
        if (washes) setWashTypesList(washes);
      }
    });

    return () => {
      unsubStyles();
      unsubDLF();
      unsubCTS();
      unsubRej();
      unsubDropdowns();
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
          setActiveStyle(styleFromSheet);
          
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
          
          setEfficiencyOverride(sheet.efficiencyOverride !== null ? (sheet.efficiencyOverride * 100).toString() : "");
          setRejectionOverride(sheet.rejectionOverride !== null ? (sheet.rejectionOverride * 100).toString() : "");
          setLineTargetOverride(sheet.lineTargetOverride !== null ? sheet.lineTargetOverride.toString() : "");
          
          setDiscountRate(sheet.discountRate);
          setPaymentTermsDays(sheet.paymentTermsDays);
          setFactoringDays(sheet.factoringDays);
           setCommissionPct(sheet.commissionPct * 100);
          setForeignBankCharges(sheet.foreignBankCharges);
          
          const qPrice = sheet.quotedPrice !== undefined ? sheet.quotedPrice : sheet.orderFOB;
          const iFreight = sheet.intlFreight !== undefined ? sheet.intlFreight : 0;
          const iInsurance = sheet.intlInsurance !== undefined ? sheet.intlInsurance : 0;
          setQuotedPriceInput(qPrice.toString());
          setIntlFreight(iFreight.toString());
          setIntlInsurance(iInsurance.toString());

          // Set editable style fields from loaded sheet
          setCustomerName(sheet.customerName || "Duer");
          setStyleCategory(sheet.styleCategory || "Top Ware");
          setWashType(sheet.washType || "Rinse");
          setOrderQuantity(sheet.orderQuantity || 1000);
          setOrderType((sheet.orderType || "Denim") as "Denim" | "Non Denim");
          setNoOfColors(sheet.noOfColors !== undefined ? sheet.noOfColors : 1);
          setMerchGroup(sheet.merchGroup || "Ayaz");
          setDeliveryDestination(sheet.deliveryDestination || "EURO");
          setExFactoryDate(sheet.exFactoryDate || new Date().toISOString().split("T")[0]);
          setInhouseOrSubcontract(sheet.inhouseOrSubcontract || "INHOUSE");
          setRebatePct(sheet.rebatePct !== undefined ? sheet.rebatePct * 100 : 0);
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
        setQuotedPriceInput(activeStyle.baseSellingPrice.toString());
        setIntlFreight("0");
        setIntlInsurance("0");
        setRejectionOverride("");
        setEfficiencyOverride("");
        setLineTargetOverride("");

        // Set editable style fields from activeStyle defaults
        setCustomerName(activeStyle.customerName || "Duer");
        setStyleCategory(activeStyle.styleCategory || "Top Ware");
        setWashType(activeStyle.washType || "Rinse");
        setOrderQuantity(activeStyle.orderQuantity || 1000);
        setOrderType((activeStyle.orderType || "Denim") as "Denim" | "Non Denim");
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

  // Handle active style change from dropdown
  function handleStyleChange(id: string) {
    if (id === "custom") {
      setLoadedCostSheet(null);
      setActiveStyle(CUSTOM_STYLE);
      router.push("/cost-sheet?styleId=custom");
    } else {
      const selected = styles.find((s) => s.id === id);
      if (selected) {
        setLoadedCostSheet(null);
        setActiveStyle(selected);
        router.push(`/cost-sheet?styleId=${id}`);
      }
    }
  }

  // Right Panel: Local BOM edits state helpers
  function updateFabricBOM(idx: number, key: string, val: string | number) {
    if (!activeStyle) return;
    const nextFab = [...(activeStyle.bomFabric || [])];
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
    nextFab[idx] = {
      ...nextFab[idx],
      [key]: val,
    } as BOMFabricItem;
    // Recalculate costs
    if (key === "consumptionPerPc" || key === "rateUSD" || key === "ratePKR") {
      if (key === "rateUSD") {
        nextFab[idx].ratePKR = Number(val) * parityProcurement;
      } else if (key === "ratePKR") {
        nextFab[idx].rateUSD = Number(val) / parityProcurement;
      }
      nextFab[idx].fabricCostPKR = (nextFab[idx].consumptionPerPc || 0) * (nextFab[idx].ratePKR || 0);
    }
    setActiveStyle({
      ...activeStyle,
      bomFabric: nextFab,
    });
  }

  // Pocket Lining BOM
  function updateLiningBOM(idx: number, key: string, val: string | number) {
    if (!activeStyle) return;
    const nextLin = [...(activeStyle.bomLining || [])];
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
    nextLin[idx] = {
      ...nextLin[idx],
      [key]: val,
    } as BOMLiningItem;
    // Recalculate costs
    if (key === "consumptionPerPc" || key === "rateUSD" || key === "ratePKR") {
      if (key === "rateUSD") {
        nextLin[idx].ratePKR = Number(val) * parityProcurement;
      } else if (key === "ratePKR") {
        nextLin[idx].rateUSD = Number(val) / parityProcurement;
      }
      nextLin[idx].liningCostPKR = (nextLin[idx].consumptionPerPc || 0) * (nextLin[idx].ratePKR || 0);
    }
    setActiveStyle({
      ...activeStyle,
      bomLining: nextLin,
    });
  }

  function updateAccessoriesBOM(idx: number, key: string, val: string | number) {
    if (!activeStyle) return;
    const nextAcc = [...(activeStyle.bomAccessories || [])];
    for (let i = 0; i <= idx; i++) {
      if (!nextAcc[i]) {
        nextAcc[i] = {
          category: "Trims",
          itemName: "",
          consPerPc: 0,
          ratePKR: 0,
          totalCostPKR: 0,
        };
      }
    }
    nextAcc[idx] = {
      ...nextAcc[idx],
      [key]: val,
    } as BOMAccessoriesItem;
    if (key === "consPerPc" || key === "ratePKR") {
      nextAcc[idx].totalCostPKR = (nextAcc[idx].consPerPc || 0) * (nextAcc[idx].ratePKR || 0);
    }
    setActiveStyle({
      ...activeStyle,
      bomAccessories: nextAcc,
    });
  }

  function updateChemicalsBOM(idx: number, key: string, val: string | number) {
    if (!activeStyle) return;
    const nextChem = [...(activeStyle.bomChemicals || [])];
    for (let i = 0; i <= idx; i++) {
      if (!nextChem[i]) {
        nextChem[i] = {
          washItem: "",
          consPerPc: 0,
          ratePKR: 0,
          totalCostPKR: 0,
        };
      }
    }
    nextChem[idx] = {
      ...nextChem[idx],
      [key]: val,
    } as BOMChemicalsItem;
    if (key === "consPerPc" || key === "ratePKR") {
      nextChem[idx].totalCostPKR = (nextChem[idx].consPerPc || 0) * (nextChem[idx].ratePKR || 0);
    }
    setActiveStyle({
      ...activeStyle,
      bomChemicals: nextChem,
    });
  }

  function updateSpecialChargesBOM(idx: number, key: string, val: string | number) {
    if (!activeStyle) return;
    const nextChg = [...(activeStyle.bomSpecialCharges || [])];
    for (let i = 0; i <= idx; i++) {
      if (!nextChg[i]) {
        nextChg[i] = {
          itemName: "",
          consPerPc: 0,
          ratePKR: 0,
          totalCostPKR: 0,
        };
      }
    }
    nextChg[idx] = {
      ...nextChg[idx],
      [key]: val,
    } as BOMSpecialChargesItem;
    if (key === "consPerPc" || key === "ratePKR") {
      nextChg[idx].totalCostPKR = (nextChg[idx].consPerPc || 0) * (nextChg[idx].ratePKR || 0);
    }
    setActiveStyle({
      ...activeStyle,
      bomSpecialCharges: nextChg,
    });
  }

  // Save new snapshot
  async function handleSaveNew(name: string) {
    if (!activeStyle || !calcs) return;
    if (!name.trim()) {
      toast.error("Please enter a scenario reference name");
      return;
    }
    
    const nextId = generateCostSheetId(activeStyle.id);
    const snapshot: SavedCostSheetItem = {
      id: nextId,
      referenceName: name,
      styleId: activeStyle.id,
      styleName: activeStyle.styleName,
      customerName,
      styleCategory,
      orderQuantity,
      smvSewing: activeStyle.smvSewing,
      orderType,
      washType,
      noOfColors,
      merchGroup,
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
      paritySale,
      parityProcurement,
      manpower,
      efficiencyOverride: efficiencyOverride !== "" ? parseFloat(efficiencyOverride) / 100 : null,
      rejectionOverride: rejectionOverride !== "" ? parseFloat(rejectionOverride) / 100 : null,
      lineTargetOverride: lineTargetOverride !== "" ? parseFloat(lineTargetOverride) : null,
      
      discountRate,
      paymentTermsDays,
      factoringDays,
      commissionPct: commissionPct / 100,
      foreignBankCharges,
      orderFOB: (() => {
        const q = quotedPriceInput !== "" ? parseFloat(quotedPriceInput) : activeStyle.baseSellingPrice;
        const f = parseFloat(intlFreight) || 0;
        const i = parseFloat(intlInsurance) || 0;
        if (deliveryTerms === "CFR") return q - f;
        if (deliveryTerms === "CIF" || deliveryTerms === "DDP/LDP") return q - f - i;
        return q;
      })(),
      quotedPrice: quotedPriceInput !== "" ? parseFloat(quotedPriceInput) : activeStyle.baseSellingPrice,
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
      router.push(`/cost-sheet?costSheetId=${nextId}`);
    } catch (e) {
      toast.error("Failed to save cost sheet snapshot");
    }
  }

  // Update existing snapshot
  async function handleUpdateExisting() {
    if (!activeStyle || !calcs || !loadedCostSheet) return;
    
    const snapshot: SavedCostSheetItem = {
      ...loadedCostSheet,
      customerName,
      styleCategory,
      orderQuantity,
      orderType,
      washType,
      noOfColors,
      merchGroup,
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
      paritySale,
      parityProcurement,
      manpower,
      efficiencyOverride: efficiencyOverride !== "" ? parseFloat(efficiencyOverride) / 100 : null,
      rejectionOverride: rejectionOverride !== "" ? parseFloat(rejectionOverride) / 100 : null,
      lineTargetOverride: lineTargetOverride !== "" ? parseFloat(lineTargetOverride) : null,
      
      discountRate,
      paymentTermsDays,
      factoringDays,
      commissionPct: commissionPct / 100,
      foreignBankCharges,
      orderFOB: (() => {
        const q = quotedPriceInput !== "" ? parseFloat(quotedPriceInput) : activeStyle.baseSellingPrice;
        const f = parseFloat(intlFreight) || 0;
        const i = parseFloat(intlInsurance) || 0;
        if (deliveryTerms === "CFR") return q - f;
        if (deliveryTerms === "CIF" || deliveryTerms === "DDP/LDP") return q - f - i;
        return q;
      })(),
      quotedPrice: quotedPriceInput !== "" ? parseFloat(quotedPriceInput) : activeStyle.baseSellingPrice,
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
    } catch (e) {
      toast.error("Failed to update cost sheet");
    }
  }

  // Reactive Calculation Engine
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const calcs = useMemo(() => {
    if (!activeStyle) return null;

    const effOv = efficiencyOverride !== "" ? parseFloat(efficiencyOverride) / 100 : null;
    const rejOv = rejectionOverride !== "" ? parseFloat(rejectionOverride) / 100 : null;
    const tgtOv = lineTargetOverride !== "" ? parseFloat(lineTargetOverride) : null;
    
    const qPrice = quotedPriceInput !== "" ? parseFloat(quotedPriceInput) : activeStyle.baseSellingPrice;
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
    };

    return runFormulaEngine(
      overriddenStyle,
      {
        orderFOB: calculatedOrderFOB,
        paritySale,
        parityProcurement,
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
        inhouseOrSubcontract,
        rebatePct: rebatePct / 100,
      },
      {
        directLabourFoh,
        cutToShipGrid,
        rejectionGrid,
      }
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
    paymentTermsDays,
    factoringDays,
    commissionPct,
    foreignBankCharges,
    inhouseOrSubcontract,
    rebatePct,
    directLabourFoh,
    cutToShipGrid,
    rejectionGrid,
  ]);

  if (loadingStyles || !activeStyle || !calcs) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading Cost Sheet calculator…</div>;
  }

  // Helper formatting classes
  const isProfitPositive = calcs.netProfitUSD >= 0;
  const isEbitdaPositive = calcs.ebitdaUSD >= 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Cost Sheet Calculator</h1>
            {loadedCostSheet && (
              <Badge variant="outline" className="text-xs border-blue-200 bg-blue-50 text-blue-800 font-semibold px-2.5 py-1 rounded-md">
                Snapshot: {loadedCostSheet.id} ({loadedCostSheet.referenceName})
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time interactive order costing dashboard connected directly with style specifications and factory overheads.
          </p>
        </div>
        {loadedCostSheet && (
          <div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoadedCostSheet(null);
                router.push(`/cost-sheet?styleId=${activeStyle.id}`);
              }}
              className="h-9"
            >
              Exit Snapshot Mode
            </Button>
          </div>
        )}
      </div>

      {/* ZONE 1: HEADER CONTROLS & INPUTS (Soft blue background) */}
      <Card className="bg-[#f2f7fc]/80 dark:bg-slate-900/40 border-blue-100 shadow-sm">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-blue-100/50 pb-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-blue-900/80 dark:text-blue-200">Select Apparel Style</label>
              <select
                className="w-full h-9 rounded-md border border-blue-200 bg-background px-3 py-1.5 text-sm shadow-sm focus-visible:outline-none focus:ring-1 focus:ring-blue-400 font-semibold"
                value={activeStyle.id}
                onChange={(e) => handleStyleChange(e.target.value)}
              >
                <option value="custom">-- Custom Style / Manual Input --</option>
                {styles.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.id} - {s.styleName} ({s.customerName})
                  </option>
                ))}
              </select>
              {activeStyle.id === "custom" && (
                <div className="space-y-1 pt-1.5">
                  <label className="text-xs font-semibold text-blue-900/80 dark:text-blue-200">Style Name *</label>
                  <Input
                    type="text"
                    className="h-7 text-xs border-blue-200 px-2 font-semibold"
                    value={activeStyle.styleName || ""}
                    onChange={(e) => {
                      setActiveStyle({
                        ...activeStyle,
                        styleName: e.target.value,
                      });
                    }}
                    placeholder="Enter custom style name"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm bg-white/50 dark:bg-slate-950/30 p-2.5 rounded-md border border-blue-100/50">
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground font-semibold">Customer:</span>
                <select
                  className="w-full h-7 rounded border border-blue-200 bg-background px-2 py-0.5 text-xs focus-visible:outline-none focus:ring-1 focus:ring-blue-400 font-semibold"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                >
                  {customersList.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground font-semibold">Style Category:</span>
                <select
                  className="w-full h-7 rounded border border-blue-200 bg-background px-2 py-0.5 text-xs focus-visible:outline-none focus:ring-1 focus:ring-blue-400 font-semibold"
                  value={styleCategory}
                  onChange={(e) => setStyleCategory(e.target.value)}
                >
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground font-semibold">Wash Type:</span>
                <select
                  className="w-full h-7 rounded border border-blue-200 bg-background px-2 py-0.5 text-xs focus-visible:outline-none focus:ring-1 focus:ring-blue-400 font-semibold"
                  value={washType}
                  onChange={(e) => setWashType(e.target.value)}
                >
                  {washTypesList.map((w) => (
                    <option key={w} value={w}>{w}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-0.5">
                <span className="text-xs text-muted-foreground font-semibold">Order Qty:</span>
                <Input
                  type="number"
                  className="h-7 text-xs border-blue-200 px-2 font-semibold"
                  value={orderQuantity}
                  onChange={(e) => setOrderQuantity(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm bg-white/50 dark:bg-slate-950/30 p-2.5 rounded-md border border-blue-100/50">
              <div>
                <span className="text-xs text-muted-foreground">Size Bracket:</span>
                <p className="font-semibold text-primary">{calcs.sizeBracket}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">SMV (Sewing):</span>
                <p className="font-semibold">{activeStyle.smvSewing} min</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Style Class:</span>
                <p className="font-semibold">{calcs.styleCategory}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Base FOB:</span>
                <p className="font-semibold">${activeStyle.baseSellingPrice.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Costing Date</label>
              <Input
                type="date"
                className="h-8 text-xs border-blue-200"
                value={costingDate}
                onChange={(e) => setCostingDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Ex-Factory Date</label>
              <Input
                type="date"
                className="h-8 text-xs border-blue-200"
                value={exFactoryDate}
                onChange={(e) => setExFactoryDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Costing Stage</label>
              <select
                className="w-full h-8 rounded-md border border-blue-200 bg-background px-2 text-xs focus-visible:outline-none"
                value={costingStage}
                onChange={(e) => setCostingStage(e.target.value)}
              >
                <option value="Quote">Quote</option>
                <option value="Final">Final</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Order Type</label>
              <select
                className="w-full h-8 rounded-md border border-blue-200 bg-background px-2 text-xs focus-visible:outline-none font-semibold"
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as "Denim" | "Non Denim")}
              >
                <option value="Denim">Denim</option>
                <option value="Non Denim">Non Denim</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Inhouse / CMT</label>
              <select
                className="w-full h-8 rounded-md border border-blue-200 bg-background px-2 text-xs focus-visible:outline-none font-semibold"
                value={inhouseOrSubcontract}
                onChange={(e) => setInhouseOrSubcontract(e.target.value)}
              >
                <option value="INHOUSE">INHOUSE</option>
                <option value="CMT">CMT (Sub-contract)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">No. of Colors</label>
              <Input
                type="number"
                min="1"
                className="h-8 text-xs border-blue-200"
                value={noOfColors}
                onChange={(e) => setNoOfColors(Math.max(1, Number(e.target.value)))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Per Color Qty</label>
              <Input
                type="text"
                disabled
                className="h-8 text-xs border-blue-200 bg-blue-100/30 text-slate-500 font-semibold"
                value={Math.round(orderQuantity / noOfColors)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Merch Group</label>
              <Input
                type="text"
                className="h-8 text-xs border-blue-200"
                value={merchGroup}
                onChange={(e) => setMerchGroup(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Delivery Dest.</label>
              <select
                className="w-full h-8 rounded-md border border-blue-200 bg-background px-2 text-xs focus-visible:outline-none font-semibold"
                value={deliveryDestination}
                onChange={(e) => setDeliveryDestination(e.target.value)}
              >
                <option value="EURO">EURO</option>
                <option value="USA">USA</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Country</label>
              <select
                className="w-full h-8 rounded-md border border-blue-200 bg-background px-2 text-xs focus-visible:outline-none"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                {countriesList.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Payment Terms</label>
              <select
                className="w-full h-8 rounded-md border border-blue-200 bg-background px-2 text-xs focus-visible:outline-none"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              >
                {paymentTermsList.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Shipment Mode</label>
              <select
                className="w-full h-8 rounded-md border border-blue-200 bg-background px-2 text-xs focus-visible:outline-none"
                value={shipmentMode}
                onChange={(e) => setShipmentMode(e.target.value)}
              >
                <option value="Sea">Sea</option>
                <option value="Air">Air</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Delivery Terms</label>
              <select
                className="w-full h-8 rounded-md border border-blue-200 bg-background px-2 text-xs focus-visible:outline-none"
                value={deliveryTerms}
                onChange={(e) => setDeliveryTerms(e.target.value)}
              >
                {deliveryTermsList.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Parity - Sale (Rs/$)</label>
              <Input
                type="number"
                className="h-8 text-xs border-blue-200"
                value={paritySale}
                onChange={(e) => setParitySale(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Parity - Proc. (Rs/$)</label>
              <Input
                type="number"
                className="h-8 text-xs border-blue-200"
                value={parityProcurement}
                onChange={(e) => setParityProcurement(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Manpower/Line</label>
              <Input
                type="number"
                className="h-8 text-xs border-blue-200"
                value={manpower}
                onChange={(e) => setManpower(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Line Efficiency %</label>
              <Input
                type="text"
                disabled
                className="h-8 text-xs border-blue-200 bg-blue-100/30 text-slate-500 font-semibold"
                value={`${(calcs.efficiency * 100).toFixed(1)}%`}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Rejection %</label>
              <Input
                type="text"
                disabled
                className="h-8 text-xs border-blue-200 bg-blue-100/30 text-slate-500 font-semibold"
                value={`${(calcs.rejectionPct * 100).toFixed(2)}%`}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-blue-900/80 dark:text-blue-200">Line Target (Pc/Day)</label>
              <Input
                type="text"
                disabled
                className="h-8 text-xs border-blue-200 bg-blue-100/30 text-slate-500 font-semibold"
                value={`${calcs.lineTarget.toFixed(0)}`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ZONE 2: KPI PROFITABILITY HEADER CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 xl:grid-cols-10 gap-3">
        <Card className="shadow-sm border-muted/50">
          <CardContent className="p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Target FOB</span>
            <p className="text-lg font-extrabold text-foreground mt-0.5">${calcs.targetFobUSD.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-muted/50 bg-blue-50/10 border-blue-100">
          <CardContent className="p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-300">
              {deliveryTerms === "FOB" ? "Order FOB" : `Quoted Price (${deliveryTerms})`}
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
              <span className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-300">Intl. Freight/Pc</span>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span className="text-xs font-bold text-muted-foreground">$</span>
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
              <span className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-300">Intl. Insurance/Pc</span>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <span className="text-xs font-bold text-muted-foreground">$</span>
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
              <span className="text-[10px] uppercase font-bold text-slate-500">Net Order FOB</span>
              <p className="text-lg font-extrabold text-slate-800 mt-0.5">${calcs.sellingPriceUSD.toFixed(2)}</p>
            </CardContent>
          </Card>
        )}
        <Card className="shadow-sm border-muted/50">
          <CardContent className="p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Order CM/PC</span>
            <p className="text-lg font-extrabold text-foreground mt-0.5">
              ${((quotedPriceInput === "" || parseFloat(quotedPriceInput) === 0) ? 0 : calcs.cmUSD).toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-muted/50">
          <CardContent className="p-3 text-center">
            <span className="text-[10px] uppercase font-bold text-muted-foreground">Order CM/SMV</span>
            <p className="text-lg font-extrabold text-foreground mt-0.5">
              {((quotedPriceInput === "" || parseFloat(quotedPriceInput) === 0) ? 0 : calcs.cmMinuteUSD).toFixed(2)}¢
            </p>
          </CardContent>
        </Card>
        <Card className={`shadow-sm transition-colors border-muted/50 ${isEbitdaPositive ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200" : "bg-red-50/50 dark:bg-red-950/20 border-red-200"}`}>
          <CardContent className="p-3 text-center">
            <span className={`text-[10px] uppercase font-bold ${isEbitdaPositive ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}>EBITDA / Min</span>
            <p className={`text-lg font-extrabold mt-0.5 ${isEbitdaPositive ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
              {((quotedPriceInput === "" || parseFloat(quotedPriceInput) === 0) ? 0 : calcs.ebitdaMinCents).toFixed(2)}¢
            </p>
          </CardContent>
        </Card>
        <Card className={`shadow-sm transition-colors border-muted/50 ${isProfitPositive ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200" : "bg-red-50/50 dark:bg-red-950/20 border-red-200"}`}>
          <CardContent className="p-3 text-center">
            <span className={`text-[10px] uppercase font-bold ${isProfitPositive ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}>Net Profit/PC</span>
            <p className={`text-lg font-extrabold mt-0.5 ${isProfitPositive ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
              ${((quotedPriceInput === "" || parseFloat(quotedPriceInput) === 0) ? 0 : calcs.netProfitUSD).toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card className={`shadow-sm transition-colors border-muted/50 ${isProfitPositive ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200" : "bg-red-50/50 dark:bg-red-950/20 border-red-200"}`}>
          <CardContent className="p-3 text-center">
            <span className={`text-[10px] uppercase font-bold ${isProfitPositive ? "text-emerald-800 dark:text-emerald-300" : "text-red-800 dark:text-red-300"}`}>Net Profit %</span>
            <p className={`text-lg font-extrabold mt-0.5 ${isProfitPositive ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}`}>
              {(((quotedPriceInput === "" || parseFloat(quotedPriceInput) === 0) ? 0 : calcs.netProfitPct) * 100).toFixed(2)}%
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
              <Calculator className="size-4 text-primary" /> Cost & Profitability Summary
            </h2>
            <span className="text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 font-semibold px-2 py-0.5 rounded-full">Per Pc Calculations</span>
          </div>
          <CardContent className="p-0 text-xs">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-semibold text-foreground">Cost Element</TableHead>
                  <TableHead className="text-right font-semibold text-foreground w-20">PKR</TableHead>
                  <TableHead className="text-right font-semibold text-foreground w-20">USD</TableHead>
                  <TableHead className="text-right font-semibold text-foreground w-16">% Sales</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* REVENUE */}
                <TableRow className="bg-muted/10 font-semibold">
                  <TableCell>Selling Price (FOB)</TableCell>
                  <TableCell className="text-right">Rs. {calcs.sellingPricePKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right">${calcs.sellingPriceUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right">100.0%</TableCell>
                </TableRow>

                {/* DEDUCTIONS */}
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground">Tax & EDS (2.5%)</TableCell>
                  <TableCell className="text-right text-muted-foreground">{calcs.taxEDS_PKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">${calcs.taxEDS_USD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.taxEDS_Pct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground flex items-center gap-1">
                    Rebate (add)
                  </TableCell>
                  <TableCell className="p-2 text-right">
                    <div className="flex justify-end gap-1">
                      <span className="text-[10px] text-muted-foreground align-middle">%:</span>
                      <input
                        type="number"
                        step="0.01"
                        className="w-10 h-5 text-[11px] bg-blue-50/50 border border-blue-200 text-center rounded focus:outline-none"
                        value={rebatePct}
                        onChange={(e) => setRebatePct(Number(e.target.value))}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">${calcs.rebateUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.rebatePct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground">Inland Freight & Clearing</TableCell>
                  <TableCell className="text-right text-muted-foreground">{calcs.freightPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">${calcs.freightUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.freightPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground">Local Bank Charges (0.85%)</TableCell>
                  <TableCell className="text-right text-muted-foreground">{calcs.bankChargesPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">${calcs.bankChargesUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.bankChargesPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground flex items-center gap-1">
                    Markup & Discounting
                    <span className="cursor-help" title="Rs Selling Price * (Discount Rate / 365) * Discount Days">
                      <Info className="size-3 text-muted-foreground" />
                    </span>
                  </TableCell>
                  <TableCell className="p-2 text-right">
                    <div className="flex justify-end gap-1">
                      <span className="text-[10px] text-muted-foreground align-middle">Days:</span>
                      <input
                        type="number"
                        className="w-10 h-5 text-[11px] bg-blue-50/50 border border-blue-200 text-center rounded focus:outline-none"
                        value={paymentTermsDays}
                        onChange={(e) => setPaymentTermsDays(Number(e.target.value))}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">${calcs.markupDiscountUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.markupDiscountPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground flex items-center gap-1">
                    Factoring Cost
                    <span className="cursor-help" title="Rs Selling Price * (Discount Rate / 365) * Factoring Days">
                      <Info className="size-3 text-muted-foreground" />
                    </span>
                  </TableCell>
                  <TableCell className="p-2 text-right">
                    <div className="flex justify-end gap-1">
                      <span className="text-[10px] text-muted-foreground align-middle">Days:</span>
                      <input
                        type="number"
                        className="w-10 h-5 text-[11px] bg-blue-50/50 border border-blue-200 text-center rounded focus:outline-none"
                        value={factoringDays}
                        onChange={(e) => setFactoringDays(Number(e.target.value))}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">${calcs.factoringUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.factoringPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground flex items-center gap-1">
                    Customer Commission
                  </TableCell>
                  <TableCell className="p-2 text-right">
                    <div className="flex justify-end gap-1">
                      <span className="text-[10px] text-muted-foreground align-middle">%:</span>
                      <input
                        type="number"
                        className="w-10 h-5 text-[11px] bg-blue-50/50 border border-blue-200 text-center rounded focus:outline-none"
                        value={commissionPct}
                        onChange={(e) => setCommissionPct(Number(e.target.value))}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">${calcs.commissionUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.commissionPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground">Foreign Bank Charges ($)</TableCell>
                  <TableCell className="p-2 text-right">
                    <div className="flex justify-end gap-1">
                      <span className="text-[10px] text-muted-foreground align-middle">$</span>
                      <input
                        type="number"
                        step="0.01"
                        className="w-12 h-5 text-[11px] bg-blue-50/50 border border-blue-200 text-center rounded focus:outline-none"
                        value={foreignBankCharges}
                        onChange={(e) => setForeignBankCharges(Number(e.target.value))}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">${calcs.foreignBankChargesUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.foreignBankChargesPct * 100).toFixed(2)}%</TableCell>
                </TableRow>

                {/* NET SELLING PRICE */}
                <TableRow className="bg-blue-50/30 font-semibold border-t border-b">
                  <TableCell>Net Selling Price</TableCell>
                  <TableCell className="text-right">Rs. {calcs.netPricePKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right">${calcs.netPriceUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{(calcs.netPricePct * 100).toFixed(1)}%</TableCell>
                </TableRow>

                {/* VARIABLE COSTS */}
                <TableRow>
                  <TableCell className="pl-4 font-medium text-foreground">Fabric Cost</TableCell>
                  <TableCell className="text-right font-medium">Rs. {calcs.fabricCostPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-medium">${calcs.fabricCostUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.fabricCostPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4 font-medium text-foreground">Lining Cost</TableCell>
                  <TableCell className="text-right font-medium">Rs. {calcs.liningCostPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-medium">${calcs.liningCostUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.liningCostPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4 font-medium text-foreground">Accessories Cost</TableCell>
                  <TableCell className="text-right font-medium">Rs. {calcs.accessoriesCostPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-medium">${calcs.accessoriesCostUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.accessoriesCostPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4 font-medium text-foreground">Chemical & Washing Cost</TableCell>
                  <TableCell className="text-right font-medium">Rs. {calcs.chemicalsCostPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-medium">${calcs.chemicalsCostUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.chemicalsCostPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4 font-medium text-foreground">Special Charges Cost</TableCell>
                  <TableCell className="text-right font-medium">Rs. {calcs.specialChargesCostPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-medium">${calcs.specialChargesCostUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.specialChargesCostPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4 font-medium text-foreground">Direct Labor Cost (CPM-linked)</TableCell>
                  <TableCell className="text-right font-medium">Rs. {calcs.directLaborCostPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-medium">${calcs.directLaborCostUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.directLaborCostPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4 font-medium text-foreground">Utilities Cost (CPM-linked)</TableCell>
                  <TableCell className="text-right font-medium">Rs. {calcs.utilitiesCostPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-medium">${calcs.utilitiesCostUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.utilitiesCostPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-4 font-medium text-foreground">Leftover Factor Cost</TableCell>
                  <TableCell className="text-right font-medium">Rs. {calcs.leftoverCostPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right font-medium">${calcs.leftoverCostUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.leftoverCostPct * 100).toFixed(2)}%</TableCell>
                </TableRow>

                {/* TOTAL VARIABLE COST */}
                <TableRow className="bg-[#fcf5e3]/60 dark:bg-amber-950/20 font-semibold border-t border-b">
                  <TableCell>Total Variable Cost</TableCell>
                  <TableCell className="text-right">Rs. {calcs.totalVariableCostPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right">${calcs.totalVariableCostUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{(calcs.totalVariableCostPct * 100).toFixed(1)}%</TableCell>
                </TableRow>

                {/* CM / PC */}
                <TableRow className="bg-emerald-50/30 dark:bg-emerald-950/10 font-bold text-emerald-800 dark:text-emerald-400">
                  <TableCell>Gross CM / PC</TableCell>
                  <TableCell className="text-right">Rs. {calcs.cmPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right">${calcs.cmUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{(calcs.cmPct * 100).toFixed(1)}%</TableCell>
                </TableRow>

                {/* OVERHEADS */}
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground">Salaries Cost (CPM-linked)</TableCell>
                  <TableCell className="text-right text-muted-foreground">{calcs.salariesCostPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">${calcs.salariesCostUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.salariesCostPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground">FOH/Admin Cost (CPM-linked)</TableCell>
                  <TableCell className="text-right text-muted-foreground">{calcs.fohAdminCostPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">${calcs.fohAdminCostUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.fohAdminCostPct * 100).toFixed(2)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground">Repair & Maintenance (CPM-linked)</TableCell>
                  <TableCell className="text-right text-muted-foreground">{calcs.repairMtcCostPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">${calcs.repairMtcCostUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.repairMtcCostPct * 100).toFixed(2)}%</TableCell>
                </TableRow>

                {/* TOTAL COST */}
                <TableRow className="font-semibold border-t">
                  <TableCell>Total Cost</TableCell>
                  <TableCell className="text-right">Rs. {calcs.totalCostPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right">${calcs.totalCostUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{(calcs.totalCostPct * 100).toFixed(1)}%</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground">Conversion Cost per Minute</TableCell>
                  <TableCell className="text-right text-muted-foreground">Rs. {calcs.conversionCostPerMinPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{calcs.conversionCostPerMinUSD.toFixed(2)}¢</TableCell>
                  <TableCell className="text-right text-muted-foreground">-</TableCell>
                </TableRow>

                {/* EBITDA */}
                <TableRow className={`font-extrabold border-t border-b ${isEbitdaPositive ? "text-emerald-700 dark:text-emerald-400 bg-emerald-50/10" : "text-red-700 dark:text-red-400 bg-red-50/10"}`}>
                  <TableCell>EBITDA / PC</TableCell>
                  <TableCell className="text-right">Rs. {calcs.ebitdaPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right">${calcs.ebitdaUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{(calcs.ebitdaPct * 100).toFixed(1)}%</TableCell>
                </TableRow>

                {/* DEPRECIATION */}
                <TableRow>
                  <TableCell className="pl-6 text-muted-foreground">Depreciation Cost (CPM-linked)</TableCell>
                  <TableCell className="text-right text-muted-foreground">{calcs.depreciationCostPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">${calcs.depreciationCostUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{(calcs.depreciationCostPct * 100).toFixed(2)}%</TableCell>
                </TableRow>

                {/* NET PROFIT */}
                <TableRow className={`font-black border-t-2 text-sm ${isProfitPositive ? "text-emerald-800 dark:text-emerald-400 bg-emerald-50/40" : "text-red-800 dark:text-red-400 bg-red-50/40"}`}>
                  <TableCell>Net Profit / PC</TableCell>
                  <TableCell className="text-right">Rs. {calcs.netProfitPKR.toFixed(1)}</TableCell>
                  <TableCell className="text-right">${calcs.netProfitUSD.toFixed(3)}</TableCell>
                  <TableCell className="text-right">{(calcs.netProfitPct * 100).toFixed(1)}%</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* RIGHT PANEL: DETAILED INTERACTIVE BOM & EXPENSE TABLES */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* FABRIC BOM */}
          <Card className="shadow-md border-muted/60 bg-card overflow-hidden">
            <div className="bg-muted/40 px-4 py-3 border-b flex justify-between items-center">
              <h2 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Layers className="size-4 text-primary" /> Fabric Details (USD input)
              </h2>
              <span className="text-[10px] text-muted-foreground">Rates edit in USD</span>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const rawItem = activeStyle.bomFabric[idx];
                    const item = {
                      itemName: rawItem?.itemName ?? `Fabric ${idx+1}`,
                      consumptionPerPc: rawItem?.consumptionPerPc ?? 0,
                      rateUSD: rawItem?.rateUSD ?? 0,
                      ratePKR: rawItem?.ratePKR ?? 0,
                      fabricCostPKR: rawItem?.fabricCostPKR ?? 0,
                    };
                    return (
                      <TableRow key={idx}>
                        <TableCell className="p-1.5">
                          <input
                            type="text"
                            disabled={activeStyle.id !== "custom"}
                            placeholder={`Fabric ${idx+1}`}
                            className="w-full h-7 px-2 border bg-transparent text-xs rounded focus:outline-none disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                            value={item.itemName}
                            onChange={(e) => updateFabricBOM(idx, "itemName", e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            disabled={activeStyle.id !== "custom"}
                            step="0.01"
                            placeholder="0.00"
                            className="w-full h-7 px-2 border bg-transparent text-xs rounded text-center focus:outline-none bg-blue-50/10 disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                            value={item.consumptionPerPc || ""}
                            onChange={(e) => updateFabricBOM(idx, "consumptionPerPc", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            disabled={activeStyle.id !== "custom"}
                            step="0.01"
                            placeholder="0.00"
                            className="w-full h-7 px-2 border bg-transparent text-xs rounded text-center focus:outline-none bg-blue-50/10 disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                            value={item.rateUSD || ""}
                            onChange={(e) => updateFabricBOM(idx, "rateUSD", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="p-1.5 text-right font-medium text-muted-foreground align-middle">
                          Rs. {item.ratePKR.toFixed(1)}
                        </TableCell>
                        <TableCell className="p-1.5 text-right font-semibold text-foreground align-middle pr-4">
                          Rs. {item.fabricCostPKR.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/10 font-bold">
                    <TableCell colSpan={4} className="text-right">Total Fabric Cost:</TableCell>
                    <TableCell className="text-right text-primary pr-4">Rs. {calcs.fabricCostPKR.toFixed(1)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* POCKET LINING BOM */}
          <Card className="shadow-md border-muted/60 bg-card overflow-hidden">
            <div className="bg-muted/40 px-4 py-3 border-b flex justify-between items-center">
              <h2 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Layers className="size-4 text-primary" /> Pocket Lining Details (USD input)
              </h2>
              <span className="text-[10px] text-muted-foreground">Rates edit in USD</span>
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from({ length: 5 }).map((_, idx) => {
                    const rawItem = activeStyle.bomLining[idx];
                    const item = {
                      itemName: rawItem?.itemName ?? `Lining ${idx+1}`,
                      consumptionPerPc: rawItem?.consumptionPerPc ?? 0,
                      rateUSD: rawItem?.rateUSD ?? 0,
                      ratePKR: rawItem?.ratePKR ?? 0,
                      liningCostPKR: rawItem?.liningCostPKR ?? 0,
                    };
                    return (
                      <TableRow key={idx}>
                        <TableCell className="p-1.5">
                          <input
                            type="text"
                            disabled={activeStyle.id !== "custom"}
                            placeholder={`Lining ${idx+1}`}
                            className="w-full h-7 px-2 border bg-transparent text-xs rounded focus:outline-none disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                            value={item.itemName}
                            onChange={(e) => updateLiningBOM(idx, "itemName", e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            disabled={activeStyle.id !== "custom"}
                            step="0.01"
                            placeholder="0.00"
                            className="w-full h-7 px-2 border bg-transparent text-xs rounded text-center focus:outline-none bg-blue-50/10 disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                            value={item.consumptionPerPc || ""}
                            onChange={(e) => updateLiningBOM(idx, "consumptionPerPc", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            disabled={activeStyle.id !== "custom"}
                            step="0.01"
                            placeholder="0.00"
                            className="w-full h-7 px-2 border bg-transparent text-xs rounded text-center focus:outline-none bg-blue-50/10 disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                            value={item.rateUSD || ""}
                            onChange={(e) => updateLiningBOM(idx, "rateUSD", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="p-1.5 text-right font-medium text-muted-foreground align-middle">
                          Rs. {item.ratePKR.toFixed(1)}
                        </TableCell>
                        <TableCell className="p-1.5 text-right font-semibold text-foreground align-middle pr-4">
                          Rs. {item.liningCostPKR.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/10 font-bold">
                    <TableCell colSpan={4} className="text-right">Total Lining Cost:</TableCell>
                    <TableCell className="text-right text-primary pr-4">Rs. {calcs.liningCostPKR.toFixed(1)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* ACCESSORIES, CHEMICALS, & SPECIAL CHARGES */}
          <Card className="shadow-md border-muted/60 bg-card overflow-hidden">
            <div className="bg-muted/40 px-4 py-3 border-b flex justify-between items-center">
              <h2 className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                <Layers className="size-4 text-primary" /> Trims, Chemicals & Special Charges (PKR Input)
              </h2>
              <span className="text-[10px] text-muted-foreground">Rates edit in PKR</span>
            </div>
            <CardContent className="p-0 text-xs">
              <div className="max-h-[350px] overflow-auto">
                <Table>
                  <TableHeader className="bg-muted/30 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-28">Category</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="w-16">Cons.</TableHead>
                      <TableHead className="w-24">Rate (Rs)</TableHead>
                      <TableHead className="w-28 text-right">Cost (Rs)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* ACCESSORIES */}
                    <TableRow className="bg-muted/20 font-bold"><TableCell colSpan={5}>Accessories (Before & After Wash)</TableCell></TableRow>
                    {activeStyle.bomAccessories.map((item, idx) => (
                      <TableRow key={`acc-${idx}`}>
                        <TableCell className="p-1.5 pl-4 text-[10px] text-muted-foreground font-semibold uppercase">{item.category}</TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="text"
                            disabled={activeStyle.id !== "custom"}
                            className="w-full h-7 px-2 border bg-transparent text-xs rounded focus:outline-none disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                            value={item.itemName}
                            onChange={(e) => updateAccessoriesBOM(idx, "itemName", e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            disabled={activeStyle.id !== "custom"}
                            step="0.01"
                            className="w-full h-7 px-1 border bg-transparent text-xs text-center rounded focus:outline-none bg-blue-50/10 disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                            value={item.consPerPc || ""}
                            onChange={(e) => updateAccessoriesBOM(idx, "consPerPc", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            disabled={activeStyle.id !== "custom"}
                            className="w-full h-7 px-2 border bg-transparent text-xs text-center rounded focus:outline-none bg-blue-50/10 disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                            value={item.ratePKR || ""}
                            onChange={(e) => updateAccessoriesBOM(idx, "ratePKR", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="p-1.5 text-right font-semibold text-foreground align-middle pr-4">
                          Rs. {(item.totalCostPKR || 0).toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* CHEMICALS */}
                    <TableRow className="bg-muted/20 font-bold"><TableCell colSpan={5}>Chemical Costs</TableCell></TableRow>
                    {activeStyle.bomChemicals.map((item, idx) => (
                      <TableRow key={`chem-${idx}`}>
                        <TableCell className="p-1.5 pl-4 text-[10px] text-muted-foreground font-semibold uppercase">Chemicals</TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="text"
                            disabled={activeStyle.id !== "custom"}
                            className="w-full h-7 px-2 border bg-transparent text-xs rounded focus:outline-none disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                            value={item.washItem}
                            onChange={(e) => updateChemicalsBOM(idx, "washItem", e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            disabled={activeStyle.id !== "custom"}
                            step="0.01"
                            className="w-full h-7 px-1 border bg-transparent text-xs text-center rounded focus:outline-none bg-blue-50/10 disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                            value={item.consPerPc || ""}
                            onChange={(e) => updateChemicalsBOM(idx, "consPerPc", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            disabled={activeStyle.id !== "custom"}
                            className="w-full h-7 px-2 border bg-transparent text-xs text-center rounded focus:outline-none bg-blue-50/10 disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                            value={item.ratePKR || ""}
                            onChange={(e) => updateChemicalsBOM(idx, "ratePKR", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="p-1.5 text-right font-semibold text-foreground align-middle pr-4">
                          Rs. {(item.totalCostPKR || 0).toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* SPECIAL CHARGES */}
                    <TableRow className="bg-muted/20 font-bold"><TableCell colSpan={5}>Special Charges (Embroidery, Testing, etc.)</TableCell></TableRow>
                    {activeStyle.bomSpecialCharges.map((item, idx) => (
                      <TableRow key={`chg-${idx}`}>
                        <TableCell className="p-1.5 pl-4 text-[10px] text-muted-foreground font-semibold uppercase">{item.itemName}</TableCell>
                        <TableCell className="p-1.5 font-medium text-xs align-middle">
                          {item.itemName} Charges
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            disabled={activeStyle.id !== "custom"}
                            step="0.01"
                            className="w-full h-7 px-1 border bg-transparent text-xs text-center rounded focus:outline-none bg-blue-50/10 disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                            value={item.consPerPc || ""}
                            onChange={(e) => updateSpecialChargesBOM(idx, "consPerPc", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="p-1.5">
                          <input
                            type="number"
                            disabled={activeStyle.id !== "custom"}
                            className="w-full h-7 px-2 border bg-transparent text-xs text-center rounded focus:outline-none bg-blue-50/10 disabled:bg-slate-100/50 disabled:text-muted-foreground disabled:cursor-not-allowed"
                            value={item.ratePKR || ""}
                            onChange={(e) => updateSpecialChargesBOM(idx, "ratePKR", Number(e.target.value))}
                          />
                        </TableCell>
                        <TableCell className="p-1.5 text-right font-semibold text-foreground align-middle pr-4">
                          Rs. {(item.totalCostPKR || 0).toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* ACTION BUTTONS PANEL */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => {
              if (loadedCostSheet) {
                // Restore values of the loaded snapshot
                router.push(`/cost-sheet?costSheetId=${loadedCostSheet.id}`);
                toast.info("Calculator reset to snapshot defaults");
              } else {
                setActiveStyle({ ...activeStyle });
                toast.info("Calculator reset to Style Master defaults");
              }
            }} className="h-9">
              <RefreshCw className="mr-1.5 size-4" /> Reset Calculator
            </Button>
            {loadedCostSheet ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setSaveDialogOpen(true)} className="h-9 border-primary text-primary hover:bg-primary/5">
                  <Copy className="mr-1.5 size-4" /> Save as New Snapshot
                </Button>
                <Button size="sm" onClick={handleUpdateExisting} className="h-9">
                  <Save className="mr-1.5 size-4" /> Update Cost Sheet
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setSaveDialogOpen(true)} className="h-9">
                <Save className="mr-1.5 size-4" /> Save Cost Sheet Snapshot
              </Button>
            )}
          </div>

          {/* Snapshot Naming Dialog */}
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Save Cost Sheet Snapshot</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-3">
                <p className="text-xs text-muted-foreground">
                  Enter a short description or scenario name to save this run snapshot (e.g. &quot;Scenario A - Base Quote&quot;).
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Snapshot Reference Name</label>
                  <Input
                    value={newSnapshotName}
                    onChange={(e) => setNewSnapshotName(e.target.value)}
                    placeholder="e.g. V1 - Initial Target FOB"
                    maxLength={50}
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end border-t pt-3">
                <Button variant="outline" size="sm" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
                <Button size="sm" onClick={() => handleSaveNew(newSnapshotName)}>Save Snapshot</Button>
              </div>
            </DialogContent>
          </Dialog>

        </div>

      </div>
    </div>
  );
}
