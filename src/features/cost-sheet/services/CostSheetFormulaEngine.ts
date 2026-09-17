import type { StyleMasterItem } from "@/features/style-master/types";
import type { SimpleTableData, MatrixTableData, ProcessMatrixTableData } from "@/features/parameters/types";

function findRate(tableData: SimpleTableData | undefined, description: string): number {
  if (!tableData?.rows) return 0;
  const row = tableData.rows.find(
    (r) => r.values.description?.toLowerCase().replace(/\s+/g, "") === description.toLowerCase().replace(/\s+/g, "")
  );
  if (!row) return 0;
  return parseFloat(row.values.costPerSam) || 0;
}

function findLaborOrFohCost(
  tableData: SimpleTableData | undefined,
  description: string,
  smv: number,
  efficiency: number
): number {
  if (!tableData?.rows) return 0;
  const row = tableData.rows.find(
    (r) =>
      r.values.description?.toLowerCase().replace(/\s+/g, "") ===
      description.toLowerCase().replace(/\s+/g, "")
  );
  if (!row) return 0;

  const useType = (
    row.values.useType ??
    row.values.use_type ??
    ""
  ).toLowerCase().trim();

  const perPieceStr = (
    row.values.perPiece ??
    row.values.per_piece ??
    row.values["PER PIECE"] ??
    ""
  ).toString().trim();
  const perPieceVal = parseFloat(perPieceStr);

  const costPerSamStr = (
    row.values.costPerSam ??
    row.values.cost_per_sam ??
    ""
  ).toString().trim();
  const cpm = parseFloat(costPerSamStr) || 0;

  // 1. If explicit radio button selection is PER PIECE
  if (useType === "piece" || useType === "perpiece") {
    return !isNaN(perPieceVal) ? perPieceVal : 0;
  }

  // 2. If explicit radio button selection is SAM
  if (useType === "sam") {
    return efficiency > 0 ? (cpm * smv) / efficiency : 0;
  }

  // 3. If no radio button selection is stored
  if (!isNaN(perPieceVal) && perPieceStr !== "" && perPieceVal > 0) {
    return perPieceVal;
  }
  return efficiency > 0 ? (cpm * smv) / efficiency : 0;
}

export function mapSMVToCategory(smv: number, stylesGrid?: SimpleTableData): string {
  if (smv <= 0 || isNaN(smv)) {
    return "";
  }
  const rows = stylesGrid?.cards?.find((c) => c.isActive)?.rows ?? stylesGrid?.rows;
  if (rows && rows.length > 0) {
    for (const row of rows) {
      const cat = row.values.styleName;
      if (!cat) continue;

      const fromStr = (row.values.samPcFrom || "").trim();
      const toStr = (row.values.samPcTo || "").trim();

      let matchesFrom = true;
      if (fromStr) {
        if (fromStr.startsWith(">=")) {
          const val = parseFloat(fromStr.replace(">=", ""));
          matchesFrom = smv >= val;
        } else if (fromStr.startsWith(">")) {
          const val = parseFloat(fromStr.replace(">", ""));
          matchesFrom = smv > val;
        } else {
          const val = parseFloat(fromStr);
          if (!isNaN(val)) {
            matchesFrom = smv >= val;
          }
        }
      }

      let matchesTo = true;
      if (toStr) {
        if (toStr.startsWith("<=")) {
          const val = parseFloat(toStr.replace("<=", ""));
          matchesTo = smv <= val;
        } else if (toStr.startsWith("<")) {
          const val = parseFloat(toStr.replace("<", ""));
          matchesTo = smv < val;
        } else {
          const val = parseFloat(toStr);
          if (!isNaN(val)) {
            matchesTo = smv <= val;
          }
        }
      }

      if (matchesFrom && matchesTo) {
        return cat;
      }
    }
  }

  return "";
}

