import { getPool, getIndusPool } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
 * Returns items from MSSQL S_FabricTrimMasterView categorized as:
 * - fabrics
 * - linings
 * - trims / accessories
 * And operation catalogs (chemicals, specialCharges).
 */
export async function GET() {
  try {
    const pool = await getPool();
    let result;
    try {
      result = await pool.request().query<{
        AccessCode: string | null;
        GroupCode: string | null;
        GroupName: string | null;
        InventoryCode: string | null;
        InventoryName: string | null;
      }>(
        `SELECT 
           [FABRIC] AS AccessCode, 
           [FLD] AS GroupCode, 
           [Local_Denim] AS GroupName, 
           [InventoryCode], 
           [InventoryName]
         FROM   [dbo].[S_FabricTrimMasterView]
         WHERE  ([InventoryName] IS NOT NULL AND [InventoryName] <> '')
            OR  ([InventoryCode] IS NOT NULL AND [InventoryCode] <> '')
         ORDER  BY [FABRIC], [Local_Denim], [InventoryName]`
      );
    } catch {
      // Fallback if table uses alternative column naming or is on indus pool
      const indusPool = await getIndusPool();
      result = await indusPool.request().query<{
        AccessCode: string | null;
        GroupCode: string | null;
        GroupName: string | null;
        InventoryCode: string | null;
        InventoryName: string | null;
      }>(
        `SELECT [AccessCode], [GroupCode], [GroupName], [InventoryCode], [InventoryName]
         FROM   [dbo].[S_FabricTrimMasterView]
         WHERE  ([InventoryName] IS NOT NULL AND [InventoryName] <> '')
            OR  ([InventoryCode] IS NOT NULL AND [InventoryCode] <> '')
         ORDER  BY [AccessCode], [GroupName], [InventoryName]`
      );
    }

    const fabricsMap = new Map<string, CatalogItemDB>();
    const liningsMap = new Map<string, CatalogItemDB>();
    const trimsMap = new Map<string, CatalogItemDB>();
    const chemicalsMap = new Map<string, CatalogItemDB>();
    const specialChargesMap = new Map<string, CatalogItemDB>();

    for (const r of result.recordset) {
      const type = (r.AccessCode || "").toUpperCase().trim();
      const groupCode = (r.GroupCode || "").trim();
      const groupName = (r.GroupName || "").trim();
      const itemCode = (r.InventoryCode || "").trim();
      let itemName = (r.InventoryName || "").trim() || itemCode;

      if (!itemName) continue;

      // Clean prepended category prefixes if present
      if (groupName && itemName.toLowerCase().startsWith(groupName.toLowerCase())) {
        const stripped = itemName.slice(groupName.length).trim();
        if (stripped) {
          itemName = stripped;
        }
      }

      const itemObj: CatalogItemDB = {
        itemName,
        itemCode,
        groupCode,
        groupName,
        category: groupName,
        ratePKR: 0,
      };

      if (type === "FABRIC") {
        if (
          groupCode.toUpperCase() === "FPL" ||
          groupName.toLowerCase().includes("lining") ||
          itemName.toLowerCase().includes("lining")
        ) {
          const key = `${itemName}|||${itemCode}`;
          if (!liningsMap.has(key)) {
            liningsMap.set(key, itemObj);
          }
        } else {
          const key = `${itemName}|||${itemCode}`;
          if (!fabricsMap.has(key)) {
            fabricsMap.set(key, itemObj);
          }
        }
      } else {
        // TRIM / Accessories
        itemObj.category = groupName || "Trim";
        const key = `${itemObj.category}|||${itemName}|||${itemCode}`;
        if (!trimsMap.has(key)) {
          trimsMap.set(key, itemObj);
        }
      }
    }

    // Also query S_OperationsCatalog for Washing (chemicals) and Finishing/Special Operations from indusPool if available
    try {
      const indusPool = await getIndusPool();
      const opsResult = await indusPool.request().query<{
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

