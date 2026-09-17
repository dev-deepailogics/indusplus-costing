"use client";

import { Save, Printer, RefreshCw, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import type { StyleMasterItem } from "@/features/style-master";
import type { StyleWorkOrderRow } from "@/app/api/styles-and-workorders/route";
import type { SavedCostSheetItem } from "../types";

interface CostSheetHeaderProps {
  stylesList: StyleMasterItem[];
  indusDbList: StyleWorkOrderRow[];
  activeStyle: StyleMasterItem;
  loadedCostSheet: SavedCostSheetItem | null;
  onSelectStyle: (styleId: string) => void;
  onUpdateStyle: (patch: Partial<StyleMasterItem>) => void;
  costingDate: string;
  onCostingDateChange: (date: string) => void;
  costingStage: string;
  onCostingStageChange: (stage: string) => void;
  country: string;
  onCountryChange: (country: string) => void;
  paymentTerms: string;
  onPaymentTermsChange: (terms: string) => void;
  shipmentMode: string;
  onShipmentModeChange: (mode: string) => void;
  deliveryTerms: string;
  onDeliveryTermsChange: (terms: string) => void;
  paritySale: number;
  onParitySaleChange: (val: number) => void;
  parityProcurement: number;
  onParityProcurementChange: (val: number) => void;
  paymentTermsList: string[];
  deliveryTermsList: string[];
  countriesList: string[];
  categoriesList: string[];
  washTypesList: string[];
  orderTypesList: string[];
  onOpenSaveModal: () => void;
  onOpenPrintModal: () => void;
  loadingBOM: boolean;
}

export function CostSheetHeader({
  stylesList,
  indusDbList,
  activeStyle,
  loadedCostSheet,
  onSelectStyle,
  onUpdateStyle,
  costingDate,
  onCostingDateChange,
  costingStage,
  onCostingStageChange,
  country,
  onCountryChange,
  paymentTerms,
  onPaymentTermsChange,
  shipmentMode,
  onShipmentModeChange,
  deliveryTerms,
  onDeliveryTermsChange,
  paritySale,
  onParitySaleChange,
  parityProcurement,
  onParityProcurementChange,
  paymentTermsList,
  deliveryTermsList,
  countriesList,
  categoriesList,
  washTypesList,
  orderTypesList,
  onOpenSaveModal,
  onOpenPrintModal,
  loadingBOM,
}: CostSheetHeaderProps) {
  // Build style select options combining Style Master & Indus DB
  const styleOptions: SearchableSelectOption[] = [
    { value: "custom", label: "Custom Style (Blank)" },
    ...stylesList.map((s) => ({
      value: s.id,
      label: `${s.id} - ${s.styleName} (${s.customerName})`,
    })),
    ...indusDbList
      .filter((db) => !stylesList.some((s) => s.id === db.styleCode))
      .map((db) => ({
        value: db.styleCode,
        label: `${db.styleCode} - ${db.styleName} [Indus DB]`,
      })),
  ];

  return (
    <div className="space-y-4">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-xl border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10 text-primary">
            <Layers className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">Apparel Cost Sheet</h1>
              {loadedCostSheet && (
                <Badge variant="outline" className="font-mono text-xs">
                  {loadedCostSheet.id}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {loadedCostSheet
                ? `Loaded Scenario: "${loadedCostSheet.referenceName}"`
                : "Dynamic FOB, CM, EBITDA & Profit Margin Pricing Calculator"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onOpenPrintModal}>
            <Printer className="mr-1.5 size-4" /> Print Sheet
          </Button>
          <Button size="sm" onClick={onOpenSaveModal}>
            <Save className="mr-1.5 size-4" /> {loadedCostSheet ? "Update Scenario" : "Save Scenario"}
          </Button>
        </div>
      </div>

      {/* Main Metadata Grid */}
      <Card className="shadow-xs border-muted/70">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Style Selector */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Select Style Master / Linked Work Order</span>
                {loadingBOM && (
                  <span className="text-primary flex items-center gap-1 font-normal text-[11px]">
                    <RefreshCw className="size-3 animate-spin" /> Fetching BOM...
                  </span>
                )}
              </label>
              <SearchableSelect
                options={styleOptions}
                value={activeStyle.id}
                onChange={onSelectStyle}
                placeholder="Choose style..."
              />
            </div>

            {/* Style Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Style Name</label>
              <Input
                value={activeStyle.styleName}
                onChange={(e) => onUpdateStyle({ styleName: e.target.value })}
                placeholder="e.g. TR 298 VITA"
              />
            </div>

            {/* Customer Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Customer</label>
              <Input
                value={activeStyle.customerName}
                onChange={(e) => onUpdateStyle({ customerName: e.target.value })}
                placeholder="e.g. Duer"
              />
            </div>

            {/* Style Category */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Category</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none"
                value={activeStyle.styleCategory}
                onChange={(e) => onUpdateStyle({ styleCategory: e.target.value })}
              >
                {categoriesList.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Order Type</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none"
                value={activeStyle.orderType}
                onChange={(e) =>
                  onUpdateStyle({ orderType: e.target.value as "Denim" | "Non Denim" })
                }
              >
                {orderTypesList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Wash Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Wash Type</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none"
                value={activeStyle.washType}
                onChange={(e) => onUpdateStyle({ washType: e.target.value })}
              >
                {washTypesList.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </div>

            {/* Order Quantity */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Order Quantity (Pcs)</label>
              <Input
                type="number"
                value={activeStyle.orderQuantity || ""}
                onChange={(e) => onUpdateStyle({ orderQuantity: Number(e.target.value) })}
              />
            </div>

            {/* SMV Sewing */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">SMV Sewing (SAM)</label>
              <Input
                type="number"
                step="0.01"
                value={activeStyle.smvSewing || ""}
                onChange={(e) => onUpdateStyle({ smvSewing: Number(e.target.value) })}
              />
            </div>

            {/* Costing Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Costing Date</label>
              <Input
                type="date"
                value={costingDate}
                onChange={(e) => onCostingDateChange(e.target.value)}
              />
            </div>

            {/* Costing Stage */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Costing Stage</label>
              <Input
                value={costingStage}
                onChange={(e) => onCostingStageChange(e.target.value)}
                placeholder="e.g. Costing"
              />
            </div>

            {/* Parity Sale (PKR/USD) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Parity (Sale)</label>
              <Input
                type="number"
                step="0.01"
                value={paritySale || ""}
                onChange={(e) => onParitySaleChange(Number(e.target.value))}
              />
            </div>

            {/* Parity Procurement (PKR/USD) */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Parity (Procurement)</label>
              <Input
                type="number"
                step="0.01"
                value={parityProcurement || ""}
                onChange={(e) => onParityProcurementChange(Number(e.target.value))}
              />
            </div>

            {/* Payment Terms */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Payment Terms</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none"
                value={paymentTerms}
                onChange={(e) => onPaymentTermsChange(e.target.value)}
              >
                {paymentTermsList.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </div>

            {/* Delivery Terms */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Delivery Terms</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none"
                value={deliveryTerms}
                onChange={(e) => onDeliveryTermsChange(e.target.value)}
              >
                {deliveryTermsList.map((term) => (
                  <option key={term} value={term}>
                    {term}
                  </option>
                ))}
              </select>
            </div>

            {/* Country */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Country</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none"
                value={country}
                onChange={(e) => onCountryChange(e.target.value)}
              >
                {countriesList.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Shipment Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Shipment Mode</label>
              <select
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm focus-visible:outline-none"
                value={shipmentMode}
                onChange={(e) => onShipmentModeChange(e.target.value)}
              >
                <option value="Sea">Sea</option>
                <option value="Air">Air</option>
                <option value="Courier">Courier</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
