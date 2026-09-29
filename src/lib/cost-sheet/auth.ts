import type { SavedCostSheetItem } from "@/features/cost-sheet/types";

export interface SessionAuthInfo {
  role: string;
  userId: number;
  email: string;
  assignedCustomer?: string | null;
  teamCustomers?: string[] | null;
  permissions?: any;
}

/**
 * Checks if a user has access to a specific cost sheet.
 * Rules:
 * - Admin: Full access to all cost sheets.
 * - Non-Admin User:
 *   - Access allowed if user created the cost sheet (Author).
 *   - Access allowed if the cost sheet's customer is in the user's active Team Portfolio.
 *   - Otherwise: Access denied (Hidden).
 */
export function canUserAccessCostSheet(
  session: SessionAuthInfo,
  item: SavedCostSheetItem
): boolean {
  // Admin always has full access
  if (session.role === "admin") return true;

  const isAuthor =
    (item.createdById !== undefined && item.createdById === session.userId) ||
    Boolean(
      item.createdByEmail &&
        session.email &&
        item.createdByEmail.trim().toLowerCase() === session.email.trim().toLowerCase()
    );

  // Authors can always access their own cost sheets
  if (isAuthor) return true;

  const teamCustomers = Array.isArray(session.teamCustomers)
    ? session.teamCustomers.map((c) => c.trim().toLowerCase()).filter(Boolean)
    : [];

  const sheetCust = item.customerName?.trim().toLowerCase();

  // If user belongs to teams with matching customer, grant access
  if (teamCustomers.length > 0 && sheetCust && teamCustomers.includes(sheetCust)) {
    return true;
  }

  // Not author and not in a team for this customer -> deny access
  return false;
}

/**
 * Map a SQL Server database row to SavedCostSheetItem
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToCostSheetItem(row: Record<string, any>): SavedCostSheetItem {
  const calcs = JSON.parse(row.calculations || "{}");
  const effectiveRejection =
    row.rejection_pct !== null && row.rejection_pct !== undefined
      ? row.rejection_pct
      : row.rejection_override !== null && row.rejection_override !== undefined
      ? row.rejection_override
      : calcs.rejectionPct ?? null;

  let parsedApprovals = undefined;
  if (row.approvals) {
    try {
      parsedApprovals = JSON.parse(row.approvals);
    } catch {
      parsedApprovals = undefined;
    }
  }

  return {
    id: row.id,
    referenceName: row.reference_name,
    styleId: row.style_id,
    styleName: row.style_name,
    customerName: row.customer_name,
    styleCategory: row.style_category,
    orderQuantity: row.order_quantity,
    smvSewing: row.smv_sewing,
    cuttingSAM: row.cutting_sam !== null && row.cutting_sam !== undefined ? row.cutting_sam : undefined,
    washingSAM: row.washing_sam !== null && row.washing_sam !== undefined ? row.washing_sam : undefined,
    finishingSAM: row.finishing_sam !== null && row.finishing_sam !== undefined ? row.finishing_sam : undefined,
    orderType: row.order_type,
    washType: row.wash_type,
    directLabourFohSnapshot: row.direct_labour_foh_snapshot
      ? JSON.parse(row.direct_labour_foh_snapshot)
      : undefined,
    costingDate: row.costing_date,
    costingStage: row.costing_stage,
    country: row.country,
    paymentTerms: row.payment_terms,
    shipmentMode: row.shipment_mode,
    deliveryTerms: row.delivery_terms,
    paritySale: row.parity_sale,
    parityProcurement: row.parity_procurement,
    manpower: row.manpower,
    efficiencyOverride: row.efficiency_override ?? null,
    rejectionOverride: row.rejection_override ?? effectiveRejection,
    rejectionPct: effectiveRejection,
    lineTargetOverride: row.line_target_override ?? null,
    discountRate: row.discount_rate,
    paymentTermsDays: row.payment_terms_days,
    factoringDays: row.factoring_days,
    commissionPct: row.commission_pct,
    foreignBankCharges: row.foreign_bank_charges,
    taxEdsPct: row.tax_eds_pct ?? undefined,
    inlandFreightPct: row.inland_freight_pct ?? undefined,
    localBankChargesPct: row.local_bank_charges_pct ?? undefined,
    orderFOB: row.order_fob,
    quotedPrice: row.quoted_price ?? undefined,
    intlFreight: row.intl_freight ?? undefined,
    intlInsurance: row.intl_insurance ?? undefined,
    noOfColors: row.no_of_colors ?? undefined,
    merchGroup: row.merch_group ?? undefined,
    workOrderNumber: row.work_order_number ?? undefined,
    deliveryDestination: row.delivery_destination ?? undefined,
    exFactoryDate: row.ex_factory_date ?? undefined,
    inhouseOrSubcontract: row.inhouse_or_subcontract ?? undefined,
    rebatePct: row.rebate_pct ?? undefined,
    bomFabric: JSON.parse(row.bom_fabric || "[]"),
    bomLining: JSON.parse(row.bom_lining || "[]"),
    bomAccessories: JSON.parse(row.bom_accessories || "[]"),
    bomChemicals: JSON.parse(row.bom_chemicals || "[]"),
    bomSpecialCharges: JSON.parse(row.bom_special_charges || "[]"),
    calculations: calcs,
    approvals: parsedApprovals,
    approvalStatus: row.approval_status ?? (parsedApprovals?.overallStatus ?? "draft"),
    createdById: row.created_by_id !== null && row.created_by_id !== undefined ? row.created_by_id : undefined,
    createdByEmail: row.created_by_email || undefined,
    createdByName: row.created_by_name || undefined,
    savedAt: row.saved_at,
  };
}
