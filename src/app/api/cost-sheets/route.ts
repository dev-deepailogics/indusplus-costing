import { NextRequest } from "next/server";
import { getPool } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { checkSessionPermission } from "@/lib/rbac/server";
import type { SavedCostSheetItem } from "@/lib/cost-sheet/types";
import { canUserAccessCostSheet, rowToCostSheetItem } from "@/lib/cost-sheet/auth";
import { ensureCostSheetTable, resolveTeamCustomers } from "@/lib/cost-sheet/db";


// ---------------------------------------------------------------------------
// GET /api/cost-sheets  — list all, sorted by savedAt DESC
// GET /api/cost-sheets?styleId=X&nextId=1  — returns next sequential ID
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm = await checkSessionPermission(session, "cost_sheets", "view");
    if (!hasPerm) {
      return Response.json({ error: "Forbidden: Insufficient permissions" }, { status: 403 });
    }

    const pool = await getPool();
    await ensureCostSheetTable(pool);

    const { searchParams } = request.nextUrl;
    const styleId = searchParams.get("styleId");
    const nextId = searchParams.get("nextId");

    // Special case: generate next sequential cost sheet ID
    if (styleId && nextId === "1") {
      const prefix = `PCS-${styleId}-`;
      const result = await pool
        .request()
        .input("prefix", `${prefix}%`)
        .query(`
          SELECT id FROM pre_order_cost_sheets
          WHERE id LIKE @prefix
          ORDER BY id DESC
        `);

      let maxSeq = 0;
      for (const row of result.recordset) {
        const rest = (row.id as string).replace(prefix, "");
        const num = parseInt(rest, 10);
        if (!isNaN(num) && num > maxSeq) {
          maxSeq = num;
        }
      }
      const nextSeq = String(maxSeq + 1).padStart(4, "0");
      return Response.json({ nextId: `${prefix}${nextSeq}` });
    }

    let query = "SELECT * FROM pre_order_cost_sheets";
    if (styleId) {
      query += " WHERE style_id = @styleId";
    }
    query += " ORDER BY saved_at DESC";

    const req = pool.request();
    if (styleId) req.input("styleId", styleId);
    const result = await req.query(query);

    // Resolve team customer portfolio for access filtering
    const teamCustomers = await resolveTeamCustomers(pool, session);
    const sessionWithTeams = { ...session, teamCustomers };

    const items: SavedCostSheetItem[] = result.recordset
      .map(rowToCostSheetItem)
      .filter((item) => canUserAccessCostSheet(sessionWithTeams, item));

    return Response.json(items);
  } catch (err) {
    console.error("[GET /api/cost-sheets]", err);
    return Response.json(
      { error: "Failed to fetch cost sheets", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/cost-sheets  — insert a new cost sheet row
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const hasPerm = await checkSessionPermission(session, "cost_sheets", "create");
    if (!hasPerm) {
      return Response.json({ error: "Forbidden: Insufficient permissions to create cost sheets" }, { status: 403 });
    }

    const item: SavedCostSheetItem = await request.json();
    const pool = await getPool();
    await ensureCostSheetTable(pool);

    // Validate customer access if restricted
    const assignedCustomers = session.assignedCustomer
      ? session.assignedCustomer
          .split(",")
          .map((c) => c.trim().toLowerCase())
          .filter(Boolean)
      : [];

    const isCustom =
      item.styleId?.trim().toLowerCase() === "custom" ||
      item.id?.toLowerCase().startsWith("pcs-custom-") ||
      item.styleName?.trim().toLowerCase() === "custom";

    if (session.role !== "admin" && assignedCustomers.length > 0) {
      const sheetCust = item.customerName?.trim().toLowerCase();
      // For standard cost sheets, customer must belong to assigned customers
      if (!isCustom && (!sheetCust || !assignedCustomers.includes(sheetCust))) {
        return Response.json(
          { error: "Forbidden: You are not authorized to create cost sheets for this customer." },
          { status: 403 }
        );
      }
    }

    const effectiveRejection =
      item.rejectionPct ??
      item.rejectionOverride ??
      (item.calculations?.rejectionPct ?? null);

    const createdById = session.userId;
    const createdByEmail = session.email;
    const createdByName = session.displayName;

    await pool
      .request()
      .input("id", item.id)
      .input("reference_name", item.referenceName)
      .input("style_id", item.styleId)
      .input("style_name", item.styleName)
      .input("customer_name", item.customerName)
      .input("style_category", item.styleCategory)
      .input("order_quantity", item.orderQuantity)
      .input("smv_sewing", item.smvSewing)
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
      .input("cutting_sam", item.cuttingSAM ?? null)
      .input("washing_sam", item.washingSAM ?? null)
      .input("finishing_sam", item.finishingSAM ?? null)
      .input("approvals", JSON.stringify(item.approvals || { overallStatus: "draft" }))
      .input("approval_status", item.approvalStatus || item.approvals?.overallStatus || "draft")
      .input("bom_fabric", JSON.stringify(item.bomFabric || []))
      .input("bom_lining", JSON.stringify(item.bomLining || []))
      .input("bom_accessories", JSON.stringify(item.bomAccessories || []))
      .input("bom_chemicals", JSON.stringify(item.bomChemicals || []))
      .input("bom_special_charges", JSON.stringify(item.bomSpecialCharges || []))
      .input("direct_labour_foh_snapshot", item.directLabourFohSnapshot ? JSON.stringify(item.directLabourFohSnapshot) : null)
      .input("calculations", JSON.stringify(item.calculations || {}))
      .input("created_by_id", createdById)
      .input("created_by_email", createdByEmail)
      .input("created_by_name", createdByName)
      .input("saved_at", item.savedAt)
      .query(`
        INSERT INTO pre_order_cost_sheets (
          id, reference_name, style_id, style_name, customer_name,
          style_category, order_quantity, smv_sewing, cutting_sam, washing_sam, finishing_sam,
          order_type, wash_type,
          costing_date, costing_stage, country, payment_terms, shipment_mode,
          delivery_terms, parity_sale, parity_procurement, manpower,
          efficiency_override, rejection_override, rejection_pct, line_target_override,
          discount_rate, payment_terms_days, factoring_days, commission_pct,
          foreign_bank_charges, tax_eds_pct, inland_freight_pct, local_bank_charges_pct,
          order_fob, quoted_price, intl_freight,
          intl_insurance, no_of_colors, merch_group, work_order_number,
          delivery_destination, ex_factory_date, inhouse_or_subcontract,
          rebate_pct, approvals, approval_status, bom_fabric, bom_lining, bom_accessories, bom_chemicals,
          bom_special_charges, direct_labour_foh_snapshot, calculations,
          created_by_id, created_by_email, created_by_name, saved_at
        ) VALUES (
          @id, @reference_name, @style_id, @style_name, @customer_name,
          @style_category, @order_quantity, @smv_sewing, @cutting_sam, @washing_sam, @finishing_sam,
          @order_type, @wash_type,
          @costing_date, @costing_stage, @country, @payment_terms, @shipment_mode,
          @delivery_terms, @parity_sale, @parity_procurement, @manpower,
          @efficiency_override, @rejection_override, @rejection_pct, @line_target_override,
          @discount_rate, @payment_terms_days, @factoring_days, @commission_pct,
          @foreign_bank_charges, @tax_eds_pct, @inland_freight_pct, @local_bank_charges_pct,
          @order_fob, @quoted_price, @intl_freight,
          @intl_insurance, @no_of_colors, @merch_group, @work_order_number,
          @delivery_destination, @ex_factory_date, @inhouse_or_subcontract,
          @rebate_pct, @approvals, @approval_status, @bom_fabric, @bom_lining, @bom_accessories, @bom_chemicals,
          @bom_special_charges, @direct_labour_foh_snapshot, @calculations,
          @created_by_id, @created_by_email, @created_by_name, @saved_at
        )
      `);

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/cost-sheets]", err);
    return Response.json(
      { error: "Failed to save cost sheet", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
