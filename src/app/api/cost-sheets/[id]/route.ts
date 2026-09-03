import { NextRequest } from "next/server";
import { getPool, sql } from "@/lib/db";
import type { SavedCostSheetItem } from "@/lib/cost-sheet/types";

// ---------------------------------------------------------------------------
// Map a DB row → SavedCostSheetItem (same helper as collection route)
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToItem(row: Record<string, any>): SavedCostSheetItem {
  return {
    id: row.id,
    referenceName: row.reference_name,
    styleId: row.style_id,
    styleName: row.style_name,
    customerName: row.customer_name,
    styleCategory: row.style_category,
    orderQuantity: row.order_quantity,
    smvSewing: row.smv_sewing,
    orderType: row.order_type,
    washType: row.wash_type,
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
    rejectionOverride: row.rejection_override ?? null,
    lineTargetOverride: row.line_target_override ?? null,
    discountRate: row.discount_rate,
    paymentTermsDays: row.payment_terms_days,
    factoringDays: row.factoring_days,
    commissionPct: row.commission_pct,
    foreignBankCharges: row.foreign_bank_charges,
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
    calculations: JSON.parse(row.calculations || "{}"),
    savedAt: row.saved_at,
  };
}

// ---------------------------------------------------------------------------
// GET /api/cost-sheets/[id]  — fetch single cost sheet
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const pool = await getPool();

    const result = await pool
      .request()
      .input("id", sql.NVarChar(64), id)
      .query("SELECT * FROM pre_order_cost_sheets WHERE id = @id");

    if (result.recordset.length === 0) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(rowToItem(result.recordset[0]));
  } catch (err) {
    console.error("[GET /api/cost-sheets/[id]]", err);
    return Response.json(
      { error: "Failed to fetch cost sheet" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT /api/cost-sheets/[id]  — full update of existing cost sheet
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item: SavedCostSheetItem = await request.json();
    const pool = await getPool();

    await pool
      .request()
      .input("id", sql.NVarChar(64), id)
      .input("reference_name", sql.NVarChar(256), item.referenceName)
      .input("style_id", sql.NVarChar(64), item.styleId)
      .input("style_name", sql.NVarChar(256), item.styleName)
      .input("customer_name", sql.NVarChar(256), item.customerName)
      .input("style_category", sql.NVarChar(128), item.styleCategory)
      .input("order_quantity", sql.Int, item.orderQuantity)
      .input("smv_sewing", sql.Float, item.smvSewing)
      .input("order_type", sql.NVarChar(128), item.orderType)
      .input("wash_type", sql.NVarChar(128), item.washType)
      .input("costing_date", sql.NVarChar(32), item.costingDate)
      .input("costing_stage", sql.NVarChar(64), item.costingStage)
      .input("country", sql.NVarChar(128), item.country)
      .input("payment_terms", sql.NVarChar(128), item.paymentTerms)
      .input("shipment_mode", sql.NVarChar(128), item.shipmentMode)
      .input("delivery_terms", sql.NVarChar(128), item.deliveryTerms)
      .input("parity_sale", sql.Float, item.paritySale)
      .input("parity_procurement", sql.Float, item.parityProcurement)
      .input("manpower", sql.Int, item.manpower)
      .input("efficiency_override", sql.Float, item.efficiencyOverride)
      .input("rejection_override", sql.Float, item.rejectionOverride)
      .input("line_target_override", sql.Float, item.lineTargetOverride)
      .input("discount_rate", sql.Float, item.discountRate)
      .input("payment_terms_days", sql.Int, item.paymentTermsDays)
      .input("factoring_days", sql.Int, item.factoringDays)
      .input("commission_pct", sql.Float, item.commissionPct)
      .input("foreign_bank_charges", sql.Float, item.foreignBankCharges)
      .input("order_fob", sql.Float, item.orderFOB)
      .input("quoted_price", sql.Float, item.quotedPrice ?? null)
      .input("intl_freight", sql.Float, item.intlFreight ?? null)
      .input("intl_insurance", sql.Float, item.intlInsurance ?? null)
      .input("no_of_colors", sql.Int, item.noOfColors ?? null)
      .input("merch_group", sql.NVarChar(128), item.merchGroup ?? null)
      .input("work_order_number", sql.NVarChar(64), item.workOrderNumber ?? null)
      .input("delivery_destination", sql.NVarChar(256), item.deliveryDestination ?? null)
      .input("ex_factory_date", sql.NVarChar(32), item.exFactoryDate ?? null)
      .input("inhouse_or_subcontract", sql.NVarChar(64), item.inhouseOrSubcontract ?? null)
      .input("rebate_pct", sql.Float, item.rebatePct ?? null)
      .input("bom_fabric", sql.NVarChar(sql.MAX), JSON.stringify(item.bomFabric))
      .input("bom_lining", sql.NVarChar(sql.MAX), JSON.stringify(item.bomLining))
      .input("bom_accessories", sql.NVarChar(sql.MAX), JSON.stringify(item.bomAccessories))
      .input("bom_chemicals", sql.NVarChar(sql.MAX), JSON.stringify(item.bomChemicals))
      .input("bom_special_charges", sql.NVarChar(sql.MAX), JSON.stringify(item.bomSpecialCharges))
      .input("calculations", sql.NVarChar(sql.MAX), JSON.stringify(item.calculations))
      .input("saved_at", sql.NVarChar(64), item.savedAt)
      .query(`
        UPDATE pre_order_cost_sheets SET
          reference_name         = @reference_name,
          style_id               = @style_id,
          style_name             = @style_name,
          customer_name          = @customer_name,
          style_category         = @style_category,
          order_quantity         = @order_quantity,
          smv_sewing             = @smv_sewing,
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
          line_target_override   = @line_target_override,
          discount_rate          = @discount_rate,
          payment_terms_days     = @payment_terms_days,
          factoring_days         = @factoring_days,
          commission_pct         = @commission_pct,
          foreign_bank_charges   = @foreign_bank_charges,
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
          calculations           = @calculations,
          saved_at               = @saved_at
        WHERE id = @id
      `);

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[PUT /api/cost-sheets/[id]]", err);
    return Response.json(
      { error: "Failed to update cost sheet" },
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
    const { id } = await params;
    const pool = await getPool();

    await pool
      .request()
      .input("id", sql.NVarChar(64), id)
      .query("DELETE FROM pre_order_cost_sheets WHERE id = @id");

    return Response.json({ ok: true });
  } catch (err) {
    console.error("[DELETE /api/cost-sheets/[id]]", err);
    return Response.json(
      { error: "Failed to delete cost sheet" },
      { status: 500 }
    );
  }
}
