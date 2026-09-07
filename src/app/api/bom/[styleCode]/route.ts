import { getIndusPool } from "@/lib/db";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Maps indus-plus GroupCode → Cost Sheet accessory category.
 * Keeps exact match where possible; groups close relatives together.
 */
const TRIM_CATEGORY_MAP: Record<string, string> = {
  T27: "Zipper",
  T26: "Thread",
  T15: "Label",
  T29: "Label",        // Care Label → Label
  T12: "Tag",
  T24: "Tag",          // Tags → Tag
  T06: "Carton",
  T35: "Carton",       // Card Board → Carton
  T28: "Carton",       // Carton Sheet → Carton
  T05: "Carton",       // Carton Tape → Carton
  T19: "Poly Bag",
  T03: "Button & Rivets",
  T21: "Button & Rivets", // Rivet → Button & Rivets
  T02: "Button & Rivets", // Buckle → Button & Rivets
  T01: "Sticker",
  T04: "Sticker",      // Carton Stickers → Sticker
  T11: "Trims Mix Materials", // Fusing
  T09: "Trims Mix Materials", // Elastic
  T07: "Trims Mix Materials", // Drawcord
  T10: "Trims Mix Materials", // Eyelet
  T14: "Trims Mix Materials", // Heat
  T16: "Trims Mix Materials", // Leather Patch
  T17: "Trims Mix Materials", // Metal Tip
  T18: "Trims Mix Materials", // Plastic Ring
  T23: "Packing Mix Materials", // Silica Gel
  T30: "Packing Mix Materials", // Tissue
  T25: "Trims Mix Materials", // Tape
  T31: "Trims Mix Materials", // Metal Plate
  T36: "Trims Mix Materials", // Plastic Strap
  T37: "Trims Mix Materials", // Screen Printing
};

export interface BOMRow {
  groupCode: string;
  groupName: string;
  itemCode: string;
  itemName: string;
  consumption: number;
  uom: string;
  ratePKR: number;
  totalSAM: number | null;
}

export interface IndusBOMData {
  fabric: BOMRow[];
  lining: BOMRow[];
  accessories: (BOMRow & { category: string })[];
  smvSewing: number | null; // from TotalSAM if present
}

/**
 * GET /api/bom/[styleCode]
 * Fetches BOM data from S_StyleCardBOMConsumptionSAMView for the given style code.
 * Returns fabric, lining, accessories arrays and TotalSAM.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ styleCode: string }> }
) {
  const { styleCode } = await params;

  if (!styleCode || styleCode === "custom") {
    return NextResponse.json({ fabric: [], lining: [], accessories: [], smvSewing: null });
  }

  try {
    const pool = await getIndusPool();
    const result = await pool
      .request()
      .input("styleCode", styleCode)
      .query<{
        AccessCode: string;
        GroupCode: string;
        GroupName: string;
        ItemCode: string;
        ItemName: string;
        Consumption: string;
        UOM: string;
        LastPurchasedPrice: string;
        TotalSAM: string;
      }>(
        `SELECT AccessCode, GroupCode, GroupName, ItemCode, ItemName,
                Consumption, UOM, LastPurchasedPrice, TotalSAM
         FROM   S_StyleCardBOMConsumptionSAMView
         WHERE  StyleCode = @styleCode
           AND  AccessCode IN ('FABRIC', 'TRIM')
         ORDER  BY AccessCode, GroupCode, ItemName`
      );

    const fabric: BOMRow[] = [];
    const lining: BOMRow[] = [];
    const accessories: (BOMRow & { category: string })[] = [];
    let smvSewing: number | null = null;

    for (const row of result.recordset) {
      const consumption = parseFloat(row.Consumption) || 0;
      const ratePKR =
        row.LastPurchasedPrice && row.LastPurchasedPrice !== "NULL"
          ? parseFloat(row.LastPurchasedPrice) || 0
          : 0;
      const totalSAM =
        row.TotalSAM && row.TotalSAM !== "NULL"
          ? parseFloat(row.TotalSAM) || null
          : null;

      // Capture the first non-null TotalSAM
      if (totalSAM !== null && smvSewing === null) {
        smvSewing = totalSAM;
      }

      const bomRow: BOMRow = {
        groupCode: row.GroupCode ?? "",
        groupName: row.GroupName ?? "",
        itemCode: row.ItemCode ?? "",
        itemName: row.ItemName ?? "",
        consumption,
        uom: row.UOM ?? "",
        ratePKR,
        totalSAM,
      };

      if (row.AccessCode === "FABRIC") {
        // Pocket Lining group → lining section
        if (row.GroupCode === "FPL") {
          lining.push(bomRow);
        } else {
          fabric.push(bomRow);
        }
      } else if (row.AccessCode === "TRIM") {
        const category =
          TRIM_CATEGORY_MAP[row.GroupCode] ?? row.GroupName ?? "Trims Mix Materials";
        accessories.push({ ...bomRow, category });
      }
    }

    const data: IndusBOMData = { fabric, lining, accessories, smvSewing };
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/bom] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch BOM data" },
      { status: 500 }
    );
  }
}
