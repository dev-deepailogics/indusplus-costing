import type { StyleMasterItem } from "../style-master/types";
import type { SimpleTableData, MatrixTableData, ProcessMatrixTableData } from "../parameters/types";

// Standard Excel rates as default fallbacks
const FALLBACK_CPMS = {
  directLabour: 8.934030,
  salaries: 12.508913,
  utilities: 3.949478, // 3.5565 Utilities & Power + 0.3929 Utility Expenses
  repair: 1.146272,    // 0.1931 R&M + 0.0214 R&M + 0.9324 General Overheads
  fohAdmin: 6.868587,
  depreciation: 1.171741 // 1.0545 Dep + 0.1171 Dep
};

function findRate(tableData: SimpleTableData | undefined, description: string, fallback: number): number {
  if (!tableData?.rows) return fallback;
  const row = tableData.rows.find(
    (r) => r.values.description?.toLowerCase().replace(/\s+/g, "") === description.toLowerCase().replace(/\s+/g, "")
  );
  if (!row) return fallback;
  return parseFloat(row.values.costPerSam) || fallback;
}

export function mapSMVToCategory(smv: number): "Basic" | "Semi Fashion" | "Fashion" | "High Fashion" {
  if (smv <= 18) return "Basic";
  if (smv <= 23) return "Semi Fashion";
  if (smv <= 36) return "Fashion";
  return "High Fashion";
}

export function calculateSizeBracket(qty: number): string {
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
    ">25000": { low: 0.65, high: 0.75 }
  };
  
  const bracketRates = rates[sizeBracket] || { low: 1.0, high: 1.0 };
  return (isLower ? bracketRates.low : bracketRates.high) / 100;
}

export interface CalculationResult {
  // Input parameters (used or calculated)
  sizeBracket: string;
  styleCategory: string;
  efficiency: number;
  rejectionPct: number;
  lineTarget: number;
  
  // Left Panel Outputs: PKR / USD per Piece
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
  
  // Variable Costs
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
  
  // CM and Overheads
  cmPKR: number;
  cmUSD: number;
  cmPct: number;
  
  cmMinutePKR: number;
  cmMinuteUSD: number; // in USD cents
  
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
  conversionCostPerMinUSD: number; // in USD cents
  
  ebitdaPKR: number;
  ebitdaUSD: number;
  ebitdaPct: number;
  
  depreciationCostPKR: number;
  depreciationCostUSD: number;
  depreciationCostPct: number;
  
  netProfitPKR: number;
  netProfitUSD: number;
  netProfitPct: number;
  
