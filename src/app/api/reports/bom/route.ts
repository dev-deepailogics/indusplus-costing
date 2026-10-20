import { getPool } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export interface BOMUsageItem {
  id: string; // generated unique key
  costSheetId: string;
  costSheetNumber: string;
  referenceName: string;
  workOrderNo: string;
  customerName: string;
  styleCode: string;
  styleName: string;
  orderQuantity: number;
  costingDate: string | null;
  approvalStatus: string;
  bomType: "Fabric" | "Lining" | "Trims & Accessories" | "Chemicals & Washing" | "Special Charges";
  category: string;
  itemName: string;
  consumptionPerPc: number;
  rateUSD: number;
  ratePKR: number;
  unitCostPKR: number;
  totalBatchCostPKR: number;
  totalBatchCostUSD: number;
}

/**
 * GET /api/reports/bom
 * Comprehensive BOM Usage Report:
 * Extracts every material item across all 5 BOM categories:
 * - Fabric Details (bom_fabric)
 * - Pocket Lining Details (bom_lining)
 * - Trims & Accessories Details (bom_accessories)
 * - Chemicals & Washing Details (bom_chemicals)
 * - Special Charges (bom_special_charges)
 *
 * Mapped to:
 * - Work Order # (work_order_number)
 * - Cost Sheet # (cost_sheet_number)
 * - Reference / Description (reference_name)
 * - Style (style_id & style_name)
 * - Customer (customer_name)
 * - Prices (Rate USD, Rate PKR, Unit Cost PKR, Total Batch Cost USD & PKR)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const customer = searchParams.get("customer")?.trim() || "";
    const bomTypeFilter = searchParams.get("bomType")?.trim() || "";
    const styleFilter = searchParams.get("style")?.trim() || "";
    const workOrderFilter = searchParams.get("workOrder")?.trim() || "";

    const appPool = await getPool();

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
        costing_date,
        approval_status,
        bom_fabric,
        bom_lining,
        bom_accessories,
        bom_chemicals,
        bom_special_charges,
        inserted_at
      FROM pre_order_cost_sheets
      WHERE deleted_at IS NULL
    `;

    const reqObj = appPool.request();

    if (customer) {
      query += ` AND customer_name = @customer`;
      reqObj.input("customer", customer);
    }

    query += ` ORDER BY inserted_at DESC`;

    const res = await reqObj.query<{
      id: string;
      reference_name: string;
      cost_sheet_number: string;
      style_id: string;
      style_name: string;
      customer_name: string;
      work_order_number: string;
      order_quantity: number;
      order_fob: number;
      costing_date: string;
      approval_status: string;
      bom_fabric: string;
      bom_lining: string;
      bom_accessories: string;
      bom_chemicals: string;
      bom_special_charges: string;
      inserted_at: string;
    }>(query);

    const allBOMItems: BOMUsageItem[] = [];

    for (const sheet of res.recordset) {
      const orderQty = sheet.order_quantity || 0;
      const woNo = sheet.work_order_number && sheet.work_order_number.trim() !== ""
        ? sheet.work_order_number
        : sheet.cost_sheet_number || sheet.id;

      const baseInfo = {
        costSheetId: sheet.id,
        costSheetNumber: sheet.cost_sheet_number || sheet.id,
        referenceName: sheet.reference_name || "—",
        workOrderNo: woNo,
        customerName: sheet.customer_name || "Unassigned Customer",
        styleCode: sheet.style_id && sheet.style_id !== "custom" ? sheet.style_id : "Custom Style",
        styleName: sheet.style_name || sheet.reference_name || "—",
        orderQuantity: orderQty,
        costingDate: sheet.costing_date || (sheet.inserted_at ? new Date(sheet.inserted_at).toISOString().split("T")[0] : null),
        approvalStatus: sheet.approval_status || "draft",
      };

      // 1. Fabric
      try {
        if (sheet.bom_fabric) {
          const list = JSON.parse(sheet.bom_fabric);
          if (Array.isArray(list)) {
            list.forEach((item: any, idx: number) => {
              const name = item.itemName || item.description || "";
              if (!name && !item.fabricCostPKR && !item.ratePKR) return;
              const cons = Number(item.consumptionPerPc || item.consumption || item.consPerPc) || 0;
              const rateUSD = Number(item.rateUSD) || 0;
              const ratePKR = Number(item.ratePKR) || 0;
              const unitCost = Number(item.fabricCostPKR || item.lineCostPKR || item.totalCostPKR) || (cons * ratePKR);
              const batchPKR = unitCost * orderQty;
              const batchUSD = cons * rateUSD * orderQty;

              allBOMItems.push({
                ...baseInfo,
                id: `${sheet.id}-fab-${idx}`,
                bomType: "Fabric",
                category: "Fabric",
                itemName: name || "Fabric Item",
                consumptionPerPc: Number(cons.toFixed(4)),
                rateUSD: Number(rateUSD.toFixed(3)),
                ratePKR: Number(ratePKR.toFixed(2)),
                unitCostPKR: Number(unitCost.toFixed(2)),
                totalBatchCostPKR: Number(batchPKR.toFixed(2)),
                totalBatchCostUSD: Number(batchUSD.toFixed(2)),
              });
            });
          }
        }
      } catch (_) {}

      // 2. Lining
      try {
        if (sheet.bom_lining) {
          const list = JSON.parse(sheet.bom_lining);
          if (Array.isArray(list)) {
            list.forEach((item: any, idx: number) => {
              const name = item.itemName || item.description || "";
              if (!name && !item.liningCostPKR && !item.ratePKR) return;
              const cons = Number(item.consumptionPerPc || item.consumption || item.consPerPc) || 0;
              const rateUSD = Number(item.rateUSD) || 0;
              const ratePKR = Number(item.ratePKR) || 0;
              const unitCost = Number(item.liningCostPKR || item.lineCostPKR || item.totalCostPKR) || (cons * ratePKR);
              const batchPKR = unitCost * orderQty;
              const batchUSD = cons * rateUSD * orderQty;

              allBOMItems.push({
                ...baseInfo,
                id: `${sheet.id}-lin-${idx}`,
                bomType: "Lining",
                category: "Pocket Lining",
                itemName: name || "Lining Item",
                consumptionPerPc: Number(cons.toFixed(4)),
                rateUSD: Number(rateUSD.toFixed(3)),
                ratePKR: Number(ratePKR.toFixed(2)),
                unitCostPKR: Number(unitCost.toFixed(2)),
                totalBatchCostPKR: Number(batchPKR.toFixed(2)),
                totalBatchCostUSD: Number(batchUSD.toFixed(2)),
              });
            });
          }
        }
      } catch (_) {}

      // 3. Trims & Accessories
      try {
        if (sheet.bom_accessories) {
          const list = JSON.parse(sheet.bom_accessories);
          if (Array.isArray(list)) {
            list.forEach((item: any, idx: number) => {
              const name = item.itemName || item.description || "";
              const cat = item.category || "Accessories";
              if (!name && !item.totalCostPKR && !item.ratePKR) return;
              const cons = Number(item.consPerPc || item.consumptionPerPc || item.consumption) || 0;
              const rateUSD = Number(item.rateUSD) || 0;
              const ratePKR = Number(item.ratePKR) || 0;
              const unitCost = Number(item.totalCostPKR || item.lineCostPKR) || (cons * ratePKR);
              const batchPKR = unitCost * orderQty;
              const batchUSD = cons * rateUSD * orderQty;

              allBOMItems.push({
                ...baseInfo,
                id: `${sheet.id}-acc-${idx}`,
                bomType: "Trims & Accessories",
                category: cat,
                itemName: name || `${cat} Item`,
                consumptionPerPc: Number(cons.toFixed(4)),
                rateUSD: Number(rateUSD.toFixed(3)),
                ratePKR: Number(ratePKR.toFixed(2)),
                unitCostPKR: Number(unitCost.toFixed(2)),
                totalBatchCostPKR: Number(batchPKR.toFixed(2)),
                totalBatchCostUSD: Number(batchUSD.toFixed(2)),
              });
            });
          }
        }
      } catch (_) {}

      // 4. Chemicals & Washing
      try {
        if (sheet.bom_chemicals) {
          const list = JSON.parse(sheet.bom_chemicals);
          if (Array.isArray(list)) {
            list.forEach((item: any, idx: number) => {
              const name = item.washItem || item.itemName || item.description || "";
              if (!name && !item.totalCostPKR && !item.ratePKR) return;
              const cons = Number(item.consPerPc || item.consumptionPerPc || item.consumption) || 1;
              const rateUSD = Number(item.rateUSD) || 0;
              const ratePKR = Number(item.ratePKR) || 0;
              const unitCost = Number(item.totalCostPKR || item.lineCostPKR) || (cons * ratePKR);
              const batchPKR = unitCost * orderQty;
              const batchUSD = cons * rateUSD * orderQty;

              allBOMItems.push({
                ...baseInfo,
                id: `${sheet.id}-chem-${idx}`,
                bomType: "Chemicals & Washing",
                category: "Washing & Chemicals",
                itemName: name || "Wash Recipe",
                consumptionPerPc: Number(cons.toFixed(4)),
                rateUSD: Number(rateUSD.toFixed(3)),
                ratePKR: Number(ratePKR.toFixed(2)),
                unitCostPKR: Number(unitCost.toFixed(2)),
                totalBatchCostPKR: Number(batchPKR.toFixed(2)),
                totalBatchCostUSD: Number(batchUSD.toFixed(2)),
              });
            });
          }
        }
      } catch (_) {}

      // 5. Special Charges
      try {
        if (sheet.bom_special_charges) {
          const list = JSON.parse(sheet.bom_special_charges);
          if (Array.isArray(list)) {
            list.forEach((item: any, idx: number) => {
              const name = item.itemName || item.description || "";
              if (!name && !item.totalCostPKR && !item.ratePKR) return;
              const cons = Number(item.consPerPc || item.consumptionPerPc || item.consumption) || 1;
              const rateUSD = Number(item.rateUSD) || 0;
              const ratePKR = Number(item.ratePKR) || 0;
              const unitCost = Number(item.totalCostPKR || item.lineCostPKR) || (cons * ratePKR);
              const batchPKR = unitCost * orderQty;
              const batchUSD = cons * rateUSD * orderQty;

              allBOMItems.push({
                ...baseInfo,
                id: `${sheet.id}-spec-${idx}`,
                bomType: "Special Charges",
                category: "Special Operations",
                itemName: name || "Special Charge",
                consumptionPerPc: Number(cons.toFixed(4)),
                rateUSD: Number(rateUSD.toFixed(3)),
                ratePKR: Number(ratePKR.toFixed(2)),
                unitCostPKR: Number(unitCost.toFixed(2)),
                totalBatchCostPKR: Number(batchPKR.toFixed(2)),
                totalBatchCostUSD: Number(batchUSD.toFixed(2)),
              });
            });
          }
        }
      } catch (_) {}
    }

    let rows = allBOMItems;

    if (bomTypeFilter) {
      rows = rows.filter((r) => r.bomType.toLowerCase() === bomTypeFilter.toLowerCase());
    }

    if (styleFilter) {
      rows = rows.filter(
        (r) =>
          r.styleCode.toLowerCase().includes(styleFilter.toLowerCase()) ||
          r.styleName.toLowerCase().includes(styleFilter.toLowerCase())
      );
    }

    if (workOrderFilter) {
      rows = rows.filter((r) => r.workOrderNo.toLowerCase().includes(workOrderFilter.toLowerCase()));
    }

    if (search) {
      rows = rows.filter(
        (r) =>
          r.itemName.toLowerCase().includes(search) ||
          r.category.toLowerCase().includes(search) ||
          r.customerName.toLowerCase().includes(search) ||
          r.styleName.toLowerCase().includes(search) ||
          r.styleCode.toLowerCase().includes(search) ||
          r.workOrderNo.toLowerCase().includes(search) ||
          r.referenceName.toLowerCase().includes(search) ||
          r.costSheetNumber.toLowerCase().includes(search)
      );
    }

    // Aggregates
    const totalBOMRows = rows.length;
    const fabricCount = rows.filter((r) => r.bomType === "Fabric").length;
    const liningCount = rows.filter((r) => r.bomType === "Lining").length;
    const trimsCount = rows.filter((r) => r.bomType === "Trims & Accessories").length;
    const chemicalsCount = rows.filter((r) => r.bomType === "Chemicals & Washing").length;
    const specialCount = rows.filter((r) => r.bomType === "Special Charges").length;
    const totalMaterialsUSD = Number(rows.reduce((acc, r) => acc + r.totalBatchCostUSD, 0).toFixed(2));
    const totalMaterialsPKR = Number(rows.reduce((acc, r) => acc + r.totalBatchCostPKR, 0).toFixed(2));

    return NextResponse.json({
      summary: {
        totalBOMRows,
        fabricCount,
        liningCount,
        trimsCount,
        chemicalsCount,
        specialCount,
        totalMaterialsUSD,
        totalMaterialsPKR,
      },
      rows,
      totalCount: rows.length,
    });
  } catch (err: any) {
    console.error("[/api/reports/bom] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch BOM usage report" },
      { status: 500 }
    );
  }
}
