"use client";

import React from "react";
import type { StyleMasterItem } from "@/features/style-master/types";
import type { CalculationResult } from "../services/CostSheetFormulaEngine";
import type { CostSheetApprovals } from "../types";

export interface DuerPrintReportProps {
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
  approvals?: CostSheetApprovals;
  costSheetNumber?: string;
  preparedByName?: string;
}

function formatDotDate(dateStr?: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatCurrentDateTime(): string {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const seconds = String(d.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  const strHours = String(hours).padStart(2, "0");
  return `${day}.${month}.${year} ${strHours}:${minutes}:${seconds} ${ampm}`;
}

function fmtInt(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return "0";
  return Math.round(val).toLocaleString();
}

function fmtDec2(val?: number): string {
  if (val === undefined || val === null || isNaN(val)) return "0.00";
  return val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(val?: number, decimals = 2): string {
  if (val === undefined || val === null || isNaN(val)) return "0.00 %";
  return (val * 100).toFixed(decimals) + " %";
}

export function DuerPrintReport({
  activeStyle,
  workOrderNumber,
  calcs,
  costingDate,
  costingStage,
  customerName,
  paritySale,
  paymentTerms,
  smvSewing,
  approvals,
  costSheetNumber = "",
  preparedByName = "",
}: DuerPrintReportProps) {
  const isApproved = approvals?.director?.status === "approved";
  const approvalStatus = isApproved ? "Approved" : "Unapproved";
  const printTimestamp = formatCurrentDateTime();

  // Style label
  const styleDisplay =
    activeStyle.id !== "custom"
      ? activeStyle.id
      : activeStyle.styleName || "";

  // Stage label
  const stageDisplay = workOrderNumber
    ? `RECUT OF WO# ${workOrderNumber}`
    : costingStage || "";

  // Actual entered fabrics
  const fabricRows = (activeStyle.bomFabric || []).filter(
    (f) =>
      (f.itemName && f.itemName.trim() !== "") ||
      (f.consumptionPerPc || 0) > 0 ||
      (f.fabricCostPKR || 0) > 0
  );

  // Actual entered linings
  const liningRows = (activeStyle.bomLining || []).filter(
    (l) =>
      (l.itemName && l.itemName.trim() !== "") ||
      (l.consumptionPerPc || 0) > 0 ||
      (l.liningCostPKR || 0) > 0
  );

  const combinedFabricLining = [
    ...liningRows.map((l) => ({
      itemGroup: "Lining",
      itemName: l.itemName || "",
      consumption: l.consumptionPerPc || 0,
      uom: "",
      rate: l.ratePKR || 0,
      cost: l.liningCostPKR || 0,
    })),
    ...fabricRows.map((f) => ({
      itemGroup: activeStyle.orderType || "",
      itemName: f.itemName || "",
      consumption: f.consumptionPerPc || 0,
      uom: "",
      rate: f.ratePKR || 0,
      cost: f.fabricCostPKR || 0,
    })),
  ];

  const totalFabricLiningCost = calcs.fabricCostPKR + calcs.liningCostPKR;

  // Actual entered accessories
  const validAccessories = (activeStyle.bomAccessories || []).filter(
    (a) =>
      (a.itemName && a.itemName.trim() !== "") ||
      (a.category && a.category.trim() !== "") ||
      (a.totalCostPKR || 0) > 0 ||
      (a.consPerPc || 0) > 0
  );

  // Actual entered special charges
  const validSpecialCharges = (activeStyle.bomSpecialCharges || []).filter(
    (c) =>
      (c.itemName && c.itemName.trim() !== "") ||
      (c.totalCostPKR || 0) > 0 ||
      (c.ratePKR || 0) > 0
  );

  // Labour items strictly from calculation engine
  const effectiveSmv = smvSewing || activeStyle.smvSewing || 0;
  const sewingLaborCost = calcs.directLaborCostPKR || 0;
  const sewingRate = effectiveSmv > 0 ? sewingLaborCost / effectiveSmv : 0;
  const washingLaborCost = calcs.chemicalsCostPKR || 0;
  const specialChargesTotal = validSpecialCharges.reduce(
    (sum, c) => sum + (c.totalCostPKR || 0),
    0
  );
  const totalLabourCost = sewingLaborCost + washingLaborCost + specialChargesTotal;

  // Other items (Overheads)
  const fohCost = calcs.fohAdminCostPKR || 0;
  const fohRate = effectiveSmv > 0 ? fohCost / effectiveSmv : 0;
  const freightCost = calcs.freightPKR || 0;
  const totalOtherCost = fohCost + freightCost;

  // Summary strictly from calculation engine
  const costSubtotalPKR = calcs.totalVariableCostPKR + calcs.totalCostPKR - calcs.leftoverCostPKR;
  const costSubtotalUSD = calcs.totalVariableCostUSD + calcs.totalCostUSD - calcs.leftoverCostUSD;

  const renderHeader = () => (
    <div className="border-b border-black pb-1 mb-1">
      <div className="flex justify-between items-start text-[8px] text-slate-800">
        <div>
          <div className="flex items-center gap-1.5">
            {/* Indus Plus Red/Black Logo */}
            <div className="w-5 h-5 grid grid-cols-2 gap-[1px]">
              <div className="bg-[#dc2626]" />
              <div className="bg-black" />
              <div className="bg-black" />
              <div className="bg-[#dc2626]" />
            </div>
            <div>
              <div className="font-extrabold text-[11px] underline tracking-tight text-black">
                INDUS PLUS (PVT) LTD.
              </div>
              <div className="text-[7.5px] text-[#dc2626] font-semibold leading-tight">
                UAN : +92-42-111-777-700
              </div>
              <div className="text-[7px] text-black leading-tight">
                135-S QUAID.E.AZAM INDUSTRIAL ESTATE
              </div>
              <div className="text-[7px] text-black leading-tight">
                LAHORE, PAKISTAN
              </div>
            </div>
          </div>
        </div>

        <div className="text-center pt-1">
          <h2 className="text-[13px] font-black text-[#1e40af] tracking-wide">
            PRE-ORDER COSTING
          </h2>
        </div>

        <div className="text-right">
          <div className="text-[8px] text-slate-500">
            Print: {printTimestamp}
          </div>
          <div className="text-[11px] text-slate-500 font-semibold mt-1">
            {approvalStatus}
          </div>
          <div className="text-[9px] font-bold text-black mt-0.5">
            COST SHEET # <span className="underline">{costSheetNumber}</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderFooter = (pageStr: string) => (
    <div
      className="border-t border-black pt-1 mt-3 flex justify-between items-center text-[9px] font-medium text-black"
      style={{ breakInside: "avoid" }}
    >
      <div className="flex items-center gap-4">
        <span>Prepared By</span>
        <span className="font-bold underline">{preparedByName}</span>
        <span>{formatDotDate(costingDate)}</span>
      </div>
      <div>Page:{pageStr}</div>
    </div>
  );

  return (
    <div className="w-full bg-white text-black font-sans text-[9px] leading-[1.2] p-2 duer-print-container">
      {renderHeader()}

      {/* Metadata Grid */}
      <div className="grid grid-cols-2 gap-x-6 text-[8.5px] py-1 border-b border-black">
        {/* Left Column */}
        <div className="space-y-[2px]">
          <div className="flex">
            <span className="w-28 font-bold">COST SHEET #</span>
            <span className="font-bold">{costSheetNumber}</span>
          </div>
          <div className="flex">
            <span className="w-28 font-bold">DATE</span>
            <span>{formatDotDate(costingDate)}</span>
          </div>
          <div className="flex">
            <span className="w-28 font-bold">BUYER</span>
            <span className="font-bold">{customerName}</span>
          </div>
          <div className="flex">
            <span className="w-28 font-bold">SEASON</span>
            <span>{costingStage}</span>
          </div>
          <div className="flex">
            <span className="w-28 font-bold">AGENT</span>
            <span></span>
          </div>
          <div className="flex">
            <span className="w-28 font-bold">STYLE #</span>
            <span className="font-bold truncate">{styleDisplay}</span>
          </div>
          <div className="flex">
            <span className="w-28 font-bold">STAGE</span>
            <span className="truncate">{stageDisplay}</span>
          </div>
          <div className="flex">
            <span className="w-28 font-bold">DDP YVR #</span>
            <span></span>
          </div>
          <div className="flex">
            <span className="w-36 font-bold">PIMLICO DDP AIR YVR</span>
            <span></span>
          </div>
          <div className="flex">
            <span className="w-36 font-bold">PIMLICO DDP SEA DDP YVR</span>
            <span></span>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-[2px]">
          <div className="flex justify-between">
            <span className="font-bold">CURRENCY</span>
            <span className="font-bold">USD</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">EX. RATE</span>
            <span className="font-bold">{paritySale ? fmtDec2(paritySale) : ""}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">PAYMENT TOOL</span>
            <span></span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">PAYMENT TERMS</span>
            <span className="truncate">{paymentTerms}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">FACTORY</span>
            <span className="font-bold">Indus Plus</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">TOTAL SAM</span>
            <span className="font-bold">{effectiveSmv > 0 ? fmtDec2(effectiveSmv) : ""}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">EXCESS PRODUCTION %</span>
            <span className="font-bold">{fmtPct(calcs.rejectionPct, 2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">QUOTED PRICE</span>
            <span className="font-bold">{fmtDec2(calcs.sellingPriceUSD)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">DML U</span>
            <span></span>
          </div>
          <div className="flex justify-between">
            <span className="font-bold">DML C</span>
            <span></span>
          </div>
        </div>
      </div>

      {/* TABLE: FABRIC & LINING */}
      <div className="mt-1">
        <div className="bg-[#cbd5e1] font-bold px-1 py-[2px] text-[8.5px] uppercase border border-black">
          FABRIC &amp; LINING
        </div>
        <table className="w-full border-collapse text-[8px] border border-black">
          <thead>
            <tr className="bg-slate-100 border-b border-black font-bold">
              <th className="text-left p-1 w-24">ITEMS</th>
              <th className="text-left p-1">ITEM DESCRIPTION</th>
              <th className="text-right p-1 w-16">CONSMPTION</th>
              <th className="text-center p-1 w-10">UOM</th>
              <th className="text-right p-1 w-16">RATE</th>
              <th className="text-right p-1 w-20">TOTAL COST</th>
            </tr>
          </thead>
          <tbody>
            {combinedFabricLining.length > 0 ? (
              combinedFabricLining.map((row, idx) => (
                <tr key={`fl-${idx}`} className="border-b border-slate-200">
                  <td className="p-1 font-semibold">{row.itemGroup}</td>
                  <td className="p-1 truncate max-w-[280px]">{row.itemName}</td>
                  <td className="p-1 text-right">{row.consumption.toFixed(2)}</td>
                  <td className="p-1 text-center">{row.uom}</td>
                  <td className="p-1 text-right">{fmtDec2(row.rate)}</td>
                  <td className="p-1 text-right font-medium">{fmtDec2(row.cost)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-1 text-center text-slate-400">
                  No fabric items entered
                </td>
              </tr>
            )}
            <tr className="border-t-2 border-black font-bold bg-slate-50">
              <td colSpan={5} className="p-1 text-right">
                FABRIC TOTAL:
              </td>
              <td className="p-1 text-right">{fmtDec2(totalFabricLiningCost)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TABLE: TRIMS & ACCESSORIES */}
      <div className="mt-2">
        <div className="bg-[#cbd5e1] font-bold px-1 py-[2px] text-[8.5px] uppercase border border-black">
          TRIMS &amp; ACCESSORIES
        </div>
        <table className="w-full border-collapse text-[8px] border border-black">
          <thead>
            <tr className="bg-slate-100 border-b border-black font-bold">
              <th className="text-left p-1 w-24">ITEMS</th>
              <th className="text-left p-1">ITEM DESCRIPTION</th>
              <th className="text-right p-1 w-16">CONSMPTION</th>
              <th className="text-center p-1 w-10">UOM</th>
              <th className="text-right p-1 w-16">RATE</th>
              <th className="text-right p-1 w-20">TOTAL COST</th>
            </tr>
          </thead>
          <tbody>
            {validAccessories.length > 0 ? (
              validAccessories.map((item, idx) => (
                <tr key={`acc-${idx}`} className="border-b border-slate-200">
                  <td className="p-1 font-semibold truncate max-w-[90px]">
                    {item.category || ""}
                  </td>
                  <td className="p-1 truncate max-w-[280px]">
                    {item.itemName || item.category || ""}
                  </td>
                  <td className="p-1 text-right">{(item.consPerPc || 0).toFixed(2)}</td>
                  <td className="p-1 text-center"></td>
                  <td className="p-1 text-right">{fmtDec2(item.ratePKR)}</td>
                  <td className="p-1 text-right font-medium">
                    {fmtDec2(item.totalCostPKR)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6} className="p-1 text-center text-slate-400">
                  No accessories entered
                </td>
              </tr>
            )}
            <tr className="border-t-2 border-black font-bold bg-slate-50">
              <td colSpan={5} className="p-1 text-right">
                TRIM&amp; ACC TOTAL:
              </td>
              <td className="p-1 text-right">
                {fmtDec2(calcs.accessoriesCostPKR)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TABLE: LABOUR COST */}
      <div className="mt-2" style={{ breakInside: "avoid" }}>
        <div className="bg-[#cbd5e1] font-bold px-1 py-[2px] text-[8.5px] uppercase border border-black">
          LABOUR COST
        </div>
        <table className="w-full border-collapse text-[8px] border border-black">
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="p-1 font-semibold w-24">Sewing</td>
              <td className="p-1">Sewing Cost</td>
              <td className="p-1 text-right w-16">{effectiveSmv > 0 ? fmtDec2(effectiveSmv) : ""}</td>
              <td className="p-1 text-center w-10" />
              <td className="p-1 text-right w-16">{sewingRate > 0 ? fmtDec2(sewingRate) : ""}</td>
              <td className="p-1 text-right w-20 font-medium">{fmtDec2(sewingLaborCost)}</td>
            </tr>
            {washingLaborCost > 0 && (
              <tr className="border-b border-slate-200">
                <td className="p-1 font-semibold">Washing</td>
                <td className="p-1">Washing Cost</td>
                <td className="p-1 text-right">{activeStyle.bomChemicals?.length ? "1.00" : ""}</td>
                <td className="p-1 text-center" />
                <td className="p-1 text-right">{fmtDec2(washingLaborCost)}</td>
                <td className="p-1 text-right font-medium">{fmtDec2(washingLaborCost)}</td>
              </tr>
            )}
            {validSpecialCharges.map((charge, cIdx) => (
              <tr key={`chg-${cIdx}`} className="border-b border-slate-200">
                <td className="p-1 font-semibold" colSpan={2}>
                  {charge.itemName}
                </td>
                <td className="p-1 text-right">{charge.consPerPc ? charge.consPerPc.toFixed(2) : ""}</td>
                <td className="p-1 text-center" />
                <td className="p-1 text-right">{fmtDec2(charge.ratePKR)}</td>
                <td className="p-1 text-right font-medium">{fmtDec2(charge.totalCostPKR)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-black font-bold bg-slate-50">
              <td colSpan={5} className="p-1 text-right">
                LABOUR TOTAL:
              </td>
              <td className="p-1 text-right">{fmtDec2(totalLabourCost)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TABLE: OTHER COST */}
      <div className="mt-2" style={{ breakInside: "avoid" }}>
        <div className="bg-[#cbd5e1] font-bold px-1 py-[2px] text-[8.5px] uppercase border border-black">
          OTHER COST
        </div>
        <table className="w-full border-collapse text-[8px] border border-black">
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="p-1 w-48 font-semibold">FOH</td>
              <td className="p-1" />
              <td className="p-1 text-right w-16" />
              <td className="p-1 text-center w-10" />
              <td className="p-1 text-right w-16">{fohRate > 0 ? fmtDec2(fohRate) : ""}</td>
              <td className="p-1 text-right w-20 font-medium">{fmtDec2(fohCost)}</td>
            </tr>
            {freightCost > 0 && (
              <tr className="border-b border-slate-200">
                <td className="p-1 font-semibold" colSpan={2}>
                  Inland Freight &amp; Clearing
                </td>
                <td className="p-1 text-right" />
                <td className="p-1 text-center" />
                <td className="p-1 text-right">{fmtDec2(freightCost)}</td>
                <td className="p-1 text-right font-medium">{fmtDec2(freightCost)}</td>
              </tr>
            )}
            <tr className="border-t-2 border-black font-bold bg-slate-50">
              <td colSpan={5} className="p-1 text-right">
                OTHER TOTAL:
              </td>
              <td className="p-1 text-right">{fmtDec2(totalOtherCost)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TABLE: SUMMARY */}
      <div className="mt-2" style={{ breakInside: "avoid" }}>
        <div className="bg-[#cbd5e1] font-bold px-2 py-[2px] text-[9px] border border-black flex justify-between">
          <span>Summary</span>
          <div className="flex gap-16 pr-4">
            <span className="w-16 text-right">USD</span>
            <span className="w-20 text-right">PKR</span>
          </div>
        </div>

        <table className="w-full border-collapse text-[8.5px] border border-black">
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="p-1.5 font-bold w-48">COST SUBTOTAL</td>
              <td className="p-1.5 text-center w-24" />
              <td className="p-1.5 text-right w-24 font-medium">$ {fmtDec2(costSubtotalUSD)}</td>
              <td className="p-1.5 text-right w-28 font-medium">{fmtDec2(costSubtotalPKR)}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="p-1.5 font-bold">EXCESS %</td>
              <td className="p-1.5 text-center font-medium">{fmtPct(calcs.rejectionPct, 2)}</td>
              <td className="p-1.5 text-right font-medium">$ {fmtDec2(calcs.leftoverCostUSD)}</td>
              <td className="p-1.5 text-right font-medium">{fmtDec2(calcs.leftoverCostPKR)}</td>
            </tr>
            <tr className="border-t-2 border-black font-bold bg-slate-50">
              <td className="p-1.5">TOTAL COST</td>
              <td className="p-1.5" />
              <td className="p-1.5 text-right">$ {fmtDec2(calcs.totalCostUSD)}</td>
              <td className="p-1.5 text-right">{fmtDec2(calcs.totalCostPKR)}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="p-1.5 font-bold">QUOTED PRICE</td>
              <td className="p-1.5" />
              <td className="p-1.5 text-right font-medium">$ {fmtDec2(calcs.sellingPriceUSD)}</td>
              <td className="p-1.5 text-right font-medium">{fmtDec2(calcs.sellingPricePKR)}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="p-1.5 font-bold">LOCAL BANK CHARGES</td>
              <td className="p-1.5 text-center font-medium">{fmtPct(calcs.bankChargesPct, 2)}</td>
              <td className="p-1.5 text-right font-medium">$ {fmtDec2(calcs.bankChargesUSD)}</td>
              <td className="p-1.5 text-right font-medium">{fmtDec2(calcs.bankChargesPKR)}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="p-1.5 font-bold">FOREIGN BANK CHARGES</td>
              <td className="p-1.5 text-center font-medium">{fmtPct(calcs.foreignBankChargesPct, 2)}</td>
              <td className="p-1.5 text-right font-medium">$ {fmtDec2(calcs.foreignBankChargesUSD)}</td>
              <td className="p-1.5 text-right font-medium">{fmtDec2(calcs.foreignBankChargesPKR)}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="p-1.5 font-bold">TURNOVER TAX</td>
              <td className="p-1.5 text-center font-medium">{fmtPct(calcs.taxEDS_Pct, 2)}</td>
              <td className="p-1.5 text-right font-medium">$ {fmtDec2(calcs.taxEDS_USD)}</td>
              <td className="p-1.5 text-right font-medium">{fmtDec2(calcs.taxEDS_PKR)}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="p-1.5 font-bold">COMMISSION</td>
              <td className="p-1.5 text-center font-medium">{fmtPct(calcs.commissionPct, 2)}</td>
              <td className="p-1.5 text-right font-medium">$ {fmtDec2(calcs.commissionUSD)}</td>
              <td className="p-1.5 text-right font-medium">{fmtDec2(calcs.commissionPKR)}</td>
            </tr>
            <tr className="border-b border-slate-200">
              <td className="p-1.5 font-bold">DISCOUNT</td>
              <td className="p-1.5 text-center font-medium">{fmtPct(calcs.markupDiscountPct, 2)}</td>
              <td className="p-1.5 text-right font-medium">$ {fmtDec2(calcs.markupDiscountUSD)}</td>
              <td className="p-1.5 text-right font-medium">{fmtDec2(calcs.markupDiscountPKR)}</td>
            </tr>
            <tr className="border-t-2 border-black font-bold bg-slate-50">
              <td className="p-1.5">NET SALE PRICE</td>
              <td className="p-1.5" />
              <td className="p-1.5 text-right">$ {fmtDec2(calcs.netPriceUSD)}</td>
              <td className="p-1.5 text-right">PKR {fmtInt(calcs.netPricePKR)}</td>
            </tr>
            <tr className="font-bold">
              <td className="p-1.5">PROFIT MARGIN</td>
              <td className="p-1.5 text-center">{fmtPct(calcs.netProfitPct, 2)}</td>
              <td className="p-1.5 text-right">$ {fmtDec2(calcs.netProfitUSD)}</td>
              <td className="p-1.5 text-right">PKR {fmtInt(calcs.netProfitPKR)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* VERIFIED BY SIGNATURES BOX */}
      <div className="mt-4 border-2 border-black" style={{ breakInside: "avoid" }}>
        <div className="font-extrabold text-[9px] uppercase px-2 py-1 border-b border-black">
          VERIFIED BY
        </div>
        <div className="p-4">
          <div className="grid grid-cols-4 gap-4 text-center pt-6">
            <div className="border-t border-black pt-1 font-bold text-[9px]">
              HOD Marketing
            </div>
            <div className="border-t border-black pt-1 font-bold text-[9px]">
              HOD Fabric
            </div>
            <div className="border-t border-black pt-1 font-bold text-[9px]">
              HOD Washing
            </div>
            <div className="border-t border-black pt-1 font-bold text-[9px]">
              HOD IE
            </div>
          </div>

          <div className="grid grid-cols-2 gap-16 text-center pt-10 px-12">
            <div className="border-t border-black pt-1 font-bold text-[9.5px]">
              COSTING
            </div>
            <div className="border-t border-black pt-1 font-bold text-[9.5px]">
              Director&apos;s Approval
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      {renderFooter("1-1")}
    </div>
  );
}
