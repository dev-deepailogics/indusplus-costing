"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { CostSheetService } from "../services/CostSheetService";
import { runFormulaEngine, calculateSizeBracket, mapSMVToCategory, type CalculationResult } from "../services/CostSheetFormulaEngine";
import type { SavedCostSheetItem } from "../types";
import { ItemCatalogService, FABRIC_COLLECTION, LINING_COLLECTION, type CatalogItem } from "@/features/item-catalog";
import { ParametersService, type SimpleTableData, type MatrixTableData, type ProcessMatrixTableData, type DropdownListsData } from "@/features/parameters";
import { StyleMasterService, type StyleMasterItem, type BOMFabricItem, type BOMLiningItem, type BOMAccessoriesItem, type BOMChemicalsItem, type BOMSpecialChargesItem } from "@/features/style-master";
import type { StyleWorkOrderRow } from "@/app/api/styles-and-workorders/route";
import type { IndusBOMData } from "@/app/api/bom/[styleCode]/route";

export const CUSTOM_STYLE: StyleMasterItem = {
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

export function ensureStyleBOMDefaults(style: StyleMasterItem): StyleMasterItem {
  return {
    ...style,
    bomAccessories: StyleMasterService.mergeAccessories(style.bomAccessories),
    bomChemicals: StyleMasterService.mergeChemicals(style.bomChemicals),
    bomSpecialCharges: StyleMasterService.mergeSpecialCharges(style.bomSpecialCharges),
  };
}

export function useCostSheetFacade() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const styleIdParam = searchParams.get("styleId");
  const costSheetIdParam = searchParams.get("costSheetId");

  const [stylesList, setStylesList] = useState<StyleMasterItem[]>([]);
  const [indusDbList, setIndusDbList] = useState<StyleWorkOrderRow[]>([]);
  const [activeStyle, setActiveStyle] = useState<StyleMasterItem>(CUSTOM_STYLE);
  const [loadedCostSheet, setLoadedCostSheet] = useState<SavedCostSheetItem | null>(null);

  const [fabricCatalog, setFabricCatalog] = useState<CatalogItem[]>([]);
  const [liningCatalog, setLiningCatalog] = useState<CatalogItem[]>([]);

  // Catalog item addition tracking
  const [newFabricRows, setNewFabricRows] = useState<Set<number>>(new Set());
  const [newLiningRows, setNewLiningRows] = useState<Set<number>>(new Set());

  // Parameter grids from database
  const [directLabourFoh, setDirectLabourFoh] = useState<SimpleTableData>();
  const [cutToShipGrid, setCutToShipGrid] = useState<MatrixTableData>();
  const [rejectionGrid, setRejectionGrid] = useState<ProcessMatrixTableData>();
  const [stylesGrid, setStylesGrid] = useState<SimpleTableData>();

  // Dropdown lists
  const [paymentTermsList, setPaymentTermsList] = useState<string[]>([]);
  const [deliveryTermsList, setDeliveryTermsList] = useState<string[]>([]);
  const [countriesList, setCountriesList] = useState<string[]>([]);
  const [categoriesList, setCategoriesList] = useState<string[]>([]);
  const [washTypesList, setWashTypesList] = useState<string[]>([]);
  const [orderTypesList, setOrderTypesList] = useState<string[]>(["Denim", "Non Denim"]);

  // Costing & Order Inputs
  const [costingDate, setCostingDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [costingStage, setCostingStage] = useState<string>("Costing");
  const [country, setCountry] = useState<string>("USA");
  const [paymentTerms, setPaymentTerms] = useState<string>("CAD (Cash Against Document)");
  const [shipmentMode, setShipmentMode] = useState<string>("Sea");
  const [deliveryTerms, setDeliveryTerms] = useState<string>("FOB");
  const [paritySale, setParitySale] = useState<number>(278.0);
  const [parityProcurement, setParityProcurement] = useState<number>(278.0);

  // Operational Inputs
  const [manpower, setManpower] = useState<number>(65);
  const [efficiencyOverride, setEfficiencyOverride] = useState<string>("");
  const [rejectionOverride, setRejectionOverride] = useState<string>("");
  const [lineTargetOverride, setLineTargetOverride] = useState<string>("");

  // Financial Parameters
  const [discountRate, setDiscountRate] = useState<number>(0.13);
  const [paymentTermsDays, setPaymentTermsDays] = useState<number>(60);
  const [factoringDays, setFactoringDays] = useState<number>(0);
  const [commissionPct, setCommissionPct] = useState<number>(0);
  const [foreignBankCharges, setForeignBankCharges] = useState<number>(0);
  const [quotedPrice, setQuotedPrice] = useState<number>(0);
  const [intlFreight, setIntlFreight] = useState<number>(0);
  const [intlInsurance, setIntlInsurance] = useState<number>(0);
  const [taxEdsPct, setTaxEdsPct] = useState<number>(0.0225);
  const [rebatePct, setRebatePct] = useState<number>(0);
  const [inlandFreightPct, setInlandFreightPct] = useState<number>(0.007);
  const [localBankChargesPct, setLocalBankChargesPct] = useState<number>(0.006);

  // New Fields
  const [noOfColors, setNoOfColors] = useState<number>(1);
  const [merchGroup, setMerchGroup] = useState<string>("");
  const [workOrderNumber, setWorkOrderNumber] = useState<string>("");
  const [deliveryDestination, setDeliveryDestination] = useState<string>("");
  const [exFactoryDate, setExFactoryDate] = useState<string>("");
  const [inhouseOrSubcontract, setInhouseOrSubcontract] = useState<string>("In-House");

  // Save Modal State
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [referenceName, setReferenceName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Print View Modal State
  const [printModalOpen, setPrintModalOpen] = useState(false);

  // Loading States
  const [loadingStyles, setLoadingStyles] = useState(true);
  const [loadingBOM, setLoadingBOM] = useState(false);

  // Fetch Indus styles and workorders list
  useEffect(() => {
    fetch("/api/styles-and-workorders")
      .then((res) => res.json())
      .then((data: { rows?: StyleWorkOrderRow[]; error?: string }) => {
        if (data.rows && data.rows.length > 0) {
          setIndusDbList(data.rows);
        }
      })
      .catch((err) => console.error("Failed to load styles-and-workorders:", err));
  }, []);

  // Fetch Style Master & Parameter Subscriptions
  useEffect(() => {
    const unsubStyles = StyleMasterService.subscribe((data) => {
      setStylesList(data);
      setLoadingStyles(false);

      if (styleIdParam && !costSheetIdParam) {
        const found = data.find((s) => s.id === styleIdParam);
        if (found) {
          setActiveStyle(ensureStyleBOMDefaults(found));
          setNewFabricRows(new Set());
          setNewLiningRows(new Set());
        }
      }
    });

    return () => unsubStyles();
  }, [styleIdParam, costSheetIdParam]);

  useEffect(() => {
    const unsubFabric = ItemCatalogService.subscribe(FABRIC_COLLECTION, setFabricCatalog);
    const unsubLining = ItemCatalogService.subscribe(LINING_COLLECTION, setLiningCatalog);

    const unsubDLF = ParametersService.subscribeToTable<SimpleTableData>("direct-labour-foh", setDirectLabourFoh);
    const unsubCTS = ParametersService.subscribeToTable<MatrixTableData>("cut-to-ship-grid", setCutToShipGrid);
    const unsubRej = ParametersService.subscribeToTable<ProcessMatrixTableData>("rejection-grid", setRejectionGrid);
    const unsubStylesGrid = ParametersService.subscribeToTable<SimpleTableData>("styles", setStylesGrid);

    const unsubDropdowns = ParametersService.subscribeToTable<DropdownListsData>("dropdown-lists", (data) => {
      if (data?.lists) {
        const pTerms = data.lists.find((l) => l.key === "paymentTerms")?.items;
        const dTerms = data.lists.find((l) => l.key === "deliveryTerms")?.items;
        const countrs = data.lists.find((l) => l.key === "country")?.items;
        const cats = data.lists.find((l) => l.key === "category")?.items;
        const washes = data.lists.find((l) => l.key === "washType")?.items;
        const oTypes = data.lists.find((l) => l.key === "orderType" || l.key === "Order Type")?.items;

        if (pTerms) setPaymentTermsList(pTerms);
        if (dTerms) setDeliveryTermsList(dTerms);
        if (countrs) setCountriesList(countrs);
        if (cats) setCategoriesList(cats);
        if (washes) setWashTypesList(washes);
        if (oTypes && oTypes.length > 0) setOrderTypesList(oTypes);
      }
    });

    const unsubCostOfSales = ParametersService.subscribeToTable<SimpleTableData>("cost-as-percent-of-sales", (data) => {
      if (data?.rows?.length && !costSheetIdParam) {
        const getVal = (desc: string) => {
          const row = data.rows.find(
            (r) => r.values.description?.toLowerCase().trim() === desc.toLowerCase().trim()
          );
          return row?.values.percentOfSales ? parseFloat(row.values.percentOfSales) : null;
        };

        const eds = getVal("EDS");
        const taxes = getVal("Taxes");
        const rebate = getVal("Rebate");
        const exchangeRate = getVal("Exchange Rate");
        const inlandFreight = getVal("Inland Freight");
        const localBankCharges = getVal("Local Bank Charges");
        const discountRateVal = getVal("Discount Rate");

        if (eds !== null || taxes !== null) {
          const totalTaxEds = (taxes || 0) + (eds || 0);
          if (totalTaxEds > 0) setTaxEdsPct(totalTaxEds / 100);
        }
        if (exchangeRate !== null && exchangeRate > 0) {
          setParitySale(exchangeRate);
          setParityProcurement(exchangeRate);
        }
        if (rebate !== null && rebate > 0) setRebatePct(rebate);
        if (inlandFreight !== null && inlandFreight > 0) setInlandFreightPct(inlandFreight / 100);
        if (localBankCharges !== null && localBankCharges > 0) setLocalBankChargesPct(localBankCharges / 100);
        if (discountRateVal !== null && discountRateVal > 0) setDiscountRate(discountRateVal / 100);
      }
    });

    return () => {
      unsubFabric();
      unsubLining();
      unsubDLF();
      unsubCTS();
      unsubRej();
      unsubStylesGrid();
      unsubDropdowns();
      unsubCostOfSales();
    };
  }, [costSheetIdParam]);

  // Load saved snapshot if costSheetId exists
  useEffect(() => {
    if (costSheetIdParam) {
      setLoadingStyles(true);
      CostSheetService.getById(costSheetIdParam).then((sheet) => {
        if (sheet) {
          setLoadedCostSheet(sheet);

          const styleFromSheet: StyleMasterItem = {
            id: sheet.styleId,
            styleName: sheet.styleName,
            customerName: sheet.customerName,
            styleCategory: sheet.styleCategory,
            orderQuantity: sheet.orderQuantity,
            smvSewing: sheet.smvSewing,
            orderType: (sheet.orderType as "Denim" | "Non Denim") || "Denim",
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
            sheet.efficiencyOverride !== null ? (sheet.efficiencyOverride * 100).toString() : ""
          );
          setRejectionOverride(
            sheet.rejectionOverride !== null ? (sheet.rejectionOverride * 100).toString() : ""
          );
          setLineTargetOverride(
            sheet.lineTargetOverride !== null ? sheet.lineTargetOverride.toString() : ""
          );

          setDiscountRate(sheet.discountRate);
          setPaymentTermsDays(sheet.paymentTermsDays);
          setFactoringDays(sheet.factoringDays);
          setCommissionPct(sheet.commissionPct * 100);
          setForeignBankCharges(sheet.foreignBankCharges);

          setQuotedPrice(sheet.quotedPrice !== undefined ? sheet.quotedPrice : sheet.orderFOB);
          setIntlFreight(sheet.intlFreight !== undefined ? sheet.intlFreight : 0);
          setIntlInsurance(sheet.intlInsurance !== undefined ? sheet.intlInsurance : 0);
          setNoOfColors(sheet.noOfColors !== undefined ? sheet.noOfColors : 1);
          setMerchGroup(sheet.merchGroup || "");
          setWorkOrderNumber(sheet.workOrderNumber || "");
          setDeliveryDestination(sheet.deliveryDestination || "");
          setExFactoryDate(sheet.exFactoryDate || "");
          setInhouseOrSubcontract(sheet.inhouseOrSubcontract || "In-House");
          if (sheet.rebatePct !== undefined) setRebatePct(sheet.rebatePct);

          setReferenceName(sheet.referenceName || "");
        }
        setLoadingStyles(false);
      });
    }
  }, [costSheetIdParam]);

  // Execute Formula Engine
  const results: CalculationResult = useMemo(() => {
    const effOverrideVal = efficiencyOverride ? parseFloat(efficiencyOverride) / 100 : null;
    const rejOverrideVal = rejectionOverride ? parseFloat(rejectionOverride) / 100 : null;
    const targetOverrideVal = lineTargetOverride ? parseFloat(lineTargetOverride) : null;

    return runFormulaEngine(
      activeStyle,
      {
        orderFOB: activeStyle.baseSellingPrice || 0,
        paritySale,
        parityProcurement,
        manpower,
        efficiencyOverride: effOverrideVal,
        rejectionOverride: rejOverrideVal,
        lineTargetOverride: targetOverrideVal,
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
        stylesCategoryGrid: stylesGrid,
      }
    );
  }, [
    activeStyle,
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
    taxEdsPct,
    inlandFreightPct,
    localBankChargesPct,
    inhouseOrSubcontract,
    rebatePct,
    directLabourFoh,
    cutToShipGrid,
    rejectionGrid,
    stylesGrid,
  ]);

  // Handle Style Selection
  const handleSelectStyle = useCallback(
    (styleId: string) => {
      if (styleId === "custom") {
        setActiveStyle({ ...CUSTOM_STYLE });
        setNewFabricRows(new Set());
        setNewLiningRows(new Set());
        return;
      }

      // Check if it exists in Firebase Style Master
      const found = stylesList.find((s) => s.id === styleId);
      if (found) {
        setActiveStyle(ensureStyleBOMDefaults(found));
        setNewFabricRows(new Set());
        setNewLiningRows(new Set());
        return;
      }

      // If from Indus DB, fetch BOM dynamically
      const indusItem = indusDbList.find((r) => r.styleCode === styleId);
      if (indusItem) {
        setLoadingBOM(true);
        fetch(`/api/bom/${encodeURIComponent(styleId)}`)
          .then((res) => res.json())
          .then((data: IndusBOMData) => {
            const bomFabric: BOMFabricItem[] = (data.fabric || []).map((f) => {
              const rateUSD = parityProcurement > 0 ? f.ratePKR / parityProcurement : 0;
              return {
                itemName: f.itemName,
                consumptionPerPc: f.consumption || 0,
                rateUSD,
                ratePKR: f.ratePKR || 0,
                fabricCostPKR: (f.consumption || 0) * (f.ratePKR || 0),
              };
            });

            const bomLining: BOMLiningItem[] = (data.lining || []).map((l) => {
              const rateUSD = parityProcurement > 0 ? l.ratePKR / parityProcurement : 0;
              return {
                itemName: l.itemName,
                consumptionPerPc: l.consumption || 0,
                rateUSD,
                ratePKR: l.ratePKR || 0,
                liningCostPKR: (l.consumption || 0) * (l.ratePKR || 0),
              };
            });

            const bomAccessories: BOMAccessoriesItem[] = (data.accessories || []).map((a) => ({
              category: a.category,
              itemName: a.itemName,
              consPerPc: a.consumption || 0,
              ratePKR: a.ratePKR || 0,
              rateUSD: parityProcurement > 0 ? (a.ratePKR || 0) / parityProcurement : 0,
              totalCostPKR: (a.consumption || 0) * (a.ratePKR || 0),
            }));

            const loadedStyle: StyleMasterItem = {
              id: indusItem.styleCode,
              styleName: indusItem.styleName,
              customerName: indusItem.customer || "Duer",
              styleCategory: data.category || "Top Ware",
              orderType: "Denim",
              washType: data.wash || "Rinse",
              orderQuantity: indusItem.poQty || 1000,
              sizeBracket: calculateSizeBracket(indusItem.poQty || 1000),
              smvSewing: data.smvSewing || 15,
              baseSellingPrice: 0,
              bomFabric,
              bomLining,
              bomAccessories,
              bomChemicals: [],
              bomSpecialCharges: [],
            };

            setActiveStyle(ensureStyleBOMDefaults(loadedStyle));
            setNewFabricRows(new Set());
            setNewLiningRows(new Set());
            toast.success(`Loaded style and BOM from Indus DB`);
          })
          .catch((err) => {
            console.error("Failed to fetch BOM:", err);
            toast.error("Failed to load BOM from Indus DB");
          })
          .finally(() => setLoadingBOM(false));
      }
    },
    [stylesList, indusDbList, parityProcurement]
  );

  // Active Style Mutations
  const updateActiveStyle = useCallback((patch: Partial<StyleMasterItem>) => {
    setActiveStyle((prev) => ({ ...prev, ...patch }));
  }, []);

  // Save Cost Sheet
  const handleSaveCostSheet = useCallback(async () => {
    if (!referenceName.trim()) {
      toast.error("Please enter a reference name for this costing scenario");
      return;
    }

    setIsSaving(true);
    try {
      let sheetId = loadedCostSheet ? loadedCostSheet.id : "";
      if (!sheetId) {
        sheetId = await CostSheetService.getNextCostSheetId(activeStyle.id);
      }

      const effOverrideVal = efficiencyOverride ? parseFloat(efficiencyOverride) / 100 : null;
      const rejOverrideVal = rejectionOverride ? parseFloat(rejectionOverride) / 100 : null;
      const lineTargetOverrideVal = lineTargetOverride ? parseFloat(lineTargetOverride) : null;

      const costSheetItem: SavedCostSheetItem = {
        id: sheetId,
        referenceName: referenceName.trim(),
        styleId: activeStyle.id,
        styleName: activeStyle.styleName,
        customerName: activeStyle.customerName,
        styleCategory: activeStyle.styleCategory,
        orderQuantity: activeStyle.orderQuantity,
        smvSewing: activeStyle.smvSewing,
        orderType: activeStyle.orderType,
        washType: activeStyle.washType,

        costingDate,
        costingStage,
        country,
        paymentTerms,
        shipmentMode,
        deliveryTerms,
        paritySale,
        parityProcurement,

        manpower,
        efficiencyOverride: effOverrideVal,
        rejectionOverride: rejOverrideVal,
        lineTargetOverride: lineTargetOverrideVal,

        discountRate,
        paymentTermsDays,
        factoringDays,
        commissionPct: commissionPct / 100,
        foreignBankCharges,
        orderFOB: activeStyle.baseSellingPrice,
        quotedPrice,
        intlFreight,
        intlInsurance,
        noOfColors,
        merchGroup,
        workOrderNumber,
        deliveryDestination,
        exFactoryDate,
        inhouseOrSubcontract,
        rebatePct,

        bomFabric: activeStyle.bomFabric,
        bomLining: activeStyle.bomLining,
        bomAccessories: activeStyle.bomAccessories,
        bomChemicals: activeStyle.bomChemicals,
        bomSpecialCharges: activeStyle.bomSpecialCharges,

        calculations: {
          targetFobUSD: results.targetFobUSD,
          orderFobUSD: activeStyle.baseSellingPrice,
          cmUSD: results.cmUSD,
          cmMinuteUSD: results.cmMinuteUSD,
          ebitdaUSD: results.ebitdaUSD,
          ebitdaMinCents: results.ebitdaMinCents,
          netProfitUSD: results.netProfitUSD,
          netProfitPct: results.netProfitPct,
          sizeBracket: results.sizeBracket,
          styleCategoryClass: results.styleCategory,
          efficiency: results.efficiency,
          rejectionPct: results.rejectionPct,
          lineTarget: results.lineTarget,
        },
        savedAt: new Date().toISOString(),
      };

      await CostSheetService.save(costSheetItem);
      setLoadedCostSheet(costSheetItem);
      setSaveModalOpen(false);
      toast.success(`Cost sheet saved (${sheetId})`);
    } catch (err) {
      console.error("Save cost sheet error:", err);
      toast.error("Failed to save cost sheet");
    } finally {
      setIsSaving(false);
    }
  }, [
    referenceName,
    loadedCostSheet,
    activeStyle,
    costingDate,
    costingStage,
    country,
    paymentTerms,
    shipmentMode,
    deliveryTerms,
    paritySale,
    parityProcurement,
    manpower,
    efficiencyOverride,
    rejectionOverride,
    lineTargetOverride,
    discountRate,
    paymentTermsDays,
    factoringDays,
    commissionPct,
    foreignBankCharges,
    quotedPrice,
    intlFreight,
    intlInsurance,
    noOfColors,
    merchGroup,
    workOrderNumber,
    deliveryDestination,
    exFactoryDate,
    inhouseOrSubcontract,
    rebatePct,
    results,
  ]);

  return {
    stylesList,
    indusDbList,
    activeStyle,
    loadedCostSheet,
    fabricCatalog,
    liningCatalog,
    newFabricRows,
    setNewFabricRows,
    newLiningRows,
    setNewLiningRows,
    results,
    // Dropdown lists
    paymentTermsList,
    deliveryTermsList,
    countriesList,
    categoriesList,
    washTypesList,
    orderTypesList,
    // Inputs & Setters
    costingDate,
    setCostingDate,
    costingStage,
    setCostingStage,
    country,
    setCountry,
    paymentTerms,
    setPaymentTerms,
    shipmentMode,
    setShipmentMode,
    deliveryTerms,
    setDeliveryTerms,
    paritySale,
    setParitySale,
    parityProcurement,
    setParityProcurement,
    manpower,
    setManpower,
    efficiencyOverride,
    setEfficiencyOverride,
    rejectionOverride,
    setRejectionOverride,
    lineTargetOverride,
    setLineTargetOverride,
    discountRate,
    setDiscountRate,
    paymentTermsDays,
    setPaymentTermsDays,
    factoringDays,
    setFactoringDays,
    commissionPct,
    setCommissionPct,
    foreignBankCharges,
    setForeignBankCharges,
    quotedPrice,
    setQuotedPrice,
    intlFreight,
    setIntlFreight,
    intlInsurance,
    setIntlInsurance,
    taxEdsPct,
    setTaxEdsPct,
    rebatePct,
    setRebatePct,
    inlandFreightPct,
    setInlandFreightPct,
    localBankChargesPct,
    setLocalBankChargesPct,
    noOfColors,
    setNoOfColors,
    merchGroup,
    setMerchGroup,
    workOrderNumber,
    setWorkOrderNumber,
    deliveryDestination,
    setDeliveryDestination,
    exFactoryDate,
    setExFactoryDate,
    inhouseOrSubcontract,
    setInhouseOrSubcontract,
    // Modals
    saveModalOpen,
    setSaveModalOpen,
    referenceName,
    setReferenceName,
    isSaving,
    printModalOpen,
    setPrintModalOpen,
    loadingStyles,
    loadingBOM,
    // Handlers
    handleSelectStyle,
    updateActiveStyle,
    handleSaveCostSheet,
  };
}
