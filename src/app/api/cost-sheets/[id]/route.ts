import { NextRequest } from "next/server";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { checkSessionPermission } from "@/lib/rbac/server";
import type { SavedCostSheetItem } from "@/lib/cost-sheet/types";
import { canUserAccessCostSheet, rowToCostSheetItem } from "@/lib/cost-sheet/auth";
import { ensureCostSheetTable, resolveTeamCustomers } from "@/lib/cost-sheet/db";

// ---------------------------------------------------------------------------
// GET /api/cost-sheets/[id]  — fetch single cost sheet
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm = await checkSessionPermission(session, "cost_sheets", "view");
    if (!hasPerm) {
      return Response.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;
    const pool = await getPool();
    await ensureCostSheetTable(pool);

    const result = await pool
      .request()
      .input("id", id)
      .query("SELECT * FROM pre_order_cost_sheets WHERE id = @id");

    if (result.recordset.length === 0) {
      return Response.json({ error: "Cost sheet not found" }, { status: 404 });
    }

    const item = rowToCostSheetItem(result.recordset[0]);

    // Resolve team customer portfolio for access check
    const teamCustomers = await resolveTeamCustomers(pool, session);
    const sessionWithTeams = { ...session, teamCustomers };

    if (!canUserAccessCostSheet(sessionWithTeams, item)) {
      return Response.json(
        { error: "Forbidden: You do not have permission to view this cost sheet." },
        { status: 403 }
      );
    }

    return Response.json(item);
  } catch (err) {
    console.error("[GET /api/cost-sheets/[id]]", err);
    return Response.json(
      { error: "Failed to fetch cost sheet", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/cost-sheets/[id]  — update an existing cost sheet
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm = await checkSessionPermission(session, "cost_sheets", "edit");
    if (!hasPerm) {
      return Response.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;
    const item: SavedCostSheetItem = await request.json();

    // Guard: body ID must match the URL param if present
    if (item.id && item.id !== id) {
      return Response.json(
        { error: "Bad request: body ID does not match URL parameter." },
        { status: 400 }
      );
    }

    const pool = await getPool();
    await ensureCostSheetTable(pool);

    // Fetch only the columns needed for access and lock checks
    const existingCheck = await pool
      .request()
      .input("checkId", id)
      .query<{
        id: string;
        customer_name: string;
        created_by_id: number | null;
        created_by_email: string | null;
        approval_status: string | null;
        approvals: string | null;
      }>(`
        SELECT id, customer_name, created_by_id, created_by_email, approval_status, approvals
        FROM pre_order_cost_sheets
        WHERE id = @checkId
      `);

    if (existingCheck.recordset.length === 0) {
      return Response.json({ error: "Cost sheet not found" }, { status: 404 });
    }

    const existingRow = existingCheck.recordset[0];
    const teamCustomers = await resolveTeamCustomers(pool, session);
    const sessionWithTeams = { ...session, teamCustomers };

    // Ownership / access check
    if (!canUserAccessCostSheet(sessionWithTeams, rowToCostSheetItem(existingRow))) {
      return Response.json(
        { error: "Forbidden: You do not have permission to modify this cost sheet." },
        { status: 403 }
      );
    }

    // Lock check — use the single parsed value, no redundant raw check
    if (existingRow.approval_status === "fully_approved") {
      return Response.json(
        { error: "This cost sheet has been finalized & approved by the Director and is locked against edits." },
        { status: 403 }
      );
    }

    const effectiveRejection =
      item.rejectionPct ??
      item.rejectionOverride ??
      (item.calculations?.rejectionPct ?? null);

    await pool
      .request()
      .input("id", id)
      .input("reference_name", item.referenceName)
      .input("style_id", item.styleId)
      .input("style_name", item.styleName)
      .input("customer_name", item.customerName)
      .input("style_category", item.styleCategory)
      .input("order_quantity", item.orderQuantity)
      .input("smv_sewing", item.smvSewing)
      .input("cutting_sam", item.cuttingSAM ?? null)
      .input("washing_sam", item.washingSAM ?? null)
      .input("finishing_sam", item.finishingSAM ?? null)
      .input("approvals", item.approvals ? JSON.stringify(item.approvals) : null)
      .input("approval_status", item.approvalStatus || item.approvals?.overallStatus || null)
      .input("order_type", item.orderType)
      .input("wash_type", item.washType)
      .input("costing_date", item.costingDate)
      .input("costing_stage", item.costingStage)
      .input("country", item.country)
      .input("payment_terms", item.paymentTerms)
      .input("shipment_mode", item.shipmentMode)
      .input("delivery_terms", item.deliveryTerms)
      .input("parity_sale", item.paritySale)
      .input("parity_procurement", item.parityProcurement)
      .input("manpower", item.manpower)
      .input("efficiency_override", item.efficiencyOverride ?? null)
      .input("rejection_override", item.rejectionOverride ?? effectiveRejection)
      .input("rejection_pct", effectiveRejection)
      .input("line_target_override", item.lineTargetOverride ?? null)
      .input("discount_rate", item.discountRate)
      .input("payment_terms_days", item.paymentTermsDays)
      .input("ar_term_id", item.arTermId ?? null)
      .input("ap_term_id", item.apTermId ?? null)
      .input("factoring_days", item.factoringDays)
      .input("commission_pct", item.commissionPct)
      .input("foreign_bank_charges", item.foreignBankCharges)
      .input("tax_eds_pct", item.taxEdsPct ?? null)
      .input("inland_freight_pct", item.inlandFreightPct ?? null)
      .input("local_bank_charges_pct", item.localBankChargesPct ?? null)
      .input("order_fob", item.orderFOB)
      .input("quoted_price", item.quotedPrice ?? null)
      .input("intl_freight", item.intlFreight ?? null)
      .input("intl_insurance", item.intlInsurance ?? null)
      .input("no_of_colors", item.noOfColors ?? null)
      .input("merch_group", item.merchGroup ?? null)
      .input("work_order_number", item.workOrderNumber ?? null)
      .input("delivery_destination", item.deliveryDestination ?? null)
      .input("ex_factory_date", item.exFactoryDate ?? null)
      .input("inhouse_or_subcontract", item.inhouseOrSubcontract ?? null)
      .input("rebate_pct", item.rebatePct ?? null)
      .input("bom_fabric", JSON.stringify(item.bomFabric || []))
      .input("bom_lining", JSON.stringify(item.bomLining || []))
      .input("bom_accessories", JSON.stringify(item.bomAccessories || []))
      .input("bom_chemicals", JSON.stringify(item.bomChemicals || []))
      .input("bom_special_charges", JSON.stringify(item.bomSpecialCharges || []))
      .input("direct_labour_foh_snapshot", item.directLabourFohSnapshot ? JSON.stringify(item.directLabourFohSnapshot) : null)
      .input("calculations", JSON.stringify(item.calculations || {}))
      .input("saved_at", item.savedAt)
      .query(`
        UPDATE pre_order_cost_sheets SET
          reference_name         = @reference_name,
          style_id               = @style_id,
          style_name             = @style_name,
          customer_name          = @customer_name,
          style_category         = @style_category,
          order_quantity         = @order_quantity,
          smv_sewing             = @smv_sewing,
          cutting_sam            = @cutting_sam,
          washing_sam            = @washing_sam,
          finishing_sam          = @finishing_sam,
          approvals              = COALESCE(@approvals, approvals),
          approval_status        = COALESCE(@approval_status, approval_status),
          order_type             = @order_type,
          wash_type              = @wash_type,
          costing_date           = @costing_date,
          costing_stage          = @costing_stage,
          country                = @country,
          payment_terms          = @payment_terms,
          shipment_mode          = @shipment_mode,
          delivery_terms         = @delivery_terms,
          parity_sale            = @parity_sale,
          parity_procurement     = @parity_procurement,
          manpower               = @manpower,
          efficiency_override    = @efficiency_override,
          rejection_override     = @rejection_override,
          rejection_pct          = @rejection_pct,
          line_target_override   = @line_target_override,
          discount_rate          = @discount_rate,
          payment_terms_days     = @payment_terms_days,
          ar_term_id             = @ar_term_id,
          ap_term_id             = @ap_term_id,
          factoring_days         = @factoring_days,
          commission_pct         = @commission_pct,
          foreign_bank_charges   = @foreign_bank_charges,
          tax_eds_pct            = @tax_eds_pct,
          inland_freight_pct     = @inland_freight_pct,
          local_bank_charges_pct = @local_bank_charges_pct,
          order_fob              = @order_fob,
          quoted_price           = @quoted_price,
          intl_freight           = @intl_freight,
          intl_insurance         = @intl_insurance,
          no_of_colors           = @no_of_colors,
          merch_group            = @merch_group,
          work_order_number      = @work_order_number,
          delivery_destination   = @delivery_destination,
          ex_factory_date        = @ex_factory_date,
          inhouse_or_subcontract = @inhouse_or_subcontract,
          rebate_pct             = @rebate_pct,
          bom_fabric             = @bom_fabric,
          bom_lining             = @bom_lining,
          bom_accessories        = @bom_accessories,
          bom_chemicals          = @bom_chemicals,
          bom_special_charges    = @bom_special_charges,
          direct_labour_foh_snapshot = @direct_labour_foh_snapshot,
          calculations           = @calculations,
          saved_at               = @saved_at
        WHERE id = @id
      `);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/cost-sheets/[id]]", err);
    return Response.json(
      { error: "Failed to update cost sheet", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/cost-sheets/[id]  — remove cost sheet
// ---------------------------------------------------------------------------
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm = await checkSessionPermission(session, "cost_sheets", "delete");
    if (!hasPerm) {
      return Response.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const { id } = await params;
    const pool = await getPool();
    await ensureCostSheetTable(pool);

    // Fetch only the columns needed for access check — avoid loading large BOM JSON
    const existingCheck = await pool
      .request()
      .input("checkId", id)
      .query<{
        id: string;
        customer_name: string;
        created_by_id: number | null;
        created_by_email: string | null;
        approval_status: string | null;
        approvals: string | null;
      }>(`
        SELECT id, customer_name, created_by_id, created_by_email, approval_status, approvals
        FROM pre_order_cost_sheets
        WHERE id = @checkId
      `);

    if (existingCheck.recordset.length === 0) {
      return Response.json({ error: "Cost sheet not found" }, { status: 404 });
    }

    const row = existingCheck.recordset[0];
    let appObj: any = null;
    try {
      if (row.approvals) appObj = JSON.parse(row.approvals);
    } catch {}

    const isApprovedByAny = Boolean(
      appObj?.fabric?.status === "approved" ||
      appObj?.mmc?.status === "approved" ||
      appObj?.ie?.status === "approved" ||
      appObj?.washing?.status === "approved" ||
      appObj?.marketing?.status === "approved" ||
      appObj?.costingHead?.status === "approved" ||
      appObj?.director?.status === "approved" ||
      (row.approval_status && row.approval_status !== "draft" && row.approval_status !== "rejected")
    );

    if (isApprovedByAny) {
      return Response.json(
        { error: "Cannot delete: Cost sheet has already been signed off by department heads." },
        { status: 400 }
      );
    }

    const teamCustomers = await resolveTeamCustomers(pool, session);
    const sessionWithTeams = { ...session, teamCustomers };

    if (!canUserAccessCostSheet(sessionWithTeams, rowToCostSheetItem(row))) {
      return Response.json(
        { error: "Forbidden: You do not have permission to delete this cost sheet." },
        { status: 403 }
      );
    }

    await pool
      .request()
      .input("id", id)
      .query("DELETE FROM pre_order_cost_sheets WHERE id = @id");

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/cost-sheets/[id]]", err);
    return Response.json(
      { error: "Failed to delete cost sheet", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