  // KPI Header Card Calculations
  targetFobUSD: number;
  ebitdaMinCents: number;
  ebitdaPcUSD: number;
  netProfitMinCents: number;
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
    inhouseOrSubcontract?: string;
    rebatePct?: number;
  },
  params: {
    directLabourFoh?: SimpleTableData;
    cutToShipGrid?: MatrixTableData;
    rejectionGrid?: ProcessMatrixTableData;
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
    inhouseOrSubcontract,
    rebatePct: inputRebatePct,
  } = inputs;

  const smv = style.smvSewing;
  const qty = style.orderQuantity;
  const sizeBracket = calculateSizeBracket(qty);
  const styleCategory = mapSMVToCategory(smv);

  // 1. Calculate Average Efficiency
  let efficiency = 0.47;
  if (efficiencyOverride !== null) {
    efficiency = efficiencyOverride;
  } else if (params.cutToShipGrid?.cells) {
    const cellVal = params.cutToShipGrid.cells[sizeBracket]?.[styleCategory] || "47";
    efficiency = parseFloat(cellVal.replace("%", "")) / 100;
  }

  // 2. Calculate Line Target
  const lineTarget = lineTargetOverride !== null
    ? lineTargetOverride
    : (manpower * 480 / smv) * efficiency;

  // 3. Calculate Rejection Percentage
  let rejectionPct = 0.0415;
  if (rejectionOverride !== null) {
    rejectionPct = rejectionOverride;
  } else {
    // If rejectionGrid exists, sum rejections for the active sizeBracket and styleCategory
    if (params.rejectionGrid?.tables) {
      let sumRej = 0;
      // Rejection processes
      const processes = ["Fabric", "Cutting", "Sewing", "Finishing", "WIP", "E1"];
      processes.forEach((procName) => {
        const table = params.rejectionGrid?.tables[procName];
        if (table?.cells) {
          // Fabric, Cutting, and Finishing are looked up using "High Fashion" category in the Excel logic,
          // whereas Sewing, WIP, and E1 use the dynamically calculated style category class.
          const lookupCategory = (procName === "Fabric" || procName === "Cutting" || procName === "Finishing")
            ? "High Fashion"
            : styleCategory;
          const rateStr = table.cells[sizeBracket]?.[lookupCategory] || "0";
          sumRej += parseFloat(rateStr.replace("%", "")) / 100;
        }
      });
      // Add Washing Rejection
      sumRej += getWashingRejection(style.washType, sizeBracket);
      rejectionPct = sumRej;
    } else {
      rejectionPct = style.rejectionPct ?? 0.0415; // Fallback to Style master value
    }
  }

  // CPM parameters lookup
  const cpmDirectLabour = findRate(params.directLabourFoh, "Direct Labour", FALLBACK_CPMS.directLabour);
  const cpmSalaries = findRate(params.directLabourFoh, "Fixed Salaries", FALLBACK_CPMS.salaries);
  const cpmUtilities = findRate(params.directLabourFoh, "Utilities Cost", FALLBACK_CPMS.utilities);
  const cpmRepair = findRate(params.directLabourFoh, "Repair and Maintenance", FALLBACK_CPMS.repair);
  const cpmFohAdmin = findRate(params.directLabourFoh, "Manufacturing FOH", FALLBACK_CPMS.fohAdmin);
  const cpmDepreciation = findRate(params.directLabourFoh, "Depreciation", FALLBACK_CPMS.depreciation);

  // Exchange conversions
  const sellingPriceUSD = orderFOB;
  const sellingPricePKR = orderFOB * paritySale;

  // Deductions calculations (PKR & USD per Pc)
  const taxEDS_PKR = sellingPricePKR * 0.025; // 2.5% Tax & EDS
  const taxEDS_USD = taxEDS_PKR / paritySale;
  const taxEDS_Pct = taxEDS_USD / sellingPriceUSD;

  const rebatePct = inputRebatePct ?? 0;
  const rebatePKR = sellingPricePKR * rebatePct;
  const rebateUSD = rebatePKR / paritySale;

  const commissionPKR = sellingPricePKR * commissionPct;
  const commissionUSD = commissionPKR / paritySale;
  const commissionPctCalc = commissionUSD / sellingPriceUSD;

  // Inland Freight & Clearing
  const freightRate = style.customerName === "Duer" ? 0.0125 : 0.0065;
  const freightPKR = sellingPricePKR * freightRate;
  const freightUSD = freightPKR / paritySale;
  const freightPct = freightUSD / sellingPriceUSD;

  // Markup and Discounting (PKR) = (Selling Price * (Discount Rate / 365) * Days)
  const markupDiscountPKR = (sellingPricePKR / 365) * discountRate * paymentTermsDays;
  const markupDiscountUSD = markupDiscountPKR / paritySale;
  const markupDiscountPct = markupDiscountUSD / sellingPriceUSD;

  const bankChargesPKR = sellingPricePKR * 0.0085; // Local Bank Charges 0.85%
  const bankChargesUSD = bankChargesPKR / paritySale;
  const bankChargesPct = bankChargesUSD / sellingPriceUSD;

  // Factoring
  const factoringPKR = (sellingPricePKR / 365) * discountRate * factoringDays;
  const factoringUSD = factoringPKR / paritySale;
  const factoringPct = factoringUSD / sellingPriceUSD;

  const foreignBankChargesPKR = foreignBankCharges * paritySale;
  const foreignBankChargesUSD = foreignBankCharges;
  const foreignBankChargesPct = foreignBankChargesUSD / sellingPriceUSD;

  // Net Selling Price
  const netPricePKR = sellingPricePKR - taxEDS_PKR + rebatePKR - (commissionPKR + freightPKR + markupDiscountPKR + bankChargesPKR + factoringPKR + foreignBankChargesPKR);
  const netPriceUSD = netPricePKR / paritySale;
  const netPricePct = netPriceUSD / sellingPriceUSD;

  // BOM Materials Costs (aggregated from style's BOM lists)
  // Fabric BOM
  const fabricCostPKR = (style.bomFabric || []).reduce(
    (acc, f) => acc + (f ? (f.consumptionPerPc || 0) * (f.rateUSD || 0) * parityProcurement : 0),
    0
  );
  const fabricCostUSD = fabricCostPKR / paritySale;
  const fabricCostPct = fabricCostUSD / netPriceUSD;

  // Pocket Lining BOM
  const liningCostPKR = (style.bomLining || []).reduce(
    (acc, l) => acc + (l ? (l.consumptionPerPc || 0) * (l.rateUSD || 0) * parityProcurement : 0),
    0
  );
  const liningCostUSD = liningCostPKR / paritySale;
  const liningCostPct = liningCostUSD / netPriceUSD;

  // Accessories BOM
  const accessoriesCostPKR = (style.bomAccessories || []).reduce(
    (acc, a) => acc + (a ? (a.consPerPc || 0) * (a.ratePKR || 0) : 0),
    0
  );
  const accessoriesCostUSD = accessoriesCostPKR / paritySale;
  const accessoriesCostPct = accessoriesCostUSD / netPriceUSD;

  // Chemicals BOM
  const chemicalsCostPKR = (style.bomChemicals || []).reduce(
    (acc, c) => acc + (c ? (c.consPerPc || 0) * (c.ratePKR || 0) : 0),
    0
  );
  const chemicalsCostUSD = chemicalsCostPKR / paritySale;
  const chemicalsCostPct = chemicalsCostUSD / netPriceUSD;

  // Special Charges (Other Cost)
  const specialChargesCostPKR = (style.bomSpecialCharges || []).reduce(
    (acc, s) => acc + (s ? (s.consPerPc || 0) * (s.ratePKR || 0) : 0),
    0
  );
  const specialChargesCostUSD = specialChargesCostPKR / paritySale;
  const specialChargesCostPct = specialChargesCostUSD / netPriceUSD;

  // Direct Labor Cost / Pc = (CPM * SMV) / Efficiency
  const directLaborCostPKR = (cpmDirectLabour * smv) / efficiency;
  const directLaborCostUSD = directLaborCostPKR / paritySale;
  const directLaborCostPct = directLaborCostUSD / netPriceUSD;

  // Utilities Cost / Pc = (CPM * SMV) / Efficiency
  const utilitiesCostPKR = (cpmUtilities * smv) / efficiency;
  const utilitiesCostUSD = utilitiesCostPKR / paritySale;
  const utilitiesCostPct = utilitiesCostUSD / netPriceUSD;

  // Leftover Allowance Cost (PKR) = Rejection_Pct * Total material cost
  const totalMaterialCostPKR = fabricCostPKR + liningCostPKR + accessoriesCostPKR + chemicalsCostPKR + specialChargesCostPKR;
  // Note: Excel formula adds Direct Labor and Utilities to Leftover base in D39: =D15*SUM(D32:D38)
  const leftoverBasePKR = totalMaterialCostPKR + directLaborCostPKR + utilitiesCostPKR;
  const leftoverCostPKR = rejectionPct * leftoverBasePKR;
  const leftoverCostUSD = leftoverCostPKR / paritySale;
  const leftoverCostPct = leftoverCostUSD / netPriceUSD;

  // Total Variable Cost
  const totalVariableCostPKR = fabricCostPKR + liningCostPKR + accessoriesCostPKR + chemicalsCostPKR + specialChargesCostPKR + directLaborCostPKR + utilitiesCostPKR + leftoverCostPKR;
  const totalVariableCostUSD = totalVariableCostPKR / paritySale;
  const totalVariableCostPct = totalVariableCostUSD / netPriceUSD;

  // CM / Pc
  const cmPKR = netPricePKR - totalVariableCostPKR;
  const cmUSD = cmPKR / paritySale;
  const cmPct = cmUSD / netPriceUSD;

  // CM / Minute (USD cents) = (CM_USD * Efficiency / SMV) * 100
  const cmMinutePKR = (cmPKR * efficiency) / smv;
  const cmMinuteUSD = (cmUSD * efficiency / smv) * 100;

  // Salaries Cost = (CPM * SMV) / Efficiency
  const salariesCostPKR = (cpmSalaries * smv) / efficiency;
  const salariesCostUSD = salariesCostPKR / paritySale;
  const salariesCostPct = salariesCostUSD / netPriceUSD;

  // FOH / Admin Cost = (CPM * SMV) / Efficiency
  const fohAdminCostPKR = (cpmFohAdmin * smv) / efficiency;
  const fohAdminCostUSD = fohAdminCostPKR / paritySale;
  const fohAdminCostPct = fohAdminCostUSD / netPriceUSD;

  // Repair and Mtc Cost = (CPM * SMV) / Efficiency
  const repairMtcCostPKR = (cpmRepair * smv) / efficiency;
  const repairMtcCostUSD = repairMtcCostPKR / paritySale;
  const repairMtcCostPct = repairMtcCostUSD / netPriceUSD;

  // Total Cost (PKR & USD per Pc) = Salaries + FOH + Repair
  const totalCostPKR = salariesCostPKR + fohAdminCostPKR + repairMtcCostPKR;
  const totalCostUSD = totalCostPKR / paritySale;
  const totalCostPct = totalCostUSD / netPriceUSD;

  // Conversion Cost per Minute (USD cents)
  const conversionCostPerMinPKR = (totalCostPKR * efficiency) / smv;
  const conversionCostPerMinUSD = (totalCostUSD * efficiency / smv) * 100;

  // EBITDA = CM/Pc - Overheads
  const ebitdaPKR = cmPKR - totalCostPKR;
  const ebitdaUSD = ebitdaPKR / paritySale;
  const ebitdaPct = ebitdaUSD / netPriceUSD;

  // Depreciation = (CPM * SMV) / Efficiency
  const depreciationCostPKR = (cpmDepreciation * smv) / efficiency;
  const depreciationCostUSD = depreciationCostPKR / paritySale;
  const depreciationCostPct = depreciationCostUSD / netPriceUSD;

  // Net Profit
  const netProfitPKR = ebitdaPKR - depreciationCostPKR;
  const netProfitUSD = netProfitPKR / paritySale;
  const netProfitPct = netProfitUSD / netPriceUSD;

  // KPI Header cards calculations
  // Target FOB = ((Total Cost - Net Profit) + (Total Cost - Net Profit - Selling Price) * Sum(Deduction Pcts)) / 0.9
  // Wait, let's look at Excel J5: =((E20-E56)+(E20-E56-J6)*(O12+O13+O14+S5))/90%*100%
  // Let's implement that exact formula:
  const deductionSum = 0.025 + freightRate + 0.0085 + (commissionPct) + (discountRate * paymentTermsDays / 365) + (discountRate * factoringDays / 365);
  const targetFobUSD = ((sellingPriceUSD - netProfitUSD) + (sellingPriceUSD - netProfitUSD - sellingPriceUSD) * deductionSum) / 0.9;

  // EBITDA / Min (Cents) = (EBITDA_USD * Efficiency / SMV) / (1 + Rejection_Pct) * 100
  const ebitdaMinCents = (ebitdaUSD * efficiency / smv) / (1 + rejectionPct) * 100;
  const ebitdaPcUSD = ebitdaUSD;

  // Net Profit / Min (Cents) = (NetProfit_USD * Efficiency / SMV) * 100
  const netProfitMinCents = (netProfitUSD * efficiency / smv) * 100;

  return {
    sizeBracket,
    styleCategory,
    efficiency,
    rejectionPct,
    lineTarget,
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
  };
}