export function matchQtyToBracket(qty: number, label: string): boolean {
  if (qty <= 0 || isNaN(qty)) return false;
  const clean = label.trim().toLowerCase();

  if (clean === "capacity qty" || clean === "capacity") {
    return qty >= 125000;
  }

  // Handle <= X or < X
  if (clean.startsWith("<=")) {
    const max = parseFloat(clean.replace("<=", "").replace(/,/g, "").trim());
    return !isNaN(max) && qty <= max;
  }
  if (clean.startsWith("<")) {
    const max = parseFloat(clean.replace("<", "").replace(/,/g, "").trim());
    return !isNaN(max) && qty < max;
  }

  // Handle >= X or > X
  if (clean.startsWith(">=")) {
    const min = parseFloat(clean.replace(">=", "").replace(/,/g, "").trim());
    return !isNaN(min) && qty >= min;
  }
  if (clean.startsWith(">")) {
    const min = parseFloat(clean.replace(">", "").replace(/,/g, "").trim());
    return !isNaN(min) && qty > min;
  }

  // Handle Range "501-1000" or "501 - 1000" or "501 to 1000"
  if (clean.includes("-") || clean.includes("to")) {
    const parts = clean.includes("-") ? clean.split("-") : clean.split("to");
    if (parts.length === 2) {
      const min = parseFloat(parts[0].replace(/,/g, "").trim());
      const max = parseFloat(parts[1].replace(/,/g, "").trim());
      if (!isNaN(min) && !isNaN(max)) {
        return qty >= min && qty <= max;
      }
      if (!isNaN(min) && isNaN(max)) {
        return qty >= min;
      }
      if (isNaN(min) && !isNaN(max)) {
        return qty <= max;
      }
    }
  }

  // Handle exact single number if any
  const single = parseFloat(clean.replace(/,/g, "").trim());
  if (!isNaN(single)) {
    return qty === single;
  }

  return false;
}

export function calculateSizeBracket(qty: number, availableBrackets?: string[]): string {
  if (availableBrackets && availableBrackets.length > 0) {
    for (const bracket of availableBrackets) {
      if (matchQtyToBracket(qty, bracket)) {
        return bracket;
      }
    }
    return "";
  }

  if (qty >= 125000) return "Capacity Qty";
  if (qty <= 500) return "<=500";
  if (qty <= 1000) return "501-1000";
  if (qty <= 2000) return "1001-2000";
  if (qty <= 3000) return "2001-3000";
  if (qty <= 4000) return "3001-4000";
  if (qty <= 5000) return "4001-5000";
  if (qty <= 10000) return "5001-10000";
  if (qty <= 25000) return "10001-25000";
  return ">25000";
}

export function getWashingRejection(washType: string, sizeBracket: string): number {
  const lowerRateWashes = ["rinse", "softner", "softener", "rinse/softner", "rinse/softener", "silicon ball"];
  const isLower = lowerRateWashes.includes(washType.toLowerCase());

  const rates: Record<string, { low: number; high: number }> = {
    "<=500": { low: 1.0, high: 1.5 },
    "501-1000": { low: 1.0, high: 1.0 },
    "1001-2000": { low: 1.0, high: 1.0 },
    "2001-3000": { low: 0.7, high: 1.0 },
    "3001-4000": { low: 0.7, high: 1.0 },
    "4001-5000": { low: 0.7, high: 0.9 },
    "5001-10000": { low: 0.7, high: 0.9 },
    "10001-25000": { low: 0.65, high: 0.75 },
    ">25000": { low: 0.65, high: 0.75 },
  };

  const bracketRates = rates[sizeBracket] || { low: 1.0, high: 1.0 };
  return (isLower ? bracketRates.low : bracketRates.high) / 100;
}

export interface CalculationResult {
  sizeBracket: string;
  styleCategory: string;
  efficiency: number;
  rejectionPct: number;
  lineTarget: number;
  isSmvOutOfRange?: boolean;
  smvRangeError?: string;
  isQtyOutOfRange?: boolean;
  qtyRangeError?: string;

  sellingPricePKR: number;
  sellingPriceUSD: number;

  taxEDS_PKR: number;
  taxEDS_USD: number;
  taxEDS_Pct: number;

  rebatePKR: number;
  rebateUSD: number;
  rebatePct: number;

  commissionPKR: number;
  commissionUSD: number;
  commissionPct: number;

  freightPKR: number;
  freightUSD: number;
  freightPct: number;

  markupDiscountPKR: number;
  markupDiscountUSD: number;
  markupDiscountPct: number;

