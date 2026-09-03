import { NextRequest } from "next/server";
import { getPool, sql } from "@/lib/db";
import type { SavedCostSheetItem } from "@/lib/cost-sheet/types";

// ---------------------------------------------------------------------------
// Ensure the table exists (idempotent DDL, runs on every cold start)
// ---------------------------------------------------------------------------
async function ensureTable(pool: Awaited<ReturnType<typeof getPool>>) {
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
  `);
}

// ---------------------------------------------------------------------------
// Map a DB row → SavedCostSheetItem
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
// GET /api/cost-sheets  — list all, sorted by savedAt DESC
// GET /api/cost-sheets?styleId=X&nextId=1  — returns next sequential ID
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const pool = await getPool();
    await ensureTable(pool);

    const { searchParams } = request.nextUrl;
    const styleId = searchParams.get("styleId");
    const nextId = searchParams.get("nextId");

    // Special case: generate next sequential cost sheet ID
    if (styleId && nextId === "1") {
      const prefix = `PCS-${styleId}-`;
      const result = await pool
        .request()
        .input("prefix", sql.NVarChar, `${prefix}%`)
        .query<{ id: string }>(
          "SELECT id FROM pre_order_cost_sheets WHERE id LIKE @prefix"
        );

      let maxSeq = 0;
      for (const row of result.recordset) {
        const seq = parseInt(row.id.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
      const nextIdStr = `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
      return Response.json({ nextId: nextIdStr });
    }

    // Normal list
    const result = await pool
      .request()
      .query(
        "SELECT * FROM pre_order_cost_sheets ORDER BY saved_at DESC"
      );

    const items: SavedCostSheetItem[] = result.recordset.map(rowToItem);
    return Response.json(items);
  } catch (err) {
    console.error("[GET /api/cost-sheets]", err);
    return Response.json(
      { error: "Failed to fetch cost sheets" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/cost-sheets  — insert a new cost sheet row
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const item: SavedCostSheetItem = await request.json();
    const pool = await getPool();
    await ensureTable(pool);

    await pool
      .request()
      .input("id", sql.NVarChar(64), item.id)
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
        INSERT INTO pre_order_cost_sheets (
          id, reference_name, style_id, style_name, customer_name,
          style_category, order_quantity, smv_sewing, order_type, wash_type,
          costing_date, costing_stage, country, payment_terms, shipment_mode,
          delivery_terms, parity_sale, parity_procurement, manpower,
          efficiency_override, rejection_override, line_target_override,
          discount_rate, payment_terms_days, factoring_days, commission_pct,
          foreign_bank_charges, order_fob, quoted_price, intl_freight,
          intl_insurance, no_of_colors, merch_group, work_order_number,
          delivery_destination, ex_factory_date, inhouse_or_subcontract,
          rebate_pct, bom_fabric, bom_lining, bom_accessories, bom_chemicals,
          bom_special_charges, calculations, saved_at
        ) VALUES (
          @id, @reference_name, @style_id, @style_name, @customer_name,
          @style_category, @order_quantity, @smv_sewing, @order_type, @wash_type,
          @costing_date, @costing_stage, @country, @payment_terms, @shipment_mode,
          @delivery_terms, @parity_sale, @parity_procurement, @manpower,
          @efficiency_override, @rejection_override, @line_target_override,
          @discount_rate, @payment_terms_days, @factoring_days, @commission_pct,
          @foreign_bank_charges, @order_fob, @quoted_price, @intl_freight,
          @intl_insurance, @no_of_colors, @merch_group, @work_order_number,
          @delivery_destination, @ex_factory_date, @inhouse_or_subcontract,
          @rebate_pct, @bom_fabric, @bom_lining, @bom_accessories, @bom_chemicals,
          @bom_special_charges, @calculations, @saved_at
        )
      `);

    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/cost-sheets]", err);
    return Response.json(
      { error: "Failed to save cost sheet" },
      { status: 500 }
    );
  }
}
