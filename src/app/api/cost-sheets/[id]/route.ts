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
    calculations: JSON.parse(row.calculations || "{}"),
    savedAt: row.saved_at,
  };
}

// ---------------------------------------------------------------------------
// Ensure the table exists and columns are up to date
// ---------------------------------------------------------------------------
let isTableEnsured = false;
async function ensureTable(pool: Awaited<ReturnType<typeof getPool>>) {
  if (isTableEnsured) return;
  await pool.request().query(`
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = 'pre_order_cost_sheets'
    )
    BEGIN
        CREATE TABLE pre_order_cost_sheets (
            id                     NVARCHAR(64)   NOT NULL PRIMARY KEY,
            reference_name         NVARCHAR(256)  NOT NULL,
            style_id               NVARCHAR(64)   NOT NULL,
            style_name             NVARCHAR(256)  NOT NULL,
            customer_name          NVARCHAR(256)  NOT NULL,
            style_category         NVARCHAR(128)  NOT NULL,
            order_quantity         INT            NOT NULL DEFAULT 0,
            smv_sewing             FLOAT          NOT NULL DEFAULT 0,
            order_type             NVARCHAR(128)  NOT NULL DEFAULT '',
            wash_type              NVARCHAR(128)  NOT NULL DEFAULT '',
            costing_date           NVARCHAR(32)   NOT NULL DEFAULT '',
            costing_stage          NVARCHAR(64)   NOT NULL DEFAULT '',
            country                NVARCHAR(128)  NOT NULL DEFAULT '',
            payment_terms          NVARCHAR(128)  NOT NULL DEFAULT '',
            shipment_mode          NVARCHAR(128)  NOT NULL DEFAULT '',
            delivery_terms         NVARCHAR(128)  NOT NULL DEFAULT '',
            parity_sale            FLOAT          NOT NULL DEFAULT 0,
            parity_procurement     FLOAT          NOT NULL DEFAULT 0,
            manpower               INT            NOT NULL DEFAULT 0,
            efficiency_override    FLOAT          NULL,
            rejection_override     FLOAT          NULL,
            line_target_override   FLOAT          NULL,
            discount_rate          FLOAT          NOT NULL DEFAULT 0,
            payment_terms_days     INT            NOT NULL DEFAULT 0,
            factoring_days         INT            NOT NULL DEFAULT 0,
            commission_pct         FLOAT          NOT NULL DEFAULT 0,
            foreign_bank_charges   FLOAT          NOT NULL DEFAULT 0,
            order_fob              FLOAT          NOT NULL DEFAULT 0,
            quoted_price           FLOAT          NULL,
            intl_freight           FLOAT          NULL,
            intl_insurance         FLOAT          NULL,
            no_of_colors           INT            NULL,
            merch_group            NVARCHAR(128)  NULL,
            work_order_number      NVARCHAR(64)   NULL,
            delivery_destination   NVARCHAR(256)  NULL,
            ex_factory_date        NVARCHAR(32)   NULL,
            inhouse_or_subcontract NVARCHAR(64)   NULL,
            rebate_pct             FLOAT          NULL,
            bom_fabric             NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
            bom_lining             NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
            bom_accessories        NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
            bom_chemicals          NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
            bom_special_charges    NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
            calculations           NVARCHAR(MAX)  NOT NULL DEFAULT '{}',
            saved_at               NVARCHAR(64)   NOT NULL
        );
        CREATE INDEX IX_pcs_style_id ON pre_order_cost_sheets (style_id);
        CREATE INDEX IX_pcs_saved_at ON pre_order_cost_sheets (saved_at DESC);
    END
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'tax_eds_pct')
      ALTER TABLE pre_order_cost_sheets ADD tax_eds_pct FLOAT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'inland_freight_pct')
      ALTER TABLE pre_order_cost_sheets ADD inland_freight_pct FLOAT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'local_bank_charges_pct')
      ALTER TABLE pre_order_cost_sheets ADD local_bank_charges_pct FLOAT NULL;
  `);
  isTableEnsured = true;
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
    await ensureTable(pool);

    const result = await pool
      .request()
      .input("id", id)
      .query("SELECT * FROM pre_order_cost_sheets WHERE id = @id");

    if (result.recordset.length === 0) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return Response.json(rowToItem(result.recordset[0]));
  } catch (err) {
    console.error("[GET /api/cost-sheets/[id]]", err);
    return Response.json(
      { error: "Failed to fetch cost sheet", details: err instanceof Error ? err.message : String(err) },
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
    await ensureTable(pool);

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
      .input("rejection_override", item.rejectionOverride ?? null)
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
      .input("bom_fabric", JSON.stringify(item.bomFabric || []))
      .input("bom_lining", JSON.stringify(item.bomLining || []))
      .input("bom_accessories", JSON.stringify(item.bomAccessories || []))
      .input("bom_chemicals", JSON.stringify(item.bomChemicals || []))
      .input("bom_special_charges", JSON.stringify(item.bomSpecialCharges || []))
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
    const { id } = await params;
    const pool = await getPool();

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
