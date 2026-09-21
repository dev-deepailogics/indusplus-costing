"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Building2, Sparkles, Copy, Layers, Check } from "lucide-react";
import type { SimpleTableCard } from "@/lib/parameters/types";

export interface CreateCardData {
  name: string;
  customer?: string;
  isDefault?: boolean;
  copyFromCardId?: string;
}

export function CreateCardDialog({
  open,
  onOpenChange,
  existingCards,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingCards: SimpleTableCard[];
  onSubmit: (data: CreateCardData) => void;
}) {
  const [cardType, setCardType] = useState<"customer" | "default">("customer");
  const [customers, setCustomers] = useState<string[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [cardName, setCardName] = useState("");
  const [copyFromCardId, setCopyFromCardId] = useState<string>("active");

  const nextSerial = Math.max(0, ...existingCards.map((c) => c.serialNo || 0)) + 1;

  // Fetch customers from S_StyleAndWorkOrdersView via /api/customers
  useEffect(() => {
    if (!open) return;
    setLoadingCustomers(true);
    fetch("/api/customers")
      .then((res) => res.json())
      .then((data) => {
        if (data.customers && Array.isArray(data.customers)) {
          setCustomers(data.customers);
        }
      })
      .catch((err) => console.error("Failed to load customers for card creation:", err))
      .finally(() => setLoadingCustomers(false));
  }, [open]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setCardType("customer");
      setSelectedCustomer("");
      setCardName(`Card ${nextSerial}`);
      setCopyFromCardId("active");
    }
  }, [open, nextSerial]);

  // Handle Customer Selection
  const handleCustomerChange = (cust: string) => {
    setSelectedCustomer(cust);
    if (cust) {
      setCardName(cust);
    } else {
      setCardName(`Card ${nextSerial}`);
    }
  };

  // Handle Card Type Switch
  const handleTypeSwitch = (type: "customer" | "default") => {
    setCardType(type);
    if (type === "default") {
      setSelectedCustomer("");
      setCardName(existingCards.some((c) => c.name.toLowerCase().includes("default")) ? `Default Card ${nextSerial}` : "Default Card");
    } else {
      if (selectedCustomer) {
        setCardName(selectedCustomer);
      } else {
        setCardName(`Card ${nextSerial}`);
      }
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedName = cardName.trim() || `Card ${nextSerial}`;

    onSubmit({
      name: trimmedName,
      customer: cardType === "customer" && selectedCustomer ? selectedCustomer.trim() : undefined,
      isDefault: cardType === "default",
      copyFromCardId: copyFromCardId !== "blank" ? copyFromCardId : undefined,
    });

    onOpenChange(false);
  };

  const customerOptions = useMemo(() => {
    return [
      { value: "", label: "-- Select Customer --" },
      ...customers.map((c) => ({ value: c, label: c })),
    ];
  }, [customers]);

  const copyOptions = useMemo(() => {
    const opts = [
      { value: "active", label: "Active Card (Recommended)" },
      ...existingCards.map((c) => ({
        value: c.id,
        label: `${c.name}${c.isActive ? " (Active)" : ""}${c.customer ? ` [${c.customer}]` : ""}`,
      })),
      { value: "blank", label: "Blank (Empty Values)" },
    ];
    // Deduplicate active if already present
    return opts;
  }, [existingCards]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Layers className="size-5 text-primary" />
            Create Parameter Card
          </DialogTitle>
          <DialogDescription>
            Configure rates for a specific customer or create a general default card.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Card Type Selector (2 visual cards) */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Card Target
            </Label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleTypeSwitch("customer")}
                className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                  cardType === "customer"
                    ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 text-blue-950 dark:text-blue-200 shadow-xs"
                    : "border-border hover:border-slate-300 dark:hover:border-slate-700 bg-card text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <Building2 className="size-3.5 text-blue-600 dark:text-blue-400" />
                    Customer Card
                  </div>
                  {cardType === "customer" && (
                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[9px] px-1.5 py-0 h-4 font-bold">
                      Selected
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Fetch &amp; apply automatically for this specific customer.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handleTypeSwitch("default")}
                className={`flex flex-col items-start p-3 rounded-lg border-2 text-left transition-all cursor-pointer ${
                  cardType === "default"
                    ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-200 shadow-xs"
                    : "border-border hover:border-slate-300 dark:hover:border-slate-700 bg-card text-muted-foreground"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
                    <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                    Default Card
                  </div>
                  {cardType === "default" && (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[9px] px-1.5 py-0 h-4 font-bold">
                      Selected
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] leading-tight text-muted-foreground">
                  Fallback standard card used for all other styles.
                </p>
              </button>
            </div>
          </div>

          {/* Customer Selection if cardType === "customer" */}
          {cardType === "customer" && (
            <div className="space-y-1.5 animate-in fade-in-50 duration-150">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">
                  Customer Name <span className="text-red-500">*</span>
                </Label>
                <span className="text-[10px] text-muted-foreground">
                  (From S_StyleAndWorkOrdersView)
                </span>
              </div>
              <SearchableSelect
                placeholder={loadingCustomers ? "Loading customers..." : "Search / Select Customer..."}
                value={selectedCustomer}
                onChange={handleCustomerChange}
                options={customerOptions}
                className="w-full text-xs"
              />
            </div>
          )}

          {/* Card Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Card Name</Label>
            <Input
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="e.g. Levi's, Target, Standard 2026"
              className="h-8 text-xs font-medium"
              required
            />
          </div>

          {/* Initial Values Source */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Copy className="size-3 text-muted-foreground" />
              Pre-fill Values From
            </Label>
            <SearchableSelect
              value={copyFromCardId}
              onChange={setCopyFromCardId}
              options={copyOptions}
              className="w-full text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-xs"
            >
              <Check className="size-4" />
              Create Card
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
