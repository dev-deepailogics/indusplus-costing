import type {
  BOMFabricItem,
  BOMLiningItem,
  BOMAccessoriesItem,
  BOMChemicalsItem,
  BOMSpecialChargesItem,
} from "@/lib/style-master/types";

export interface SavedCostSheetItem {
  id: string; // Unique snapshot ID (e.g. PCS-STY-001-XXXX)
  referenceName: string; // e.g. "Scenario A - Base Quote"
  styleId: string; // Style reference
  styleName: string;
  customerName: string;
  styleCategory: string;
  orderQuantity: number;
  smvSewing: number;
  orderType: string;
  washType: string;
  
  // Costing & Order Inputs
  costingDate: string;
  costingStage: string;
  country: string;
  paymentTerms: string;
  shipmentMode: string;
  deliveryTerms: string;
  paritySale: number;
  parityProcurement: number;

  // Operational Inputs
  manpower: number;
  efficiencyOverride: number | null;
  rejectionOverride: number | null;
  lineTargetOverride: number | null;

  // Financial Parameters
  discountRate: number;
  paymentTermsDays: number;
  factoringDays: number;
  commissionPct: number;
  foreignBankCharges: number;
  orderFOB: number;
  quotedPrice?: number;
  intlFreight?: number;
  intlInsurance?: number;
  noOfColors?: number;
  merchGroup?: string;
  workOrderNumber?: string;
  deliveryDestination?: string;
  exFactoryDate?: string;
  inhouseOrSubcontract?: string;
  rebatePct?: number;

  // BOM Tables snapshot
  bomFabric: BOMFabricItem[];
  bomLining: BOMLiningItem[];
  bomAccessories: BOMAccessoriesItem[];
  bomChemicals: BOMChemicalsItem[];
  bomSpecialCharges: BOMSpecialChargesItem[];

  // Saved calculation results (so we do not need to re-run formula-engine in list grid)
  calculations: {
    targetFobUSD: number;
    orderFobUSD: number;
    cmUSD: number;
    cmMinuteUSD: number;
    ebitdaUSD: number;
    ebitdaMinCents: number;
    netProfitUSD: number;
    netProfitPct: number;
    sizeBracket: string;
    styleCategoryClass: string;
    efficiency: number;
    rejectionPct: number;
    lineTarget: number;
  };
  
  savedAt: string; // ISO Date string
}
