import { getPool } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/styles
 * Style Costing & Profitability Report (Costing Database Only)
 * Aggregates pre-order cost sheets by style:
 * - Style ID & Style Name
 * - Associated Customer & Category
 * - Total Cost Sheets Created, Total Units Costed
 * - Average FOB ($), Average Quoted Price ($), Cumulative Costed Value ($)
 * - Average SMV/SAM, Average CM ($), Average Net Profit Margin %
 * - Granular BOM and calculation drilldown
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const customer = searchParams.get("customer")?.trim() || "";
    const singleStyle = searchParams.get("styleCode")?.trim() || "";

    const appPool = await getPool();

    // 1. Single Style Drilldown: All Cost Sheets for this style
    if (singleStyle) {
      const res = await appPool
        .request()
        .input("styleId", singleStyle)
        .query<{
          id: string;
          reference_name: string;
          cost_sheet_number: string;
          style_id: string;
          style_name: string;
          customer_name: string;
          order_quantity: number;
          order_fob: number;
          quoted_price: number;
          approval_status: string;
          costing_date: string;
          style_category: string;
          wash_type: string;
          smv_sewing: number;
          calculations: string;
          bom_fabric: string;
          bom_lining: string;
          bom_accessories: string;
          bom_chemicals: string;
          approvals: string;
          created_by_name: string;
          inserted_at: string;
        }>(
          `SELECT id, reference_name, cost_sheet_number, style_id, style_name, customer_name,
                  order_quantity, order_fob, quoted_price, approval_status, costing_date,
                  style_category, wash_type, smv_sewing, calculations,
                  bom_fabric, bom_lining, bom_accessories, bom_chemicals, approvals,
                  created_by_name, inserted_at
           FROM pre_order_cost_sheets
           WHERE (style_id = @styleId OR (style_id = 'custom' AND reference_name = @styleId) OR id = @styleId)
             AND deleted_at IS NULL
           ORDER BY inserted_at DESC`
        );

      const costSheets = res.recordset.map((r) => {
        let calc: any = null;
        let approvals: any = null;
        let fabric: any[] = [];
        let lining: any[] = [];
        let accessories: any[] = [];
        let chemicals: any[] = [];

        try { if (r.calculations) calc = JSON.parse(r.calculations); } catch (_) {}
        try { if (r.approvals) approvals = JSON.parse(r.approvals); } catch (_) {}
        try { if (r.bom_fabric) fabric = JSON.parse(r.bom_fabric); } catch (_) {}
        try { if (r.bom_lining) lining = JSON.parse(r.bom_lining); } catch (_) {}
        try { if (r.bom_accessories) accessories = JSON.parse(r.bom_accessories); } catch (_) {}
        try { if (r.bom_chemicals) chemicals = JSON.parse(r.bom_chemicals); } catch (_) {}

        return {
          id: r.id,
          referenceName: r.reference_name,
          costSheetNumber: r.cost_sheet_number || "—",
          styleId: r.style_id,
          styleName: r.style_name || r.reference_name,
          customerName: r.customer_name || "—",
          orderQuantity: r.order_quantity || 0,
          orderFob: r.order_fob || 0,
          quotedPrice: r.quoted_price || 0,
          totalValueUSD: Number(((r.order_quantity || 0) * (r.order_fob || 0)).toFixed(2)),
          approvalStatus: r.approval_status || "draft",
          costingDate: r.costing_date,
          styleCategory: r.style_category,
          washType: r.wash_type,
          smvSewing: r.smv_sewing,
          createdByName: r.created_by_name || "Merchant",
          calculations: calc,
          approvals,
          bom: {
            fabric,
            lining,
            accessories,
            chemicals,
          },
        };
      });

      return NextResponse.json({
        styleCode: singleStyle,
        costSheets,
        summary: {
          totalSheets: costSheets.length,
          totalUnits: costSheets.reduce((acc, c) => acc + c.orderQuantity, 0),
          totalCostedValueUSD: costSheets.reduce((acc, c) => acc + c.totalValueUSD, 0),
        },
      });
    }

    // 2. Aggregate Styles Summary across all Cost Sheets
    let query = `
      SELECT 
        id,
        reference_name,
        style_id,
        style_name,
        customer_name,
        order_quantity,
        order_fob,
        quoted_price,
        style_category,
        smv_sewing,
        approval_status,
        calculations,
        costing_date,
        inserted_at
      FROM pre_order_cost_sheets
      WHERE deleted_at IS NULL
    `;

    const reqObj = appPool.request();
    if (customer) {
      query += ` AND customer_name = @customer`;
      reqObj.input("customer", customer);
    }

    const res = await reqObj.query<{
      id: string;
      reference_name: string;
      style_id: string;
      style_name: string;
      customer_name: string;
      order_quantity: number;
      order_fob: number;
      quoted_price: number;
      style_category: string;
      smv_sewing: number;
      approval_status: string;
      calculations: string;
      costing_date: string;
      inserted_at: string;
    }>(query);

    // Group rows by Style Identifier (style_id if valid, else reference_name)
    const styleMap = new Map<string, any>();

    for (const r of res.recordset) {
      const key = r.style_id && r.style_id !== "custom" && r.style_id.trim() !== ""
        ? r.style_id
        : `${r.reference_name || r.id}`;

      let calc: any = null;
      try {
        if (r.calculations) calc = JSON.parse(r.calculations);
      } catch (_) {}

      const qty = r.order_quantity || 0;
      const fob = r.order_fob || 0;
      const cmUSD = calc?.cmUSD || 0;
      const netProfitUSD = calc?.netProfitUSD || 0;
      const netProfitPct = calc?.netProfitPct ? calc.netProfitPct * 100 : 0;

      if (!styleMap.has(key)) {
        styleMap.set(key, {
          styleCode: key,
          styleName: r.style_name || r.reference_name,
          customer: r.customer_name || "Unassigned",
          category: r.style_category || "Standard",
          costSheetsCount: 0,
          approvedSheetsCount: 0,
          totalUnitsCosted: 0,
          totalValueUSD: 0,
          fobSum: 0,
          smvSum: 0,
          cmSum: 0,
          profitPctSum: 0,
          latestCostingDate: r.costing_date,
        });
      }

      const item = styleMap.get(key)!;
      item.costSheetsCount += 1;
      if (r.approval_status === "approved" || r.approval_status === "fully_approved") {
        item.approvedSheetsCount += 1;
      }
      item.totalUnitsCosted += qty;
      item.totalValueUSD += qty * fob;
      item.fobSum += fob;
      item.smvSum += r.smv_sewing || 0;
      item.cmSum += cmUSD;
      item.profitPctSum += netProfitPct;
      if (r.costing_date && (!item.latestCostingDate || r.costing_date > item.latestCostingDate)) {
        item.latestCostingDate = r.costing_date;
      }
    }

    let rows = Array.from(styleMap.values()).map((s) => {
      const count = s.costSheetsCount || 1;
      return {
        styleCode: s.styleCode,
        styleName: s.styleName,
        customer: s.customer,
        category: s.category,
        costSheetsCount: s.costSheetsCount,
        approvedSheetsCount: s.approvedSheetsCount,
        totalUnitsCosted: s.totalUnitsCosted,
        totalValueUSD: Number(s.totalValueUSD.toFixed(2)),
        avgFob: Number((s.fobSum / count).toFixed(2)),
        avgSmv: Number((s.smvSum / count).toFixed(2)),
        avgCmUSD: Number((s.cmSum / count).toFixed(2)),
        avgProfitPct: Number((s.profitPctSum / count).toFixed(1)),
        latestCostingDate: s.latestCostingDate || "—",
      };
    });

    if (search) {
      rows = rows.filter(
        (r) =>
          r.styleCode.toLowerCase().includes(search) ||
          r.styleName.toLowerCase().includes(search) ||
          r.customer.toLowerCase().includes(search)
      );
    }

    return NextResponse.json({
      summary: {
        totalStyles: rows.length,
        totalCostSheets: rows.reduce((acc, r) => acc + r.costSheetsCount, 0),
        totalUnitsCosted: rows.reduce((acc, r) => acc + r.totalUnitsCosted, 0),
        totalCostedValueUSD: Number(rows.reduce((acc, r) => acc + r.totalValueUSD, 0).toFixed(2)),
      },
      rows,
      totalCount: rows.length,
    });
  } catch (err: any) {
    console.error("[/api/reports/styles] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch style costing reports" },
      { status: 500 }
    );
  }
}
