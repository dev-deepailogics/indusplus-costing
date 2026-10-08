import type {
  BOMFabricItem,
  BOMLiningItem,
  BOMAccessoriesItem,
  BOMChemicalsItem,
  BOMSpecialChargesItem,
} from "@/features/style-master/types";
import type { SimpleTableData } from "@/features/parameters/types";

export interface CostSheetCalculations {
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
  isSmvOutOfRange?: boolean;
  smvRangeError?: string;
  isQtyOutOfRange?: boolean;
  qtyRangeError?: string;

  // Breakdown fields
  directLaborCostPKR?: number;
  directLaborCostUSD?: number;
  utilitiesCostPKR?: number;
  utilitiesCostUSD?: number;
  leftoverCostPKR?: number;
  leftoverCostUSD?: number;
  totalVariableCostPKR?: number;
  totalVariableCostUSD?: number;
  salariesCostPKR?: number;
  salariesCostUSD?: number;
  fohAdminCostPKR?: number;
  fohAdminCostUSD?: number;
  repairMtcCostPKR?: number;
  repairMtcCostUSD?: number;
  totalCostPKR?: number;
  totalCostUSD?: number;
  depreciationCostPKR?: number;
  depreciationCostUSD?: number;
  conversionCostPerMinPKR?: number;
  conversionCostPerMinUSD?: number;
  grossCmPKR?: number;
  grossCmUSD?: number;
}

export type ApprovalStage =
  | "cad"
  | "fabric"
  | "mmc"
  | "ie"
  | "washing"
  | "marketing"
  | "costingHead"
  | "director";

export interface ApprovalStep {
  status: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedByEmail?: string;
  approvedById?: number;
  approvedAt?: string;
  comments?: string;
}

export interface CostSheetApprovals {
  cad?: ApprovalStep;
  fabric?: ApprovalStep;
  mmc?: ApprovalStep;
  ie?: ApprovalStep;
  washing?: ApprovalStep;
  marketing?: ApprovalStep;
  costingHead?: ApprovalStep;
  director?: ApprovalStep;
  overallStatus?:
    | "draft"
    | "in_review"
    | "marketing_approved"
    | "costing_approved"
    | "fully_approved"
    | "rejected";
}

export interface SavedCostSheetItem {
  id: string; // Unique snapshot ID (e.g. PCS-STY-001-XXXX)
  referenceName: string; // e.g. "Scenario A - Base Quote"
  styleId: string; // Style reference
  styleName: string;
  customerName: string;
  styleCategory: string;
  orderQuantity: number;
  smvSewing: number;
  cuttingSAM?: number;
  washingSAM?: number;
  finishingSAM?: number;
  orderType: string;
  washType: string;
  directLabourFohSnapshot?: SimpleTableData | null;

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
  rejectionPct?: number | null;
  lineTargetOverride: number | null;

  // Financial Parameters
  discountRate: number;
  paymentTermsDays: number;
  arTermId?: string | null;  // Selected AR payment term ID
  apTermId?: string | null;  // Selected AP payment term ID
  factoringDays: number;
  commissionPct: number;
  foreignBankCharges: number;
  taxEdsPct?: number;
  inlandFreightPct?: number;
  localBankChargesPct?: number;
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

  // Saved calculation results
  calculations: CostSheetCalculations;

  // Approvals & Workflow
  approvals?: CostSheetApprovals;
  approvalStatus?: string;

  // Author / Creator
  createdById?: number;
  createdByEmail?: string;
  createdByName?: string;

  savedAt: string; // ISO Date string
}

/**
 * Returns true if the cost sheet has been approved by any head (Fabric, MMC, IE, Washing, Marketing, Costing Head, or Director).
 * When approved, the cost sheet snapshot and parameter values (Cost as % of Sales, Direct Labour and FOH) are frozen.
 */
export function isCostSheetApprovedByAnyHead(
  sheet?: SavedCostSheetItem | null,
  approvals?: CostSheetApprovals | null
): boolean {
  if (!sheet && !approvals) return false;
  const app = approvals || sheet?.approvals;

  if (app) {
    const stageApproved = Boolean(
      app.cad?.status === "approved" ||
      app.fabric?.status === "approved" ||
      app.mmc?.status === "approved" ||
      app.ie?.status === "approved" ||
      app.washing?.status === "approved" ||
      app.marketing?.status === "approved" ||
      app.costingHead?.status === "approved" ||
      app.director?.status === "approved"
    );
    if (stageApproved) return true;
  }

  const status = sheet?.approvalStatus || app?.overallStatus;
  if (status && status !== "draft" && status !== "rejected") {
    return true;
  }

  return false;
}
