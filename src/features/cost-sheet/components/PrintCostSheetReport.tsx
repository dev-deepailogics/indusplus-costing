"use client";

import React from "react";
import type { StyleMasterItem } from "@/features/style-master/types";
import type { CalculationResult } from "../services/CostSheetFormulaEngine";

export interface PrintCostSheetReportProps {
  activeStyle: StyleMasterItem;
  workOrderNumber?: string;
  calcs: CalculationResult;
  costingDate: string;
  costingStage: string;
  country: string;
  customerName: string;
  orderType: string;
  styleCategory: string;
  washType: string;
  orderQuantity: number;
  noOfColors: number;
  exFactoryDate: string;
  paymentTerms: string;
  shipmentMode: string;
  deliveryTerms: string;
  merchGroup: string;
  deliveryDestination: string;
  paritySale?: number;
  parityProcurement?: number;
  inhouseOrSubcontract: string;
  manpower: number;
  commissionInput: string;
  taxEdsInput: string;
  inlandFreightInput: string;
  localBankChargesInput: string;
  discountRateInput: string;
  rebateInput: string;
  smvSewing: number;
}

function formatShortDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = d.toLocaleString("en-US", { month: "short" });
  const year = String(d.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

function formatLongDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtInt(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return "0";
  return Math.round(val).toLocaleString();
}

function fmtDec2(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return "0.00";
  return val.toFixed(2);
}

function fmtPct(val?: number, decimals = 1): string {
  if (val === undefined || val === null || isNaN(val)) return "0.0%";
  return (val * 100).toFixed(decimals) + "%";
}

export function PrintCostSheetReport({
  activeStyle,
  workOrderNumber,
  calcs,
  costingDate,
  costingStage,
  country,
  customerName,
  orderType,
  styleCategory,
  washType,
  orderQuantity,
  noOfColors,
  exFactoryDate,
  paymentTerms,
  shipmentMode,
  deliveryTerms,
  merchGroup,
  deliveryDestination,
  paritySale,
  parityProcurement,
  inhouseOrSubcontract,
  manpower,
  commissionInput,
  taxEdsInput,
  inlandFreightInput,
  localBankChargesInput,
  discountRateInput,
  smvSewing,
}: PrintCostSheetReportProps) {
  const perColorQty = Math.round(orderQuantity / (noOfColors || 1));
  const currentDate = new Date().toISOString().split("T")[0];

  // 1. Dynamic Fabric BOM: Only include actual entered fabrics
  const validFabrics = (activeStyle.bomFabric || []).filter(
    (item) =>
      (item.itemName && item.itemName.trim() !== "") ||
      (item.consumptionPerPc || 0) > 0 ||
      (item.fabricCostPKR || 0) > 0
  );

  const totalFabricCons = validFabrics.reduce(
    (acc, curr) => acc + (curr.consumptionPerPc || 0),
    0
  );
  const avgFabricRateUSD =
    totalFabricCons > 0
      ? calcs.fabricCostUSD / totalFabricCons
      : validFabrics[0]?.rateUSD || 0;
  const avgFabricRatePKR =
    totalFabricCons > 0
      ? calcs.fabricCostPKR / totalFabricCons
      : validFabrics[0]?.ratePKR || 0;

  // 2. Dynamic Lining BOM: Only include actual entered pocket linings
  const validLinings = (activeStyle.bomLining || []).filter(
    (item) =>
      (item.itemName && item.itemName.trim() !== "") ||
      (item.consumptionPerPc || 0) > 0 ||
      (item.liningCostPKR || 0) > 0
  );

  const totalLiningCons = validLinings.reduce(
    (acc, curr) => acc + (curr.consumptionPerPc || 0),
    0
  );
  const avgLiningRateUSD =
    totalLiningCons > 0
      ? calcs.liningCostUSD / totalLiningCons
      : validLinings[0]?.rateUSD || 0;
  const avgLiningRatePKR =
    totalLiningCons > 0
      ? calcs.liningCostPKR / totalLiningCons
      : validLinings[0]?.ratePKR || 0;

  // 3. Dynamic Accessories BOM: Only include actual entered accessories
  const validAccessories = (activeStyle.bomAccessories || []).filter(
    (item) =>
      (item.itemName && item.itemName.trim() !== "") ||
      (item.category && item.category.trim() !== "") ||
      (item.totalCostPKR || 0) > 0 ||
      (item.consPerPc || 0) > 0
  );

  // 4. Dynamic Special Charges BOM: Only include actual entered special charges
  const validSpecialCharges = (activeStyle.bomSpecialCharges || []).filter(
    (item) =>
      (item.itemName && item.itemName.trim() !== "") ||
      (item.totalCostPKR || 0) > 0 ||
      (item.ratePKR || 0) > 0
  );

  // 5. Dynamic Chemicals BOM
  const validChemicals = (activeStyle.bomChemicals || []).filter(
    (item) =>
      (item.washItem && item.washItem.trim() !== "") ||
      (item.totalCostPKR || 0) > 0 ||
      (item.consPerPc || 0) > 0
  );

  return (
    <div className="w-full bg-white text-black font-sans text-[10px] leading-[1.15] select-text p-1 border-2 border-black box-border print-page-container">
      {/* ─── 1. HEADER TITLE ─── */}
      <div className="text-center py-0.5 border-b-2 border-black">
        <h1 className="text-[23px] font-black tracking-wide text-[#1e40af] m-0 leading-tight">
          Indus Plus (Pvt) Ltd.
        </h1>
        <h2 className="text-[17px] font-extrabold text-[#2563eb] m-0 leading-tight">
          Pre Order Cost Sheet
        </h2>
      </div>

      {/* ─── 2. TOP GRID (3 COLUMNS) ─── */}
      <div className="grid grid-cols-12 border-b-2 border-black">
        {/* COLUMN 1: Style & Qty Specs */}
        <div className="col-span-3 border-r border-black p-1 text-[9.5px]">
          <div className="grid grid-cols-12 gap-y-[2px] items-center">
            <span className="col-span-6 font-semibold">Costing Date(mm/dd/yy)</span>
            <span className="col-span-6 bg-[#d1d5db] font-bold text-center py-[1px] px-1">
              {formatShortDate(costingDate)}
            </span>

            <span className="col-span-6 font-semibold">Customer Name:</span>
            <span className="col-span-6 font-bold truncate">{customerName || ""}</span>

            <span className="col-span-6 font-semibold">Order Type</span>
            <span className="col-span-6 font-bold">{orderType || ""}</span>

            <span className="col-span-6 font-semibold">Style</span>
            <span className="col-span-6 font-bold truncate">
              {activeStyle.id !== "custom"
                ? `${activeStyle.id}${workOrderNumber ? ` (${workOrderNumber})` : ""}`
                : activeStyle.styleName
                ? `${activeStyle.styleName}${workOrderNumber ? ` (${workOrderNumber})` : ""}`
                : workOrderNumber || ""}
            </span>

            <span className="col-span-6 font-semibold">Style Category</span>
            <span className="col-span-6 font-bold">{styleCategory || ""}</span>

            <span className="col-span-6 font-semibold">Order Size</span>
            <span className="col-span-6 font-bold">{calcs.sizeBracket || ""}</span>

            <span className="col-span-6 font-semibold">Order Quantity pcs</span>
            <span className="col-span-6 bg-[#d1d5db] font-bold text-center py-[1px] px-1">
              {orderQuantity ? orderQuantity.toLocaleString() : ""}
            </span>

            <span className="col-span-6 font-semibold">Per Color Quantity pcs</span>
            <span className="col-span-6 bg-[#d1d5db] font-bold text-center py-[1px] px-1">
              {orderQuantity ? perColorQty.toLocaleString() : ""}
            </span>

            <span className="col-span-6 font-semibold">No of Color</span>
            <span className="col-span-6 bg-[#fde047] font-bold text-center py-[1px] px-1">
              {noOfColors || ""}
            </span>

            <span className="col-span-6 font-semibold">Wash Type :</span>
            <span className="col-span-6 font-bold">{washType || ""}</span>

            <span className="col-span-6 font-semibold">Rejection %</span>
            <span className="col-span-6 bg-[#fde047] text-[#dc2626] font-bold text-center py-[1px] px-1">
              {fmtPct(calcs.rejectionPct, 3)}
            </span>

            <span className="col-span-6 font-semibold">Ex fty Date(mm/dd/yy)</span>
            <span className="col-span-6 bg-[#d1d5db] font-bold text-center py-[1px] px-1">
              {formatShortDate(exFactoryDate)}
            </span>
          </div>
        </div>

        {/* COLUMN 2: Logistics & Commercial */}
        <div className="col-span-3 border-r border-black p-1 text-[9.5px]">
          <div className="grid grid-cols-12 gap-y-[2px] items-center">
            <span className="col-span-6 font-semibold">Current Date</span>
            <span className="col-span-6 font-bold">{formatLongDate(currentDate)}</span>

            <span className="col-span-6 font-semibold">Costing Stage</span>
            <span className="col-span-6 font-bold">{costingStage || ""}</span>

            <span className="col-span-6 font-semibold">Country</span>
            <span className="col-span-6 font-bold uppercase">{country || ""}</span>

            <span className="col-span-6 font-semibold">Payment Terms</span>
            <span className="col-span-6 font-bold truncate">{paymentTerms || ""}</span>

            <span className="col-span-6 font-semibold">Shipment mode</span>
            <span className="col-span-6 font-bold">{shipmentMode || ""}</span>

            <span className="col-span-6 font-semibold">Delivery terms</span>
            <span className="col-span-6 font-bold">{deliveryTerms || ""}</span>

            <span className="col-span-6 font-semibold">Merch_Group</span>
            <span className="col-span-6 font-bold">{merchGroup || ""}</span>

            <span className="col-span-6 font-semibold">Delv. Distination</span>
            <span className="col-span-6 font-bold">{deliveryDestination || ""}</span>

            <span className="col-span-6 font-semibold">Parity-Sale</span>
            <span className="col-span-6 font-bold">{paritySale || ""}</span>

            <span className="col-span-6 font-semibold">Parity-Procurement</span>
            <span className="col-span-6 font-bold">{parityProcurement || ""}</span>

            <span className="col-span-6 font-semibold">Inhouse/Sub-contract</span>
            <span className="col-span-6 font-black uppercase">
              {inhouseOrSubcontract ? inhouseOrSubcontract.toUpperCase() : ""}
            </span>
          </div>
        </div>

        {/* COLUMN 3: FOB / CM / Profitability & IE */}
        <div className="col-span-6 grid grid-cols-2 text-[9.5px]">
          {/* Sub-col 3A (Left) */}
          <div className="border-r border-black p-1 flex flex-col justify-between">
            <div className="grid grid-cols-12 gap-y-[2px] items-center">
              <span className="col-span-7 font-semibold">Target FOB/PC</span>
              <span className="col-span-2 text-right pr-1">US$</span>
              <span className="col-span-3 font-bold text-right">{fmtDec2(calcs.targetFobUSD)}</span>

              <span className="col-span-7 font-semibold">Order FOB/PC</span>
              <span className="col-span-2 text-right pr-1">US$</span>
              <span className="col-span-3 bg-[#d1d5db] font-bold text-right px-1 py-[1px]">
                {fmtDec2(calcs.sellingPriceUSD)}
              </span>

              <span className="col-span-7 font-semibold">Order CM/PC</span>
              <span className="col-span-2 text-right pr-1">US$</span>
              <span className="col-span-3 font-bold text-right">{fmtDec2(calcs.cmUSD)}</span>

              <span className="col-span-9 font-semibold">Target CM/SMV-Cents</span>
              <span className="col-span-3 font-bold text-right">{fmtDec2(calcs.targetCmSmvCents)}</span>

              <span className="col-span-9 font-semibold">Order CM-SMV-Cents</span>
              <span className="col-span-3 font-bold text-right">{fmtDec2(calcs.orderCmSmvCents)}</span>
            </div>

            <div className="border-t border-black pt-1 mt-1 grid grid-cols-12 gap-y-[2px] items-center">
              <span className="col-span-8 font-semibold">SMV</span>
              <span className="col-span-4 bg-[#d1d5db] font-bold text-center px-1 py-[1px]">
                {fmtDec2(smvSewing || activeStyle.smvSewing)}
              </span>

              <span className="col-span-9 font-semibold">Manpower Per Line</span>
              <span className="col-span-3 font-bold text-right">{manpower}</span>

              <span className="col-span-9 font-semibold">Avg. Efficiency</span>
              <span className="col-span-3 font-bold text-right">{fmtPct(calcs.efficiency, 0)}</span>

              <span className="col-span-9 font-semibold">Avg. Line Target</span>
              <span className="col-span-3 font-bold text-right">{Math.round(calcs.lineTarget)}</span>
            </div>
          </div>

          {/* Sub-col 3B (Right) */}
          <div className="p-1 flex flex-col justify-between">
            <div className="grid grid-cols-12 gap-y-[2px] items-center">
              <span className="col-span-9 font-semibold">EBITDA/Min-Cents</span>
              <span className="col-span-3 font-bold text-right">{fmtDec2(calcs.ebitdaMinCents)}</span>

              <span className="col-span-6 font-semibold">EBITDA/PC</span>
              <span className="col-span-3 text-right pr-1">US$</span>
              <span className="col-span-3 font-bold text-right">{fmtDec2(calcs.ebitdaUSD)}</span>

              <span className="col-span-9 font-semibold">Net Profit/Min-Cents</span>
              <span className="col-span-3 font-bold text-right">{fmtDec2(calcs.netProfitMinCents)}</span>

              <span className="col-span-6 font-semibold">Net Profit/PC</span>
              <span className="col-span-3 text-right pr-1">US$</span>
              <span className="col-span-3 font-bold text-right">{fmtDec2(calcs.netProfitUSD)}</span>

              <span className="col-span-9 font-semibold">Net Profit % on FOB</span>
              <span className="col-span-3 font-bold text-right">{fmtPct(calcs.netProfitPct, 0)}</span>
            </div>

            <div className="border-t border-black pt-1 mt-1 grid grid-cols-12 gap-y-[2px] items-center">
              <span className="col-span-9 font-semibold">Commission %</span>
              <span className="col-span-3 font-bold text-right">
                {(parseFloat(commissionInput) || 0).toFixed(2)}%
              </span>

              <span className="col-span-9 font-semibold">Tax &amp; EDS</span>
              <span className="col-span-3 font-bold text-right">
                {(parseFloat(taxEdsInput) || 0).toFixed(2)}%
              </span>

              <span className="col-span-9 font-semibold">Inland Freight &amp; Clearing</span>
              <span className="col-span-3 font-bold text-right">
                {(parseFloat(inlandFreightInput) || 0).toFixed(2)}%
              </span>

              <span className="col-span-9 font-semibold">Local Bank Charges</span>
              <span className="col-span-3 font-bold text-right">
                {(parseFloat(localBankChargesInput) || 0).toFixed(2)}%
              </span>

              <span className="col-span-8 font-semibold">Discount Rate</span>
              <span className="col-span-4 bg-[#fde047] font-bold text-center px-1 py-[1px]">
                {(parseFloat(discountRateInput) || 0).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 3. BOTTOM SECTION: 2-COLUMN SPLIT ─── */}
      <div className="grid grid-cols-12">
        {/* ─── LEFT COLUMN: COST & PROFITABILITY SUMMARY ─── */}
        <div className="col-span-6 border-r-2 border-black pr-1">
          <table className="w-full border-collapse text-[9.5px]">
            <thead>
              <tr className="border-b border-black font-bold">
                <th className="text-left py-0.5" />
                <th className="text-right w-14 py-0.5">Rs</th>
                <th className="text-right w-12 py-0.5">$</th>
                <th className="text-right w-14 py-0.5 text-[#2563eb]">%</th>
              </tr>
            </thead>
            <tbody>
              {/* SELLING PRICE SECTION */}
              <tr className="font-bold">
                <td className="py-[1px]">Selling Price</td>
                <td className="text-right">{fmtInt(calcs.sellingPricePKR)}</td>
                <td className="text-right">{fmtDec2(calcs.sellingPriceUSD)}</td>
                <td className="text-right" />
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Tax &amp; EDS</td>
                <td className="text-right">{fmtInt(calcs.taxEDS_PKR)}</td>
                <td className="text-right">{fmtDec2(calcs.taxEDS_USD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.taxEDS_Pct, 2)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Rebate (add)</td>
                <td className="text-right">{calcs.rebatePKR ? fmtInt(calcs.rebatePKR) : ""}</td>
                <td className="text-right">{fmtDec2(calcs.rebateUSD || 0)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.rebatePct || 0, 2)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Comm</td>
                <td className="text-right">{fmtInt(calcs.commissionPKR || 0)}</td>
                <td className="text-right">{fmtDec2(calcs.commissionUSD || 0)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.commissionPct || 0, 2)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Inland Freight &amp; Clearing</td>
                <td className="text-right">{fmtInt(calcs.freightPKR || 0)}</td>
                <td className="text-right">{fmtDec2(calcs.freightUSD || 0)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.freightPct || 0, 1)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Markup and Discounting</td>
                <td className="text-right">{fmtInt(calcs.markupDiscountPKR || 0)}</td>
                <td className="text-right">{fmtDec2(calcs.markupDiscountUSD || 0)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.markupDiscountPct || 0, 1)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Local Bank Charges</td>
                <td className="text-right">{fmtInt(calcs.bankChargesPKR || 0)}</td>
                <td className="text-right">{fmtDec2(calcs.bankChargesUSD || 0)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.bankChargesPct || 0, 1)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Factoring</td>
                <td className="text-right">{fmtInt(calcs.factoringPKR || 0)}</td>
                <td className="text-right">{fmtDec2(calcs.factoringUSD || 0)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.factoringPct || 0, 1)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Foreign B Ch &amp; Oth</td>
                <td className="text-right">{fmtInt(calcs.foreignBankChargesPKR || 0)}</td>
                <td className="text-right">{fmtDec2(calcs.foreignBankChargesUSD || 0)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.foreignBankChargesPct || 0, 1)}</td>
              </tr>
              <tr className="border-t border-black font-bold">
                <td className="py-[1px]">Net Price</td>
                <td className="text-right">{fmtInt(calcs.netPricePKR)}</td>
                <td className="text-right">{fmtDec2(calcs.netPriceUSD)}</td>
                <td className="text-right text-[#2563eb] font-bold">{fmtPct(calcs.netPricePct, 2)}</td>
              </tr>

              {/* MATERIAL COST SECTION */}
              <tr className="border-t-2 border-black font-bold">
                <td className="py-[1px]">Material Cost</td>
                <td className="text-right">Rs</td>
                <td className="text-right">$</td>
                <td className="text-right" />
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Fabric</td>
                <td className="text-right bg-[#d1d5db] font-semibold px-0.5">{fmtInt(calcs.fabricCostPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.fabricCostUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.fabricCostPct, 0)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Linning</td>
                <td className="text-right bg-[#d1d5db] font-semibold px-0.5">{fmtInt(calcs.liningCostPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.liningCostUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.liningCostPct, 0)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Accessories</td>
                <td className="text-right bg-[#d1d5db] font-semibold px-0.5">{fmtInt(calcs.accessoriesCostPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.accessoriesCostUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.accessoriesCostPct, 0)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Chemicals</td>
                <td className="text-right bg-[#d1d5db] font-semibold px-0.5">{fmtInt(calcs.chemicalsCostPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.chemicalsCostUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.chemicalsCostPct, 1)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Other Cost</td>
                <td className="text-right bg-[#d1d5db] font-semibold px-0.5">{fmtInt(calcs.specialChargesCostPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.specialChargesCostUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.specialChargesCostPct, 1)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">D Labor Cost</td>
                <td className="text-right">{fmtInt(calcs.directLaborCostPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.directLaborCostUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.directLaborCostPct, 2)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Utilities Cost</td>
                <td className="text-right">{fmtInt(calcs.utilitiesCostPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.utilitiesCostUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.utilitiesCostPct, 2)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Leftover Factor</td>
                <td className="text-right">{fmtInt(calcs.leftoverCostPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.leftoverCostUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.leftoverCostPct, 1)}</td>
              </tr>
              <tr className="border-t border-black font-bold">
                <td className="py-[1px]">Total Variable Cost</td>
                <td className="text-right">{fmtInt(calcs.totalVariableCostPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.totalVariableCostUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.totalVariableCostPct, 0)}</td>
              </tr>

              {/* CM SECTION */}
              <tr className="border-t border-black font-bold">
                <td className="py-[1px] text-[#2563eb]">CM/Pc</td>
                <td className="text-right text-[#2563eb]">{fmtInt(calcs.cmPKR)}</td>
                <td className="text-right text-[#2563eb]">{fmtDec2(calcs.cmUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.cmPct, 0)}</td>
              </tr>
              <tr className="bg-[#ffff00] font-bold">
                <td className="py-[1px]">CM/Minute</td>
                <td className="text-right">{fmtDec2(calcs.cmMinutePKR)}</td>
                <td className="text-right">{fmtDec2(calcs.cmMinuteUSD)}</td>
                <td className="text-right" />
              </tr>

              {/* OVERHEADS SECTION */}
              <tr className="border-t border-black font-bold">
                <td className="py-[1px]" colSpan={4}>Overheads</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Salaries</td>
                <td className="text-right">{fmtInt(calcs.salariesCostPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.salariesCostUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.salariesCostPct, 0)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">FOH/Admin</td>
                <td className="text-right">{fmtInt(calcs.fohAdminCostPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.fohAdminCostUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.fohAdminCostPct, 0)}</td>
              </tr>
              <tr>
                <td className="py-[1px] pl-1">Repair and Mtc</td>
                <td className="text-right">{fmtInt(calcs.repairMtcCostPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.repairMtcCostUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.repairMtcCostPct, 0)}</td>
              </tr>

              {/* BOTTOM TOTALS */}
              <tr className="border-t border-black font-bold">
                <td className="py-[1px]">Total Cost</td>
                <td className="text-right">{fmtInt(calcs.totalCostPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.totalCostUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.totalCostPct, 0)}</td>
              </tr>
              <tr className="font-bold">
                <td className="py-[1px]">Conversion Cost per Minute</td>
                <td className="text-right bg-[#fde047] px-0.5">{fmtDec2(calcs.conversionCostPerMinPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.conversionCostPerMinUSD)}</td>
                <td className="text-right" />
              </tr>
              <tr className="bg-[#fef9c3] font-bold border-t border-black">
                <td className="py-[1px]">EBITDA</td>
                <td className="text-right">{fmtInt(calcs.ebitdaPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.ebitdaUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.ebitdaPct, 0)}</td>
              </tr>
              <tr>
                <td className="py-[1px]">Dep</td>
                <td className="text-right">{fmtInt(calcs.depreciationCostPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.depreciationCostUSD)}</td>
                <td className="text-right text-[#2563eb]">{fmtPct(calcs.depreciationCostPct, 2)}</td>
              </tr>
              <tr className="border-t border-black font-bold">
                <td className="py-[1px]">Net Profit</td>
                <td className="text-right">{fmtInt(calcs.netProfitPKR)}</td>
                <td className="text-right">{fmtDec2(calcs.netProfitUSD)}</td>
                <td className="text-right text-[#2563eb] font-bold">{fmtPct(calcs.netProfitPct, 2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ─── RIGHT COLUMN: BOM TABLES ─── */}
        <div className="col-span-6 pl-1">
          <table className="w-full border-collapse text-[9.5px]">
            <thead>
              <tr className="border-b border-black font-bold">
                <th className="text-left py-0.5 w-16">Category</th>
                <th className="text-left py-0.5">Item Name</th>
                <th className="text-right py-0.5 w-12">Cons. / Pc</th>
                <th className="text-center py-0.5 w-8">UOM</th>
                <th className="text-right py-0.5 w-10">Rate-$</th>
                <th className="text-right py-0.5 w-12">Rate-Pkr</th>
                <th className="text-right py-0.5 w-14">Cost</th>
              </tr>
            </thead>
            <tbody>
              {/* FABRIC ROWS: Only actual fabrics */}
              <tr className="font-bold border-b border-black">
                <td colSpan={7} className="py-[1px]">Fabric</td>
              </tr>
              {validFabrics.length > 0 ? (
                validFabrics.map((item, idx) => (
                  <tr key={`fab-${idx}`} className="border-b border-slate-100">
                    <td className="py-[1px]">Fabric_{idx + 1}</td>
                    <td className="truncate max-w-[140px]">{item.itemName || `Fabric ${idx + 1}`}</td>
                    <td className="text-right">{(item.consumptionPerPc || 0).toFixed(2)}</td>
                    <td className="text-center">Mtr</td>
                    <td className="text-right">{fmtDec2(item.rateUSD)}</td>
                    <td className="text-right">{fmtInt(item.ratePKR)}</td>
                    <td className="text-right font-medium">
                      {(item.fabricCostPKR || 0).toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-slate-100">
                  <td className="py-[1px]">Fabric_1</td>
                  <td>—</td>
                  <td className="text-right">-</td>
                  <td className="text-center">Mtr</td>
                  <td className="text-right">-</td>
                  <td className="text-right">-</td>
                  <td className="text-right">-</td>
                </tr>
              )}
              <tr className="border-t border-b border-black font-bold">
                <td className="py-[1px]">Total</td>
                <td />
                <td className="text-right">{totalFabricCons.toFixed(2)}</td>
                <td />
                <td className="text-right">{fmtDec2(avgFabricRateUSD)}</td>
                <td className="text-right">{fmtInt(avgFabricRatePKR)}</td>
                <td className="text-right">{calcs.fabricCostPKR.toFixed(2)}</td>
              </tr>

              {/* POCKET LINING ROWS: Only actual linings */}
              <tr className="font-bold border-t border-b border-black">
                <td colSpan={7} className="py-[1px]">Pocket Lining</td>
              </tr>
              {validLinings.length > 0 ? (
                validLinings.map((item, idx) => (
                  <tr key={`lin-${idx}`} className="border-b border-slate-100">
                    <td className="py-[1px]">Lining_{idx + 1}</td>
                    <td className="truncate max-w-[140px]">{item.itemName || `Lining ${idx + 1}`}</td>
                    <td className="text-right">{(item.consumptionPerPc || 0).toFixed(2)}</td>
                    <td className="text-center">Mtr</td>
                    <td className="text-right">{fmtDec2(item.rateUSD)}</td>
                    <td className="text-right">{fmtInt(item.ratePKR)}</td>
                    <td className="text-right font-medium">
                      {(item.liningCostPKR || 0).toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-slate-100">
                  <td className="py-[1px]">Lining_1</td>
                  <td>—</td>
                  <td className="text-right">-</td>
                  <td className="text-center">Mtr</td>
                  <td className="text-right">-</td>
                  <td className="text-right">-</td>
                  <td className="text-right">-</td>
                </tr>
              )}
              <tr className="border-t border-b border-black font-bold">
                <td className="py-[1px]">Total</td>
                <td />
                <td className="text-right">{totalLiningCons.toFixed(2)}</td>
                <td />
                <td className="text-right">{fmtDec2(avgLiningRateUSD)}</td>
                <td className="text-right">{fmtInt(avgLiningRatePKR)}</td>
                <td className="text-right">{calcs.liningCostPKR.toFixed(2)}</td>
              </tr>

              {/* ACCESSORIES ROWS: Only actual accessories entered */}
              <tr className="font-bold border-t border-b border-black">
                <td colSpan={7} className="py-[1px]">Accessories</td>
              </tr>
              {validAccessories.length > 0 ? (
                validAccessories.map((item, idx) => {
                  const catLabel = item.category || "";
                  const itemLabel = item.itemName || item.category || "";
                  const rateUSD = item.rateUSD
                    ? item.rateUSD
                    : parityProcurement && parityProcurement > 0 && item.ratePKR > 0
                    ? item.ratePKR / parityProcurement
                    : 0;

                  return (
                    <tr key={`acc-${idx}`} className="border-b border-slate-100">
                      <td className="py-[1px] truncate max-w-[90px]">{catLabel}</td>
                      <td className="truncate max-w-[140px]">{itemLabel}</td>
                      <td className="text-right">{(item.consPerPc || 0).toFixed(2)}</td>
                      <td className="text-center" />
                      <td className="text-right">{rateUSD > 0 ? fmtDec2(rateUSD) : ""}</td>
                      <td className="text-right">{item.ratePKR > 0 ? fmtInt(item.ratePKR) : ""}</td>
                      <td className="text-right font-medium">
                        {(item.totalCostPKR || 0).toFixed(2)}
                      </td>
                    </tr>
                  );
                })
              ) : null}
              <tr className="border-t border-b border-black font-bold">
                <td className="py-[1px]">Total</td>
                <td colSpan={5} />
                <td className="text-right">{calcs.accessoriesCostPKR.toFixed(2)}</td>
              </tr>

              {/* OTHER COST / CHEMICALS SECTION: Only actual chemicals & charges */}
              <tr className="font-bold border-t border-b border-black">
                <td colSpan={7} className="py-[1px]">Other Cost &amp; Chemicals</td>
              </tr>
              {/* Chemical Cost */}
              {validChemicals.length > 0 ? (
                validChemicals.map((cItem, cIdx) => (
                  <tr key={`chem-${cIdx}`} className="border-b border-slate-100">
                    <td className="py-[1px] font-semibold">Chemical Cost</td>
                    <td>{cItem.washItem || washType || ""}</td>
                    <td className="text-right">{cItem.consPerPc ? cItem.consPerPc.toFixed(2) : ""}</td>
                    <td className="text-center" />
                    <td className="text-right">{fmtDec2(cItem.rateUSD)}</td>
                    <td className="text-right">{fmtInt(cItem.ratePKR)}</td>
                    <td className="text-right font-medium">
                      {(cItem.totalCostPKR || 0).toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : calcs.chemicalsCostPKR > 0 ? (
                <tr className="border-b border-slate-100">
                  <td className="py-[1px] font-semibold">Chemical Cost</td>
                  <td>{washType || ""}</td>
                  <td className="text-right">{activeStyle.bomChemicals?.length ? "1.00" : ""}</td>
                  <td className="text-center" />
                  <td className="text-right">{fmtDec2(calcs.chemicalsCostUSD)}</td>
                  <td className="text-right">{fmtInt(calcs.chemicalsCostPKR)}</td>
                  <td className="text-right font-medium">
                    {calcs.chemicalsCostPKR.toFixed(2)}
                  </td>
                </tr>
              ) : null}

              {/* Special Charges (Only if entered!) */}
              {validSpecialCharges.map((item, idx) => (
                <tr key={`sp-${idx}`} className="border-b border-slate-100">
                  <td className="py-[1px] font-semibold">Other Cost</td>
                  <td className="py-[1px]">{item.itemName || ""}</td>
                  <td className="text-right">{item.consPerPc ? item.consPerPc.toFixed(2) : ""}</td>
                  <td className="text-center" />
                  <td className="text-right">{item.rateUSD ? fmtDec2(item.rateUSD) : ""}</td>
                  <td className="text-right">{fmtInt(item.ratePKR)}</td>
                  <td className="text-right font-medium">
                    {(item.totalCostPKR || 0).toFixed(2)}
                  </td>
                </tr>
              ))}

              <tr className="border-t border-black font-bold">
                <td className="py-[1px]">Total</td>
                <td colSpan={5} />
                <td className="text-right">
                  {(calcs.chemicalsCostPKR + calcs.specialChargesCostPKR).toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
