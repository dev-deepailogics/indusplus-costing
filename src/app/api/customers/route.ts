import { getIndusPool } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/customers
 * Returns a sorted, deduplicated list of customer names from
 * S_StyleCardBOMConsumptionSAMView in the indus-plus database.
 */
export async function GET() {
  try {
    const pool = await getIndusPool();
    const result = await pool
      .request()
      .query<{ Customer: string }>(
        `SELECT DISTINCT LTRIM(RTRIM(Customer)) AS Customer
         FROM (
           SELECT Customer FROM S_StyleAndWorkOrdersView WHERE Customer IS NOT NULL AND Customer <> '' AND Customer <> 'NULL'
           UNION ALL
           SELECT Customer FROM S_StyleCardBOMConsumptionSAMView WHERE Customer IS NOT NULL AND Customer <> '' AND Customer <> 'NULL'
         ) t
         ORDER BY Customer`
      );

    const customers = Array.from(
      new Set(result.recordset.map((r) => r.Customer?.trim()).filter(Boolean))
    );
    return NextResponse.json({ customers });
  } catch (err) {
    console.error("[/api/customers] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch customers" },
      { status: 500 }
    );
  }
}
