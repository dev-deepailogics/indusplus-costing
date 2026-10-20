import { getPool } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/work-orders
 * Work Order Costing Report (Costing Database Only)
 * Analyzes work orders linked to pre-order cost sheets:
 * - Work order number, Reference Name, Style, Customer, Cost Sheet Number
 * - Order Quantity, Order FOB ($), Quoted Price ($), Total Order Value ($)
 * - Cost breakdown: CM ($), EBITDA ($), Net Profit ($), Margin %
 * - Approval status and date
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const customer = searchParams.get("customer")?.trim() || "";
    const singleWo = searchParams.get("workOrderNo")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";

    const appPool = await getPool();

    // 1. Single Work Order Drilldown
    if (singleWo) {
      const res = await appPool
        .request()
        .input("woNo", singleWo)
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
          costing_stage: string;
          wash_type: string;
          style_category: string;
          smv_sewing: number;
          calculations: string;
          bom_fabric: string;
          bom_lining: string;
          bom_accessories: string;
          bom_chemicals: string;
          approvals: string;
          created_by_name: string;
          created_by_email: string;
          inserted_at: string;
        }>(
          `SELECT id, reference_name, cost_sheet_number, style_id, style_name, customer_name,
                  order_quantity, order_fob, quoted_price, approval_status, costing_date,
                  costing_stage, wash_type, style_category, smv_sewing, calculations,
                  bom_fabric, bom_lining, bom_accessories, bom_chemicals, approvals,
                  created_by_name, created_by_email, inserted_at
           FROM pre_order_cost_sheets
           WHERE (
             id = @woNo 
             OR cost_sheet_number = @woNo 
             OR work_order_number = @woNo 
             OR reference_name = @woNo
           ) AND deleted_at IS NULL`
        );

      if (res.recordset.length === 0) {
        return NextResponse.json({ error: "Work order cost sheet not found" }, { status: 404 });
      }

      const row = res.recordset[0];
      let calc = null;
      let approvals = null;
      let fabric = [];
      let lining = [];
      let accessories = [];
      let chemicals = [];

      try { if (row.calculations) calc = JSON.parse(row.calculations); } catch (_) {}
      try { if (row.approvals) approvals = JSON.parse(row.approvals); } catch (_) {}
      try { if (row.bom_fabric) fabric = JSON.parse(row.bom_fabric); } catch (_) {}
      try { if (row.bom_lining) lining = JSON.parse(row.bom_lining); } catch (_) {}
      try { if (row.bom_accessories) accessories = JSON.parse(row.bom_accessories); } catch (_) {}
      try { if (row.bom_chemicals) chemicals = JSON.parse(row.bom_chemicals); } catch (_) {}

      return NextResponse.json({
        costSheet: {
          id: row.id,
          workOrderNo: singleWo,
          referenceName: row.reference_name,
          costSheetNumber: row.cost_sheet_number,
          styleId: row.style_id,
          styleName: row.style_name,
          customerName: row.customer_name,
          orderQuantity: row.order_quantity || 0,
          orderFob: row.order_fob || 0,
          quotedPrice: row.quoted_price || 0,
          totalValueUSD: Number(((row.order_quantity || 0) * (row.order_fob || 0)).toFixed(2)),
          approvalStatus: row.approval_status || "draft",
          costingDate: row.costing_date,
          costingStage: row.costing_stage,
          washType: row.wash_type,
          styleCategory: row.style_category,
          smvSewing: row.smv_sewing,
          createdByName: row.created_by_name || "Merchant",
          calculations: calc,
          approvals,
          bomSummary: {
            fabricItems: fabric.length,
            liningItems: lining.length,
            accessoriesItems: accessories.length,
            chemicalsItems: chemicals.length,
            fabric,
            lining,
            accessories,
            chemicals,
          },
        },
      });
    }

    // 2. All Work Orders in Costing DB
    let query = `
      SELECT 
        id,
        reference_name,
        cost_sheet_number,
        style_id,
        style_name,
        customer_name,
        work_order_number,
        order_quantity,
        order_fob,
        quoted_price,
        approval_status,
        costing_date,
        style_category,
        smv_sewing,
        calculations,
        created_by_name,
        inserted_at
      FROM pre_order_cost_sheets
      WHERE deleted_at IS NULL
    `;

    const reqObj = appPool.request();

    if (customer) {
      query += ` AND customer_name = @customer`;
      reqObj.input("customer", customer);
    }
    if (status) {
      query += ` AND approval_status = @status`;
      reqObj.input("status", status);
    }

    query += ` ORDER BY inserted_at DESC`;

    const result = await reqObj.query<{
      id: string;
      reference_name: string;
      cost_sheet_number: string;
      style_id: string;
      style_name: string;
      customer_name: string;
      work_order_number: string;
      order_quantity: number;
      order_fob: number;
      quoted_price: number;
      approval_status: string;
      costing_date: string;
      style_category: string;
      smv_sewing: number;
      calculations: string;
      created_by_name: string;
      inserted_at: string;
    }>(query);

    let rows = result.recordset.map((r) => {
      let calc: any = null;
      try {
        if (r.calculations) calc = JSON.parse(r.calculations);
      } catch (_) {}

      const qty = r.order_quantity || 0;
      const fob = r.order_fob || 0;
      const totalValue = qty * fob;
      const cmUSD = calc?.cmUSD || 0;
      const netProfitUSD = calc?.netProfitUSD || 0;
      const netProfitPct = calc?.netProfitPct ? Number((calc.netProfitPct * 100).toFixed(1)) : 0;
      const targetFob = calc?.targetFobUSD || 0;

      const woNo = r.work_order_number && r.work_order_number.trim() !== ""
        ? r.work_order_number
        : r.cost_sheet_number || r.id;

      return {
        id: r.id,
        workOrderNo: woNo,
        referenceName: r.reference_name,
        costSheetNumber: r.cost_sheet_number || "—",
        styleCode: r.style_id && r.style_id !== "custom" ? r.style_id : "Custom Style",
        styleName: r.style_name || r.reference_name,
        customer: r.customer_name || "Unassigned Customer",
        orderQuantity: qty,
        orderFob: fob,
        targetFob: Number(targetFob.toFixed(2)),
        quotedPrice: r.quoted_price || fob,
        totalOrderValueUSD: Number(totalValue.toFixed(2)),
        cmUSD: Number(cmUSD.toFixed(2)),
        netProfitUSD: Number(netProfitUSD.toFixed(2)),
        netProfitPct,
        smvSewing: r.smv_sewing || 0,
        styleCategory: r.style_category || "Standard",
        approvalStatus: r.approval_status || "draft",
        costingDate: r.costing_date || (r.inserted_at ? new Date(r.inserted_at).toISOString().split("T")[0] : null),
        createdByName: r.created_by_name || "Merchant",
      };
    });

    if (search) {
      rows = rows.filter(
        (r) =>
          r.workOrderNo.toLowerCase().includes(search) ||
          r.referenceName.toLowerCase().includes(search) ||
          r.styleCode.toLowerCase().includes(search) ||
          r.styleName.toLowerCase().includes(search) ||
          r.customer.toLowerCase().includes(search)
      );
    }

    const totalWorkOrders = rows.length;
    const totalUnits = rows.reduce((acc, r) => acc + r.orderQuantity, 0);
    const totalOrderValueUSD = rows.reduce((acc, r) => acc + r.totalOrderValueUSD, 0);
    const avgFob = totalUnits > 0 ? totalOrderValueUSD / totalUnits : 0;
    const approvedCount = rows.filter((r) => r.approvalStatus === "approved" || r.approvalStatus === "fully_approved").length;

    return NextResponse.json({
      summary: {
        totalWorkOrders,
        totalUnits,
        totalOrderValueUSD: Number(totalOrderValueUSD.toFixed(2)),
        avgFob: Number(avgFob.toFixed(2)),
        approvedCount,
      },
      rows,
      totalCount: rows.length,
    });
  } catch (err: any) {
    console.error("[/api/reports/work-orders] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch work order costing reports" },
      { status: 500 }
    );
  }
}
