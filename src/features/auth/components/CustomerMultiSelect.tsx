"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronsUpDown, Search, X, Users, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CustomerMultiSelectProps {
  customers: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  variant?: "table" | "form";
  placeholder?: string;
}

export function CustomerMultiSelect({
  customers,
  selected,
  onChange,
  disabled = false,
  variant = "form",
  placeholder = "Select customers…",
}: CustomerMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [viewFilter, setViewFilter] = useState<"all" | "selected">("all");
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const buttonRef = useRef<HTMLButtonElement | HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateCoords = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownWidth = Math.max(340, rect.width);
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 16) {
      left = Math.max(16, rect.right - dropdownWidth);
    }
    let top = rect.bottom + 6;
    const dropdownHeight = 360;
    if (top + dropdownHeight > window.innerHeight - 16 && rect.top > dropdownHeight) {
      top = rect.top - dropdownHeight - 6;
    }
    setCoords({ top, left, width: dropdownWidth });
  }, []);

  useEffect(() => {
    if (open) {
      updateCoords();
      const handleScroll = () => updateCoords();
      const handleResize = () => updateCoords();
      window.addEventListener("scroll", handleScroll, true);
      window.addEventListener("resize", handleResize);
      return () => {
        window.removeEventListener("scroll", handleScroll, true);
        window.removeEventListener("resize", handleResize);
      };
    }
  }, [open, updateCoords]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const filteredCustomers = customers.filter((c) => {
    const matchesSearch = c.toLowerCase().includes(search.toLowerCase().trim());
    if (viewFilter === "selected") {
      return matchesSearch && selected.includes(c);
    }
    return matchesSearch;
  });

  function toggleCustomer(c: string) {
    if (selected.includes(c)) {
      onChange(selected.filter((item) => item !== c));
    } else {
      onChange([...selected, c]);
    }
  }

  function removeCustomer(c: string, e?: React.MouseEvent) {
    e?.stopPropagation();
    onChange(selected.filter((item) => item !== c));
  }

  function handleSelectAll() {
    onChange([...customers]);
  }

  function handleClearAll() {
    onChange([]);
  }

  // ── Render Dropdown Body via Portal ──
  const popoverContent = open && mounted && coords && (
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        zIndex: 9999,
      }}
      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-popover text-popover-foreground shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95 duration-150 flex flex-col max-h-[380px]"
    >
      {/* Search & Header */}
      <div className="p-2.5 space-y-2 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/60 shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer name…"
            className="h-8 pl-8 pr-7 text-xs bg-background border-slate-200 dark:border-slate-700"
            autoFocus
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2 top-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* View Filter Tabs & Counter */}
        <div className="flex items-center justify-between gap-1 text-[11px] pt-0.5">
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg">
            <button
              type="button"
              onClick={() => setViewFilter("all")}
              className={cn(
                "px-2 py-0.5 rounded-md font-medium transition-colors",
                viewFilter === "all"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({customers.length})
            </button>
            <button
              type="button"
              onClick={() => setViewFilter("selected")}
              className={cn(
                "px-2 py-0.5 rounded-md font-medium transition-colors flex items-center gap-1",
                viewFilter === "selected"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Selected ({selected.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selected.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-[11px] font-medium text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
            >
              Select all
            </button>
          </div>
        </div>
      </div>

      {/* Selected Items Quick Chips (if any selected) */}
      {selected.length > 0 && viewFilter === "all" && (
        <div className="px-2.5 py-1.5 bg-indigo-50/50 dark:bg-indigo-950/30 border-b border-indigo-100/60 dark:border-indigo-900/40 flex flex-wrap gap-1 max-h-20 overflow-y-auto shrink-0">
          {selected.map((c) => (
            <Badge
              key={c}
              variant="secondary"
              className="text-[10px] px-1.5 py-0 bg-indigo-100/80 dark:bg-indigo-900/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-800 font-medium flex items-center gap-1"
            >
              <span className="truncate max-w-[120px]">{c}</span>
              <button
                type="button"
                onClick={(e) => removeCustomer(c, e)}
                className="hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full p-0.5"
              >
                <X className="size-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Scrollable Customer List */}
      <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
        {filteredCustomers.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground space-y-1">
            <Users className="size-6 mx-auto opacity-30 text-slate-400" />
            <p>No matching customers.</p>
            {viewFilter === "selected" && (
              <button
                type="button"
                onClick={() => setViewFilter("all")}
                className="text-xs text-indigo-600 hover:underline font-medium"
              >
                Show all customers
              </button>
            )}
          </div>
        ) : (
          filteredCustomers.map((c) => {
            const isChecked = selected.includes(c);
            return (
              <div
                key={c}
                onClick={() => toggleCustomer(c)}
                className={cn(
                  "flex items-center justify-between px-2.5 py-2 rounded-lg text-xs cursor-pointer select-none transition-all",
                  isChecked
                    ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100 font-semibold border-l-2 border-indigo-600"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800/70 text-slate-700 dark:text-slate-300"
                )}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  <div
                    className={cn(
                      "size-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                      isChecked
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-slate-300 dark:border-slate-600 bg-background"
                    )}
                  >
                    {isChecked && <Check className="size-3 stroke-[3]" />}
                  </div>
                  <span className="truncate">{c}</span>
                </div>
                {isChecked && (
                  <Badge
                    variant="outline"
                    className="text-[9px] px-1.5 py-0 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 bg-indigo-100/40 shrink-0 font-bold"
                  >
                    Selected
                  </Badge>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Bar */}
      <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 flex items-center justify-between text-[11px] text-muted-foreground shrink-0">
        <span>
          <strong className="text-foreground">{selected.length}</strong> of {customers.length} selected
        </span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-2.5 py-1 rounded bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-colors shadow-2xs"
        >
          Done
        </button>
      </div>
    </div>
  );

  // ── Table Variant Trigger ──
  if (variant === "table") {
    return (
      <div className="relative inline-block text-left">
        <button
          ref={buttonRef as React.RefObject<HTMLButtonElement>}
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={cn(
            "h-8 max-w-[210px] inline-flex items-center justify-between gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-background px-2.5 text-xs font-medium shadow-2xs transition-all hover:border-indigo-400 focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
            open && "ring-2 ring-indigo-500/20 border-indigo-600"
          )}
          title={selected.length > 0 ? selected.join(", ") : "All Customers (All)"}
        >
          <span className="truncate">
            {selected.length === 0 ? (
              <span className="text-muted-foreground font-normal">All Customers (All)</span>
            ) : selected.length === 1 ? (
              <span className="font-semibold text-foreground">{selected[0]}</span>
            ) : (
              <span className="flex items-center gap-1">
                <span className="font-semibold text-foreground truncate max-w-[110px]">
                  {selected[0]}
                </span>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1 py-0 font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 shrink-0"
                >
                  +{selected.length - 1}
                </Badge>
              </span>
            )}
          </span>
          <ChevronsUpDown className="size-3 text-slate-400 shrink-0 ml-0.5 opacity-70" />
        </button>

        {mounted && popoverContent && createPortal(popoverContent, document.body)}
      </div>
    );
  }

  // ── Form Variant Trigger (Create / Edit Modal) ──
  return (
    <div className="space-y-1.5">
      <div
        ref={buttonRef as React.RefObject<HTMLDivElement>}
        onClick={() => !disabled && setOpen(!open)}
        className={cn(
          "min-h-9 w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-background px-3 py-1.5 text-sm shadow-2xs transition-all cursor-pointer flex items-center justify-between gap-1.5 hover:border-indigo-400",
          open && "ring-2 ring-indigo-500/20 border-indigo-600",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {selected.length === 0 ? (
            <span className="text-muted-foreground text-xs font-normal">
              {placeholder || "All Customers (No Restriction)"}
            </span>
          ) : (
            selected.map((c) => (
              <Badge
                key={c}
                variant="secondary"
                className="text-xs px-2 py-0.5 font-medium flex items-center gap-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800"
              >
                <span>{c}</span>
                <button
                  type="button"
                  onClick={(e) => removeCustomer(c, e)}
                  className="rounded-full hover:bg-indigo-200 dark:hover:bg-indigo-800 p-0.5 inline-flex items-center justify-center transition-colors"
                  title={`Remove ${c}`}
                >
                  <X className="size-3 text-indigo-600 dark:text-indigo-400" />
                </button>
              </Badge>
            ))
          )}
        </div>
        <ChevronsUpDown className="size-4 text-slate-400 shrink-0 opacity-70" />
      </div>

      {mounted && popoverContent && createPortal(popoverContent, document.body)}
    </div>
  );
}