  bankChargesPKR: number;
  bankChargesUSD: number;
  bankChargesPct: number;

  factoringPKR: number;
  factoringUSD: number;
  factoringPct: number;

  foreignBankChargesPKR: number;
  foreignBankChargesUSD: number;
  foreignBankChargesPct: number;

  netPricePKR: number;
  netPriceUSD: number;
  netPricePct: number;

  fabricCostPKR: number;
  fabricCostUSD: number;
  fabricCostPct: number;

  liningCostPKR: number;
  liningCostUSD: number;
  liningCostPct: number;

  accessoriesCostPKR: number;
  accessoriesCostUSD: number;
  accessoriesCostPct: number;

  chemicalsCostPKR: number;
  chemicalsCostUSD: number;
  chemicalsCostPct: number;

  specialChargesCostPKR: number;
  specialChargesCostUSD: number;
  specialChargesCostPct: number;

  directLaborCostPKR: number;
  directLaborCostUSD: number;
  directLaborCostPct: number;

  utilitiesCostPKR: number;
  utilitiesCostUSD: number;
  utilitiesCostPct: number;

  leftoverCostPKR: number;
  leftoverCostUSD: number;
  leftoverCostPct: number;

  totalVariableCostPKR: number;
  totalVariableCostUSD: number;
  totalVariableCostPct: number;

  cmPKR: number;
  cmUSD: number;
  cmPct: number;

  cmMinutePKR: number;
  cmMinuteUSD: number;

  salariesCostPKR: number;
  salariesCostUSD: number;
  salariesCostPct: number;

  fohAdminCostPKR: number;
  fohAdminCostUSD: number;
  fohAdminCostPct: number;

  repairMtcCostPKR: number;
  repairMtcCostUSD: number;
  repairMtcCostPct: number;

  totalCostPKR: number;
  totalCostUSD: number;
  totalCostPct: number;

  conversionCostPerMinPKR: number;
  conversionCostPerMinUSD: number;

  ebitdaPKR: number;
  ebitdaUSD: number;
  ebitdaPct: number;

  depreciationCostPKR: number;
  depreciationCostUSD: number;
  depreciationCostPct: number;

  netProfitPKR: number;
  netProfitUSD: number;
  netProfitPct: number;

  targetFobUSD: number;
  ebitdaMinCents: number;
  ebitdaPcUSD: number;
  netProfitMinCents: number;
  targetCmSmvCents: number;
  orderCmSmvCents: number;
}

