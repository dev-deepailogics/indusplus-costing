import { getIndusPool } from "@/lib/db";
import { NextResponse } from "next/server";

export interface StyleWorkOrderRow {
  workOrderNo: string;
  styleCode: string;
  styleName: string;
  customer: string;
  poQty: number | null;
  planCutQty: string | null;
  workOrderDate: string | null;
}

/**
 * GET /api/styles-and-workorders
 * Returns all rows from S_StyleAndWorkOrdersView in the indus-plus database.
 * Used to populate the Style Select and Work Order dropdowns on the Cost Sheet.
 */
export async function GET() {
  try {
    const pool = await getIndusPool();
    const result = await pool.request().query<{
      WorkOrderNo: string;
      StyleCode: string;
      StyleName: string;
      Customer: string;
      POQty: number | null;
      PlanCutQty: string | null;
      WorkOrderDate: string | null;
    }>(
      `SELECT WorkOrderNo, StyleCode, StyleName, Customer, POQty, PlanCutQty, WorkOrderDate
       FROM   S_StyleAndWorkOrdersView
       WHERE  StyleCode IS NOT NULL AND StyleCode <> ''
       ORDER  BY WorkOrderDate DESC, WorkOrderNo DESC`
    );

    const rows: StyleWorkOrderRow[] = result.recordset.map((r) => ({
      workOrderNo: r.WorkOrderNo ?? "",
      styleCode: r.StyleCode ?? "",
      styleName: r.StyleName ?? "",
      customer: r.Customer ?? "",
      poQty: r.POQty ?? null,
      planCutQty: r.PlanCutQty ?? null,
      workOrderDate: r.WorkOrderDate
        ? new Date(r.WorkOrderDate).toISOString().split("T")[0]
        : null,
    }));

    return NextResponse.json({ rows });
  } catch (err) {
    console.error("[/api/styles-and-workorders] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch styles and work orders" },
      { status: 500 }
    );
  }
}
