import { getPool } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/customers
 * Customer Costing & Commercial Performance Report (Costing Database Only)
 * Summarizes commercial costing activity by customer:
 * - Customer Name
 * - Total Cost Sheets Authored
 * - Status Breakdown (Draft, In Review, Fully Approved)
 * - Total Order Quantity Costed (pcs)
 * - Average Quoted & Confirmed FOB ($)
 * - Total Commercial Value ($)
 * - Average Net Profit Margin %
 * - Drilldown into all cost sheets for a given customer
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const singleCustomer = searchParams.get("customer")?.trim() || "";

    const appPool = await getPool();

    // 1. Single Customer Drilldown
    if (singleCustomer) {
      const res = await appPool
        .request()
        .input("cust", singleCustomer)
        .query<{
          id: string;
          reference_name: string;
          cost_sheet_number: string;
          style_id: string;
          style_name: string;
          work_order_number: string;
          order_quantity: number;
          order_fob: number;
          quoted_price: number;
          approval_status: string;
          costing_date: string;
          style_category: string;
          calculations: string;
          created_by_name: string;
          inserted_at: string;
        }>(
          `SELECT id, reference_name, cost_sheet_number, style_id, style_name,
                  work_order_number, order_quantity, order_fob, quoted_price,
                  approval_status, costing_date, style_category, calculations,
                  created_by_name, inserted_at
           FROM pre_order_cost_sheets
           WHERE (customer_name = @cust OR (customer_name IS NULL AND @cust = 'Unassigned'))
             AND deleted_at IS NULL
           ORDER BY inserted_at DESC`
        );

      const costSheets = res.recordset.map((r) => {
        let calc: any = null;
        try { if (r.calculations) calc = JSON.parse(r.calculations); } catch (_) {}
        const qty = r.order_quantity || 0;
        const fob = r.order_fob || 0;
        return {
          id: r.id,
          referenceName: r.reference_name,
          costSheetNumber: r.cost_sheet_number || "—",
          workOrderNo: r.work_order_number || "—",
          styleCode: r.style_id || "Custom",
          styleName: r.style_name || r.reference_name,
          orderQuantity: qty,
          orderFob: fob,
          quotedPrice: r.quoted_price || fob,
          orderValueUSD: Number((qty * fob).toFixed(2)),
          approvalStatus: r.approval_status || "draft",
          costingDate: r.costing_date || (r.inserted_at ? new Date(r.inserted_at).toISOString().split("T")[0] : null),
          styleCategory: r.style_category || "Standard",
          createdByName: r.created_by_name || "Merchant",
          calculations: calc,
        };
      });

      const totalUnits = costSheets.reduce((acc, c) => acc + c.orderQuantity, 0);
      const totalValue = costSheets.reduce((acc, c) => acc + c.orderValueUSD, 0);

      return NextResponse.json({
        customer: singleCustomer,
        costSheets,
        summary: {
          totalCostSheets: costSheets.length,
          totalUnits,
          totalValueUSD: Number(totalValue.toFixed(2)),
          avgFob: totalUnits > 0 ? Number((totalValue / totalUnits).toFixed(2)) : 0,
        },
      });
    }

    // 2. Aggregate Customers List across Costing DB
    const res = await appPool.request().query<{
      id: string;
      customer_name: string;
      order_quantity: number;
      order_fob: number;
      quoted_price: number;
      approval_status: string;
      calculations: string;
      costing_date: string;
    }>(
      `SELECT 
        id,
        customer_name,
        order_quantity,
        order_fob,
        quoted_price,
        approval_status,
        calculations,
        costing_date
       FROM pre_order_cost_sheets
       WHERE deleted_at IS NULL`
    );

    const custMap = new Map<string, any>();

    for (const r of res.recordset) {
      const custName = r.customer_name && r.customer_name.trim() !== "" ? r.customer_name.trim() : "Unassigned Customer";

      let calc: any = null;
      try {
        if (r.calculations) calc = JSON.parse(r.calculations);
      } catch (_) {}

      const qty = r.order_quantity || 0;
      const fob = r.order_fob || 0;
      const value = qty * fob;
      const netProfitPct = calc?.netProfitPct ? calc.netProfitPct * 100 : 0;

      if (!custMap.has(custName)) {
        custMap.set(custName, {
          customer: custName,
          costSheetsCount: 0,
          approvedCount: 0,
          inReviewCount: 0,
          draftCount: 0,
          totalUnitsCosted: 0,
          totalValueUSD: 0,
          fobSum: 0,
          profitPctSum: 0,
          latestDate: r.costing_date,
        });
      }

      const item = custMap.get(custName)!;
      item.costSheetsCount += 1;
      const st = r.approval_status || "draft";
      if (st === "approved" || st === "fully_approved") item.approvedCount += 1;
      else if (st === "in_review") item.inReviewCount += 1;
      else item.draftCount += 1;

      item.totalUnitsCosted += qty;
      item.totalValueUSD += value;
      item.fobSum += fob;
      item.profitPctSum += netProfitPct;

      if (r.costing_date && (!item.latestDate || r.costing_date > item.latestDate)) {
        item.latestDate = r.costing_date;
      }
    }

    let rows = Array.from(custMap.values()).map((c) => {
      const count = c.costSheetsCount || 1;
      return {
        customer: c.customer,
        costSheetsCount: c.costSheetsCount,
        approvedCount: c.approvedCount,
        inReviewCount: c.inReviewCount,
        draftCount: c.draftCount,
        totalUnitsCosted: c.totalUnitsCosted,
        totalValueUSD: Number(c.totalValueUSD.toFixed(2)),
        avgFob: Number((c.fobSum / count).toFixed(2)),
        avgProfitMarginPct: Number((c.profitPctSum / count).toFixed(1)),
        latestDate: c.latestDate || "—",
      };
    });

    if (search) {
      rows = rows.filter((r) => r.customer.toLowerCase().includes(search));
    }

    return NextResponse.json({
      summary: {
        totalCustomers: rows.length,
        totalCostSheets: rows.reduce((acc, r) => acc + r.costSheetsCount, 0),
        totalUnitsCosted: rows.reduce((acc, r) => acc + r.totalUnitsCosted, 0),
        totalCommercialValueUSD: Number(rows.reduce((acc, r) => acc + r.totalValueUSD, 0).toFixed(2)),
      },
      rows,
      totalCount: rows.length,
    });
  } catch (err: any) {
    console.error("[/api/reports/customers] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch customer costing reports" },
      { status: 500 }
    );
  }
}
