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

    // Also query S_OperationsCatalog for Washing (chemicals/treatments) and Finishing/Special Operations
    try {
      const opsResult = await pool.request().query<{
        Department: string | null;
        Section: string | null;
        OperationCode: string | null;
        OperationName: string | null;
        PcRate: number | null;
      }>(
        `SELECT DISTINCT Department, Section, OperationCode, OperationName, PcRate
         FROM   S_OperationsCatalog
         WHERE  OperationName IS NOT NULL AND OperationName <> ''
         ORDER  BY Department, OperationName`
      );

      for (const op of opsResult.recordset) {
        const dept = (op.Department || "").trim();
        const section = (op.Section || "").trim();
        const opName = (op.OperationName || "").trim();
        const opCode = (op.OperationCode || "").trim();
        const ratePKR = op.PcRate && !isNaN(Number(op.PcRate)) ? Number(op.PcRate) : 0;

        if (!opName) continue;

        const itemObj: CatalogItemDB = {
          itemName: opName,
          itemCode: opCode,
          groupName: section || dept,
          category: dept,
          ratePKR,
        };

        if (dept.toLowerCase() === "washing" || dept.toLowerCase().includes("chem")) {
          if (!chemicalsMap.has(opName)) {
            chemicalsMap.set(opName, itemObj);
          }
        } else if (dept.toLowerCase() === "finishing" || section.toLowerCase().includes("special")) {
          if (!specialChargesMap.has(opName)) {
            specialChargesMap.set(opName, itemObj);
          }
        }
      }
    } catch (opsErr) {
      console.warn("[/api/bom/catalog-items] Error fetching S_OperationsCatalog:", opsErr);
    }

    return NextResponse.json({
      fabrics: Array.from(fabricsMap.values()),
      linings: Array.from(liningsMap.values()),
      trims: Array.from(trimsMap.values()),
      chemicals: Array.from(chemicalsMap.values()),
      specialCharges: Array.from(specialChargesMap.values()),
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