export function runFormulaEngine(
  style: StyleMasterItem,
  inputs: {
    orderFOB: number;
    paritySale: number;
    parityProcurement: number;
    manpower: number;
    efficiencyOverride: number | null;
    rejectionOverride: number | null;
    lineTargetOverride: number | null;
    costingStage: string;
    paymentTerms: string;
    discountRate: number;
    paymentTermsDays: number;
    factoringDays: number;
    commissionPct: number;
    foreignBankCharges: number;
    taxEdsPct: number;
    inlandFreightPct: number;
    localBankChargesPct: number;
    inhouseOrSubcontract?: string;
    rebatePct?: number;
  },
  params: {
    directLabourFoh?: SimpleTableData;
    cutToShipGrid?: MatrixTableData;
    rejectionGrid?: ProcessMatrixTableData;
    stylesCategoryGrid?: SimpleTableData;
  }
): CalculationResult {
  const {
    orderFOB,
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
    taxEdsPct,
    inlandFreightPct,
    localBankChargesPct,
    rebatePct = 0.015,
  } = inputs;

  const smv = style.smvSewing;
  const qty = style.orderQuantity;
  const availableBrackets = params.cutToShipGrid?.rowLabels;
  const sizeBracket = calculateSizeBracket(qty, availableBrackets);
  const styleCategory = mapSMVToCategory(smv, params.stylesCategoryGrid);

  const isSmvOutOfRange = smv > 0 && !styleCategory;
  const smvRangeError = isSmvOutOfRange
    ? `SMV ${smv} does not match any configured Style Category (SAM Range).`
    : undefined;

  const isQtyOutOfRange = qty > 0 && !sizeBracket;
  const qtyRangeError = isQtyOutOfRange
    ? `Order Quantity (${qty}) does not match any configured Qty Band in Cut-to-Ship Grid.`
    : undefined;

  let efficiency = 0;
  if (efficiencyOverride !== null) {
    efficiency = efficiencyOverride;
  } else if (styleCategory && sizeBracket) {
    const dbVal = params.cutToShipGrid?.cells?.[sizeBracket]?.[styleCategory];
    if (dbVal !== undefined && dbVal !== null && dbVal.trim() !== "") {
      efficiency = parseFloat(dbVal.replace("%", "")) / 100;
    } else {
      efficiency = 0;
    }
  } else {
    efficiency = 0;
  }

  const lineTarget = lineTargetOverride !== null
    ? lineTargetOverride
    : (smv > 0 && efficiency > 0 ? (manpower * 480 / smv) * efficiency : 0);

  let rejectionPct = 0.0415;
  if (rejectionOverride !== null) {
    rejectionPct = rejectionOverride;
  } else {
    // Mode determination: true = Active (Process Grid sum), false = Inactive (Customer Rejection rate)
    const isGridActive = params.rejectionGrid?.useGridRejection !== false;

    if (isGridActive) {
      // ── ACTIVE: Grid Mode (Dynamic Processes Sum + Washing) ──
      if (params.rejectionGrid?.tables) {
        let sumRej = 0;
        const processes = ["Fabric", "Cutting", "Sewing", "Finishing", "WIP", "E1"];
        processes.forEach((procName) => {
          const table = params.rejectionGrid?.tables[procName];
          if (table?.cells) {
            const lookupCategory = (procName === "Fabric" || procName === "Cutting" || procName === "Finishing")
              ? "High Fashion"
              : styleCategory;
            const rateStr = table.cells[sizeBracket]?.[lookupCategory] || "0";
            sumRej += parseFloat(rateStr.replace("%", "")) / 100;
          }
        });
        sumRej += getWashingRejection(style.washType, sizeBracket);
        rejectionPct = sumRej;
      } else {
        rejectionPct = style.rejectionPct ?? 0.0415;
      }
    } else {
      // ── INACTIVE: Customer Mode (Customer Rejection or Default Rejection) ──
      const custName = (style.customerName || "").trim().toLowerCase();
      let customerRejectionVal: number | null = null;
      if (custName && params.rejectionGrid?.customerRejections) {
        const matchKey = Object.keys(params.rejectionGrid.customerRejections).find(
          (k) => k.trim().toLowerCase() === custName
        );
        if (matchKey && params.rejectionGrid.customerRejections[matchKey] !== undefined) {
          const rawStr = params.rejectionGrid.customerRejections[matchKey].replace("%", "").trim();
          const parsed = parseFloat(rawStr);
          if (!isNaN(parsed) && rawStr !== "") {
            customerRejectionVal = parsed / 100;
          }
        }
      }

      if (customerRejectionVal !== null) {
        rejectionPct = customerRejectionVal;
      } else if (params.rejectionGrid?.defaultRejection) {
        const rawDefault = params.rejectionGrid.defaultRejection.replace("%", "").trim();
        const parsedDef = parseFloat(rawDefault);
        rejectionPct = !isNaN(parsedDef) && rawDefault !== "" ? parsedDef / 100 : (style.rejectionPct ?? 0.0415);
      } else {
        rejectionPct = style.rejectionPct ?? 0.0415;
      }
    }
  }

  const sellingPriceUSD = orderFOB;
  const sellingPricePKR = orderFOB * paritySale;

  const taxEDS_PKR = sellingPricePKR * taxEdsPct;
  const taxEDS_USD = taxEDS_PKR / paritySale;
  const taxEDS_Pct = taxEDS_USD / sellingPriceUSD;

  const rebatePKR = sellingPricePKR * rebatePct;
  const rebateUSD = rebatePKR / paritySale;

  const commissionPKR = sellingPricePKR * commissionPct;
  const commissionUSD = commissionPKR / paritySale;
  const commissionPctCalc = commissionUSD / sellingPriceUSD;

  const freightPKR = sellingPricePKR * inlandFreightPct;
  const freightUSD = freightPKR / paritySale;
  const freightPct = freightUSD / sellingPriceUSD;

  const markupDiscountPKR = (sellingPricePKR / 365) * discountRate * paymentTermsDays;
  const markupDiscountUSD = markupDiscountPKR / paritySale;
  const markupDiscountPct = markupDiscountUSD / sellingPriceUSD;

  const bankChargesPKR = sellingPricePKR * localBankChargesPct;
  const bankChargesUSD = bankChargesPKR / paritySale;
  const bankChargesPct = bankChargesUSD / sellingPriceUSD;

  const factoringPKR = (sellingPricePKR / 365) * discountRate * factoringDays;
  const factoringUSD = factoringPKR / paritySale;
  const factoringPct = factoringUSD / sellingPriceUSD;

  const foreignBankChargesPKR = foreignBankCharges * paritySale;
  const foreignBankChargesUSD = foreignBankCharges;
  const foreignBankChargesPct = foreignBankChargesUSD / sellingPriceUSD;

  const netPricePKR = sellingPricePKR - taxEDS_PKR + rebatePKR - (commissionPKR + freightPKR + markupDiscountPKR + bankChargesPKR + factoringPKR + foreignBankChargesPKR);
  const netPriceUSD = netPricePKR / paritySale;
  const netPricePct = netPriceUSD / sellingPriceUSD;

  const fabricCostPKR = (style.bomFabric || []).reduce((acc, f) => {
    if (!f) return acc;
    const cons = f.consumptionPerPc || 0;
    const pkrRate = (f.rateUSD && f.rateUSD > 0)
      ? f.rateUSD * parityProcurement
      : (f.ratePKR || 0);
    const waste = 1 + (f.wastagePct || 0);
    return acc + (cons * pkrRate * waste);
  }, 0);
  const fabricCostUSD = fabricCostPKR / paritySale;
  const fabricCostPct = fabricCostUSD / netPriceUSD;

  const liningCostPKR = (style.bomLining || []).reduce((acc, l) => {
    if (!l) return acc;
    const cons = l.consumptionPerPc || 0;
    const pkrRate = (l.rateUSD && l.rateUSD > 0)
      ? l.rateUSD * parityProcurement
      : (l.ratePKR || 0);
    const waste = 1 + (l.wastagePct || 0);
    return acc + (cons * pkrRate * waste);
  }, 0);
  const liningCostUSD = liningCostPKR / paritySale;
  const liningCostPct = liningCostUSD / netPriceUSD;

  const accessoriesCostPKR = (style.bomAccessories || []).reduce(
    (acc, a) => {
      if (!a) return acc;
      const cost = a.totalCostPKR !== undefined && a.totalCostPKR > 0
        ? a.totalCostPKR
        : (a.ratePKR || 0) * (a.consPerPc && a.consPerPc > 0 ? a.consPerPc : 1);
      return acc + cost;
    },
    0
  );
  const accessoriesCostUSD = accessoriesCostPKR / paritySale;
  const accessoriesCostPct = accessoriesCostUSD / netPriceUSD;

  const chemicalsCostPKR = (style.bomChemicals || []).reduce(
    (acc, c) => {
      if (!c) return acc;
      const cost = c.totalCostPKR !== undefined && c.totalCostPKR > 0
        ? c.totalCostPKR
        : (c.ratePKR || 0) * (c.consPerPc && c.consPerPc > 0 ? c.consPerPc : 1);
      return acc + cost;
    },
    0
  );
  const chemicalsCostUSD = chemicalsCostPKR / paritySale;
  const chemicalsCostPct = chemicalsCostUSD / netPriceUSD;

  const specialChargesCostPKR = (style.bomSpecialCharges || []).reduce(
    (acc, s) => {
      if (!s) return acc;
      const cost = s.totalCostPKR !== undefined && s.totalCostPKR > 0
        ? s.totalCostPKR
        : (s.ratePKR || 0) * (s.consPerPc && s.consPerPc > 0 ? s.consPerPc : 1);
      return acc + cost;
    },
    0
  );
  const specialChargesCostUSD = specialChargesCostPKR / paritySale;
  const specialChargesCostPct = specialChargesCostUSD / netPriceUSD;

  const directLaborCostPKR = findLaborOrFohCost(params.directLabourFoh, "Direct Labour", smv, efficiency);
  const directLaborCostUSD = directLaborCostPKR / paritySale;
  const directLaborCostPct = directLaborCostUSD / netPriceUSD;

  const utilitiesCostPKR = findLaborOrFohCost(params.directLabourFoh, "Utilities Cost", smv, efficiency);
  const utilitiesCostUSD = utilitiesCostPKR / paritySale;
  const utilitiesCostPct = utilitiesCostUSD / netPriceUSD;

  const totalMaterialCostPKR = fabricCostPKR + liningCostPKR + accessoriesCostPKR + chemicalsCostPKR + specialChargesCostPKR;
  const leftoverBasePKR = totalMaterialCostPKR + directLaborCostPKR + utilitiesCostPKR;
  const leftoverCostPKR = rejectionPct * leftoverBasePKR;
  const leftoverCostUSD = leftoverCostPKR / paritySale;
  const leftoverCostPct = leftoverCostUSD / netPriceUSD;

  const totalVariableCostPKR = fabricCostPKR + liningCostPKR + accessoriesCostPKR + chemicalsCostPKR + specialChargesCostPKR + directLaborCostPKR + utilitiesCostPKR + leftoverCostPKR;
  const totalVariableCostUSD = totalVariableCostPKR / paritySale;
  const totalVariableCostPct = totalVariableCostUSD / netPriceUSD;

  const cmPKR = netPricePKR - totalVariableCostPKR;
  const cmUSD = cmPKR / paritySale;
  const cmPct = cmUSD / netPriceUSD;

  const cmMinutePKR = smv > 0 ? (cmPKR * efficiency) / smv : 0;
  const cmMinuteUSD = smv > 0 ? (cmUSD * efficiency / smv) * 100 : 0;

  const salariesCostPKR = findLaborOrFohCost(params.directLabourFoh, "Fixed Salaries", smv, efficiency);
  const salariesCostUSD = salariesCostPKR / paritySale;
  const salariesCostPct = salariesCostUSD / netPriceUSD;

  const fohAdminCostPKR = findLaborOrFohCost(params.directLabourFoh, "Manufacturing FOH", smv, efficiency);
  const fohAdminCostUSD = fohAdminCostPKR / paritySale;
  const fohAdminCostPct = fohAdminCostUSD / netPriceUSD;

  const repairMtcCostPKR = findLaborOrFohCost(params.directLabourFoh, "Repair and Maintenance", smv, efficiency);
  const repairMtcCostUSD = repairMtcCostPKR / paritySale;
  const repairMtcCostPct = repairMtcCostUSD / netPriceUSD;

  const totalCostPKR = salariesCostPKR + fohAdminCostPKR + repairMtcCostPKR;
  const totalCostUSD = totalCostPKR / paritySale;
  const totalCostPct = totalCostUSD / netPriceUSD;

  const conversionCostPerMinPKR = smv > 0 ? (totalCostPKR * efficiency) / smv : 0;
  const conversionCostPerMinUSD = smv > 0 ? (totalCostUSD * efficiency / smv) * 100 : 0;

  const ebitdaPKR = cmPKR - totalCostPKR;
  const ebitdaUSD = ebitdaPKR / paritySale;
  const ebitdaPct = ebitdaUSD / netPriceUSD;

  const depreciationCostPKR = findLaborOrFohCost(params.directLabourFoh, "Depreciation", smv, efficiency);
  const depreciationCostUSD = depreciationCostPKR / paritySale;
  const depreciationCostPct = depreciationCostUSD / netPriceUSD;

  const netProfitPKR = ebitdaPKR - depreciationCostPKR;
  const netProfitUSD = netProfitPKR / paritySale;
  const netProfitPct = netProfitUSD / netPriceUSD;

  // Exact Excel formula for J5 (Target FOB/PC):
  // ((E20 - E56) + (E20 - E56 - J6) * (O12 + O13 + O14 + S5)) / 90% * 100%
  // Where O12 = Tax & EDS, O13 = Inland Freight, O14 = Local Bank Charges, S5 = 0
  const deductionSum = taxEdsPct + inlandFreightPct + localBankChargesPct;

  const targetFobUSD = orderFOB > 0
    ? ((sellingPriceUSD - netProfitUSD) + (sellingPriceUSD - netProfitUSD - orderFOB) * deductionSum) / 0.90
    : 0;

  // Exact Excel formula for J8 (Target CM/SMV-Cents):
  // ((J5 - (J5 * SUM(O12:O14))) - E40) * (J13 / J11) * 100
  // Where J5 = targetFobUSD, SUM(O12:O14) = Tax (O12) + Freight (O13) + Local Bank (O14), E40 = totalVariableCostUSD, J13 = efficiency, J11 = smv
  const cmDeductionSum = taxEdsPct + inlandFreightPct + localBankChargesPct;
  const targetNetPriceUSD = targetFobUSD - (targetFobUSD * cmDeductionSum);
  const targetCmUSD = targetNetPriceUSD - totalVariableCostUSD;
  const targetCmSmvCents = smv > 0 ? (targetCmUSD * (efficiency / smv)) * 100 : 0;
  const targetNetProfitUSD = targetFobUSD * 0.10;
  const orderCmSmvCents = cmMinuteUSD;

  const ebitdaMinCents = smv > 0 && (1 + rejectionPct) !== 0 ? (ebitdaUSD * efficiency / smv) / (1 + rejectionPct) * 100 : 0;
  const ebitdaPcUSD = ebitdaUSD;
  const netProfitMinCents = smv > 0 ? (netProfitUSD * efficiency / smv) * 100 : 0;

  return {
    sizeBracket,
    styleCategory,
    efficiency,
    rejectionPct,
    lineTarget,
    isSmvOutOfRange,
    smvRangeError,
    isQtyOutOfRange,
    qtyRangeError,
    sellingPricePKR,
    sellingPriceUSD,
    taxEDS_PKR,
    taxEDS_USD,
    taxEDS_Pct,
    rebatePKR,
    rebateUSD,
    rebatePct,
    commissionPKR,
    commissionUSD,
    commissionPct: commissionPctCalc,
    freightPKR,
    freightUSD,
    freightPct,
    markupDiscountPKR,
    markupDiscountUSD,
    markupDiscountPct,
    bankChargesPKR,
    bankChargesUSD,
    bankChargesPct,
    factoringPKR,
    factoringUSD,
    factoringPct,
    foreignBankChargesPKR,
    foreignBankChargesUSD,
    foreignBankChargesPct,
    netPricePKR,
    netPriceUSD,
    netPricePct,
    fabricCostPKR,
    fabricCostUSD,
    fabricCostPct,
    liningCostPKR,
    liningCostUSD,
    liningCostPct,
    accessoriesCostPKR,
    accessoriesCostUSD,
    accessoriesCostPct,
    chemicalsCostPKR,
    chemicalsCostUSD,
    chemicalsCostPct,
    specialChargesCostPKR,
    specialChargesCostUSD,
    specialChargesCostPct,
    directLaborCostPKR,
    directLaborCostUSD,
    directLaborCostPct,
    utilitiesCostPKR,
    utilitiesCostUSD,
    utilitiesCostPct,
    leftoverCostPKR,
    leftoverCostUSD,
    leftoverCostPct,
    totalVariableCostPKR,
    totalVariableCostUSD,
    totalVariableCostPct,
    cmPKR,
    cmUSD,
    cmPct,
    cmMinutePKR,
    cmMinuteUSD,
    salariesCostPKR,
    salariesCostUSD,
    salariesCostPct,
    fohAdminCostPKR,
    fohAdminCostUSD,
    fohAdminCostPct,
    repairMtcCostPKR,
    repairMtcCostUSD,
    repairMtcCostPct,
    totalCostPKR,
    totalCostUSD,
    totalCostPct,
    conversionCostPerMinPKR,
    conversionCostPerMinUSD,
    ebitdaPKR,
    ebitdaUSD,
    ebitdaPct,
    depreciationCostPKR,
    depreciationCostUSD,
    depreciationCostPct,
    netProfitPKR,
    netProfitUSD,
    netProfitPct,
    targetFobUSD,
    ebitdaMinCents,
    ebitdaPcUSD,
    netProfitMinCents,
    targetCmSmvCents,
    orderCmSmvCents,
  };
}
