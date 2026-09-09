import { getIndusPool } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * Maps indus-plus GroupCode → Cost Sheet accessory category.
 */
const TRIM_CATEGORY_MAP: Record<string, string> = {
  T27: "Zipper",
  T26: "Thread",
  T15: "Label",
  T29: "Label",
  T12: "Tag",
  T24: "Tag",
  T06: "Carton",
  T35: "Carton",
  T28: "Carton",
  T05: "Carton",
  T19: "Poly Bag",
  T03: "Button & Rivets",
  T21: "Button & Rivets",
  T02: "Button & Rivets",
  T01: "Sticker",
  T04: "Sticker",
  T11: "Trims Mix Materials",
  T09: "Trims Mix Materials",
  T07: "Trims Mix Materials",
  T10: "Trims Mix Materials",
  T14: "Trims Mix Materials",
  T16: "Trims Mix Materials",
  T17: "Trims Mix Materials",
  T18: "Trims Mix Materials",
  T23: "Packing Mix Materials",
  T30: "Packing Mix Materials",
  T25: "Trims Mix Materials",
  T31: "Trims Mix Materials",
  T36: "Trims Mix Materials",
  T37: "Trims Mix Materials",
};

export interface CatalogItemDB {
  itemName: string;
  itemCode?: string;
  groupCode?: string;
  groupName?: string;
  category?: string;
  uom?: string;
  ratePKR?: number;
}

/**
 * GET /api/bom/catalog-items
 * Returns unique items from MSSQL S_StyleCardBOMConsumptionSAMView categorized as:
 * - fabrics
 * - linings
 * - trims / accessories
 * - chemicals
 * - specialCharges
 */
export async function GET() {
  try {
    const pool = await getIndusPool();
    const result = await pool.request().query<{
      AccessCode: string | null;
      GroupCode: string | null;
      GroupName: string | null;
      ItemCode: string | null;
      ItemName: string | null;
      UOM: string | null;
      LastPurchasedPrice: string | null;
    }>(
      `SELECT DISTINCT AccessCode, GroupCode, GroupName, ItemCode, ItemName, UOM, LastPurchasedPrice
       FROM   S_StyleCardBOMConsumptionSAMView
       WHERE  ItemName IS NOT NULL AND ItemName <> '' AND ItemName <> 'NULL'
       ORDER  BY AccessCode, GroupCode, ItemName`
    );

    const fabricsMap = new Map<string, CatalogItemDB>();
    const liningsMap = new Map<string, CatalogItemDB>();
    const trimsMap = new Map<string, CatalogItemDB>();
    const chemicalsMap = new Map<string, CatalogItemDB>();
    const specialChargesMap = new Map<string, CatalogItemDB>();

    for (const r of result.recordset) {
      const accessCode = (r.AccessCode || "").toUpperCase().trim();
      const groupCode = (r.GroupCode || "").toUpperCase().trim();
      const groupName = (r.GroupName || "").trim();
      const itemName = (r.ItemName || "").trim();
      const itemCode = (r.ItemCode || "").trim();
      const uom = (r.UOM || "").trim();
      const ratePKR =
        r.LastPurchasedPrice && r.LastPurchasedPrice !== "NULL"
          ? parseFloat(r.LastPurchasedPrice) || 0
          : 0;

      if (!itemName) continue;

      const itemObj: CatalogItemDB = {
        itemName,
        itemCode,
        groupCode,
        groupName,
        uom,
        ratePKR,
      };

      if (accessCode === "FABRIC") {
        if (groupCode === "FPL" || groupName.toLowerCase().includes("lining") || itemName.toLowerCase().includes("lining")) {
          if (!liningsMap.has(itemName)) {
            liningsMap.set(itemName, itemObj);
          }
        } else {
          if (!fabricsMap.has(itemName)) {
            fabricsMap.set(itemName, itemObj);
          }
        }
      } else if (accessCode === "TRIM") {
        const cat = TRIM_CATEGORY_MAP[groupCode] ?? groupName ?? "Trims Mix Materials";
        itemObj.category = cat;
        const key = `${cat}|||${itemName}`;
        if (!trimsMap.has(key)) {
          trimsMap.set(key, itemObj);
        }
      } else if (
        accessCode.includes("CHEM") ||
        groupName.toLowerCase().includes("chem") ||
        groupCode.includes("CHEM")
      ) {
        if (!chemicalsMap.has(itemName)) {
          chemicalsMap.set(itemName, itemObj);
        }
      } else if (
        accessCode.includes("SPECIAL") ||
        groupName.toLowerCase().includes("special") ||
        groupName.toLowerCase().includes("charge")
      ) {
        if (!specialChargesMap.has(itemName)) {
          specialChargesMap.set(itemName, itemObj);
        }
      } else {
        // Fallback for any other items: treat as trims / general items
        const cat = TRIM_CATEGORY_MAP[groupCode] ?? groupName ?? "General";
        itemObj.category = cat;
        const key = `${cat}|||${itemName}`;
        if (!trimsMap.has(key)) {
          trimsMap.set(key, itemObj);
        }
      }
    }

    const defaultChemicals: CatalogItemDB[] = [
      { itemName: "Enzyme Wash", groupName: "Washing Chemicals", ratePKR: 12 },
      { itemName: "Bleach Wash", groupName: "Washing Chemicals", ratePKR: 8 },
      { itemName: "Silicon Softener", groupName: "Washing Chemicals", ratePKR: 15 },
      { itemName: "Tinting Chemical", groupName: "Washing Chemicals", ratePKR: 20 },
      { itemName: "Resin Spray", groupName: "Washing Chemicals", ratePKR: 25 },
      { itemName: "PP Spray (Potassium Permanganate)", groupName: "Washing Chemicals", ratePKR: 18 },
      { itemName: "Neutralizer", groupName: "Washing Chemicals", ratePKR: 6 },
      { itemName: "Optical Brightener", groupName: "Washing Chemicals", ratePKR: 10 },
    ];

    const defaultCharges: CatalogItemDB[] = [
      { itemName: "Embroidery", groupName: "Special Operations", ratePKR: 35 },
      { itemName: "Printing", groupName: "Special Operations", ratePKR: 25 },
      { itemName: "Heat Transfer", groupName: "Special Operations", ratePKR: 15 },
      { itemName: "Testing Charges", groupName: "Lab / QA", ratePKR: 10 },
      { itemName: "Special Packaging", groupName: "Packaging", ratePKR: 12 },
      { itemName: "Tagging & Barcoding", groupName: "Finishing", ratePKR: 5 },
    ];

    return NextResponse.json({
      fabrics: Array.from(fabricsMap.values()),
      linings: Array.from(liningsMap.values()),
      trims: Array.from(trimsMap.values()),
      chemicals: chemicalsMap.size > 0 ? Array.from(chemicalsMap.values()) : defaultChemicals,
      specialCharges: specialChargesMap.size > 0 ? Array.from(specialChargesMap.values()) : defaultCharges,
      allRawItemsCount: result.recordset.length,
    });
  } catch (err) {
    console.error("[/api/bom/catalog-items] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch catalog items from MSSQL DB" },
      { status: 500 }
    );
  }
}
