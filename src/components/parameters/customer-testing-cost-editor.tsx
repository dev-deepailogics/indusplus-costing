"use client";

import { useEffect, useState, useMemo } from "react";
import type { CustomerTestingCostData } from "@/features/parameters/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, X, Sparkles, Check, Trash2, Edit3, Plus } from "lucide-react";
import { toast } from "sonner";

interface CustomerTestingCostEditorProps {
  data: CustomerTestingCostData;
  onSave: (data: CustomerTestingCostData) => Promise<void>;
  canCreate?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function CustomerTestingCostEditor({
  data,
  onSave,
  canCreate = true,
  canEdit = true,
  canDelete = true,
}: CustomerTestingCostEditorProps) {
  const [customerOptionsList, setCustomerOptionsList] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>("");
  const [customerRateInput, setCustomerRateInput] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch customer list from indus-plus DB
  useEffect(() => {
    fetch("/api/customers")
      .then((res) => res.json())
      .then((resData: { customers?: string[]; error?: string }) => {
        if (resData.customers && resData.customers.length > 0) {
          setCustomerOptionsList(resData.customers);
        }
      })
      .catch((err) => console.error("[CustomerTestingCostEditor] Failed to load customers:", err));
  }, []);

  // Compute all unique available customer names
  const allCustomerNames = useMemo(() => {
    const set = new Set<string>();
    customerOptionsList.forEach((c) => c && set.add(c.trim()));
    if (data?.customerRates) {
      Object.keys(data.customerRates).forEach((c) => c && set.add(c.trim()));
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [customerOptionsList, data?.customerRates]);

  // Searchable select options
  const customerSelectOptions: SearchableSelectOption[] = useMemo(() => {
    return allCustomerNames.map((cust) => {
      const existingVal = data?.customerRates?.[cust];
      return {
        value: cust,
        label: `${cust}${existingVal !== undefined ? ` — (Rs. ${existingVal}/SAM)` : ""}`,
      };
    });
  }, [allCustomerNames, data?.customerRates]);

  function handleOpenAddModal(cust?: string) {
    const targetCust = cust || "";
    setSelectedCustomer(targetCust);
    const existingRate = targetCust && data?.customerRates?.[targetCust] !== undefined
      ? String(data.customerRates[targetCust])
      : "";
    setCustomerRateInput(existingRate);
    setIsModalOpen(true);
  }

  function handleSelectCustomer(cust: string) {
    if (!cust) return;
    handleOpenAddModal(cust);
  }

  async function handleSaveCustomerRate() {
    if (!selectedCustomer) {
      toast.error("Please select a customer first.");
      return;
    }
    const cleanRate = parseFloat(customerRateInput.trim());
    if (isNaN(cleanRate) || cleanRate < 0) {
      toast.error("Please enter a valid non-negative rate in PKR (e.g. 0.25).");
      return;
    }

    setIsSaving(true);
    try {
      const updatedRates = {
        ...(data?.customerRates || {}),
        [selectedCustomer.trim()]: cleanRate,
      };

      await onSave({
        customerRates: updatedRates,
        defaultRate: data?.defaultRate ?? 0,
      });

      toast.success(`Testing cost rate for ${selectedCustomer} set to Rs. ${cleanRate.toFixed(4)} / SAM`);
      setIsModalOpen(false);
      setSelectedCustomer("");
      setCustomerRateInput("");
    } catch (err) {
      console.error("[handleSaveCustomerRate] error:", err);
      toast.error("Failed to save customer testing cost rate.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteCustomerRate(cust: string) {
    if (!confirm(`Remove testing cost rate for "${cust}"?`)) return;

    try {
      const updatedRates = { ...(data?.customerRates || {}) };
      delete updatedRates[cust];

      await onSave({
        customerRates: updatedRates,
        defaultRate: data?.defaultRate ?? 0,
      });

      toast.success(`Removed testing cost rate for ${cust}`);
      if (isModalOpen && selectedCustomer === cust) {
        setIsModalOpen(false);
      }
    } catch (err) {
      console.error("[handleDeleteCustomerRate] error:", err);
      toast.error("Failed to remove customer testing cost rate.");
    }
  }

  const configuredEntries = Object.entries(data?.customerRates || {}).sort(([a], [b]) => a.localeCompare(b));
  const existingModalRate = selectedCustomer && data?.customerRates?.[selectedCustomer] !== undefined
    ? `Rs. ${Number(data.customerRates[selectedCustomer]).toFixed(4)} / SAM`
    : null;

  return (
    <div className="space-y-4">
      {/* ── Top Controls Bar (Matching ProcessMatrixEditor / Rejection Grid) ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-muted/40 p-3 rounded-xl border">
        <div className="flex items-center gap-2">
          <Building2 className="size-4 text-primary shrink-0" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
            Customer:
          </span>
          <div className="w-64 sm:w-80">
            <SearchableSelect
              options={customerSelectOptions}
              value={selectedCustomer}
              onChange={handleSelectCustomer}
              placeholder="Search or Select Customer..."
              className="bg-background text-xs h-8 font-semibold"
            />
          </div>
        </div>

        {canCreate && (
          <Button
            size="sm"
            onClick={() => handleOpenAddModal()}
            className="h-8 text-xs font-semibold px-3.5 cursor-pointer gap-1.5 self-end sm:self-auto"
          >
            <Plus className="size-3.5" />
            Add Customer Rate
          </Button>
        )}
      </div>



      {/* ── Detailed Table View ── */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="py-2.5 px-4 bg-muted/20 border-b flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Configured Customer Rates
            </span>
            <Badge variant="secondary" className="text-[11px] px-1.5 py-0 font-bold">
              {configuredEntries.length}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            Testing Cost = Rate per SAM × Style SAM
          </span>
        </div>

        {configuredEntries.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground space-y-2">
            <Building2 className="size-8 mx-auto opacity-30" />
            <p className="text-sm font-medium">No customer-specific testing rates defined yet.</p>
            <p className="text-xs text-muted-foreground">
              Select a customer above or click &quot;Add Customer Rate&quot; to configure.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="w-12 text-center text-xs font-bold">#</TableHead>
                <TableHead className="text-xs font-bold">Customer Name</TableHead>
                <TableHead className="w-64 text-right text-xs font-bold">Rate (PKR / SAM)</TableHead>
                <TableHead className="w-28 text-center text-xs font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {configuredEntries.map(([cust, rate], idx) => (
                <TableRow key={cust} className="hover:bg-muted/10 transition-colors">
                  <TableCell className="text-center text-xs text-muted-foreground font-mono">
                    {idx + 1}
                  </TableCell>
                  <TableCell className="font-semibold text-xs text-foreground flex items-center gap-2 py-2.5">
                    <Building2 className="size-3.5 text-muted-foreground shrink-0" />
                    <span>{cust}</span>
                  </TableCell>
                  <TableCell className="text-right text-xs font-mono font-bold text-primary py-2.5">
                    Rs. {Number(rate).toFixed(4)}
                  </TableCell>
                  <TableCell className="text-center py-2.5">
                    <div className="flex items-center justify-center gap-1">
                      {canEdit && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                          title="Edit Rate"
                          onClick={() => handleOpenAddModal(cust)}
                        >
                          <Edit3 className="size-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7 hover:bg-red-50 dark:hover:bg-red-950/50 text-red-500 cursor-pointer"
                          title="Delete Rate"
                          onClick={() => handleDeleteCustomerRate(cust)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ── Modal Dialog for Setting Customer Testing Rate (Matching ProcessMatrixEditor) ── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Building2 className="size-5 text-primary" />
              <span>Customer Testing Rate: {selectedCustomer || "Select Customer"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Set the testing charge rate in <strong>PKR per SAM</strong> for this customer. During cost sheet calculation, this rate is multiplied by the style’s Sewing SAM to auto-populate Special Charges.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {!selectedCustomer && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Customer Name
                </label>
                <SearchableSelect
                  className="w-full text-xs font-semibold"
                  placeholder="Choose customer from database..."
                  options={allCustomerNames.map((c) => ({ value: c, label: c }))}
                  value={selectedCustomer}
                  onChange={setSelectedCustomer}
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Rate (PKR / SAM)
              </label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="e.g. 0.25"
                  className="h-10 text-base font-mono font-bold pl-9 text-left disabled:opacity-60 disabled:cursor-not-allowed"
                  value={customerRateInput}
                  onChange={(e) => setCustomerRateInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canEdit) handleSaveCustomerRate();
                  }}
                  disabled={!canEdit || isSaving}
                  autoFocus
                />
                <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground pointer-events-none">
                  Rs.
                </span>
              </div>
            </div>

            {existingModalRate ? (
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between">
                <span>
                  Current configured rate: <strong>{existingModalRate}</strong>
                </span>
                <Badge variant="outline" className="border-amber-400 text-amber-800 dark:text-amber-300 text-[10px]">
                  Configured
                </Badge>
              </div>
            ) : (
              <div className="p-2.5 bg-slate-50 dark:bg-slate-900 border rounded-lg text-xs text-muted-foreground">
                No custom rate set yet for this customer.
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-row items-center justify-between gap-2 sm:justify-between">
            {existingModalRate && canDelete ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
                onClick={() => handleDeleteCustomerRate(selectedCustomer)}
                disabled={isSaving}
              >
                <Trash2 className="size-3.5 mr-1" /> Remove Rate
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => setIsModalOpen(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              {canEdit && (
                <Button
                  type="button"
                  size="sm"
                  className="text-xs font-bold"
                  onClick={handleSaveCustomerRate}
                  disabled={isSaving}
                >
                  <Check className="size-3.5 mr-1" />
                  {isSaving ? "Saving..." : "Save Rate"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
