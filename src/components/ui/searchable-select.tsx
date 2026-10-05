"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  subLabel?: string;
  searchKey?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  className,
  align = "left",
  disabled,
  allowCustom,
}: {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
  disabled?: boolean;
  allowCustom?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; minWidth: number; maxWidth: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounce search input when typing stops (200ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const calculatePosition = () => {
    if (!inputRef.current) return null;
    const rect = inputRef.current.getBoundingClientRect();
    const minWidth = Math.max(rect.width, 380);
    const viewportWidth = typeof window !== "undefined" ? window.innerWidth : 1200;
    const maxWidth = Math.min(680, viewportWidth - 24);
    let left = align === "right" ? rect.right - minWidth : rect.left;

    // Viewport overflow boundary guards
    if (typeof window !== "undefined") {
      if (left + minWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - minWidth - 12);
      }
      if (left < 12) left = 12;

      return {
        top: rect.bottom + window.scrollY + 4,
        left: left + window.scrollX,
        minWidth,
        maxWidth,
      };
    }
    return null;
  };

  const updatePosition = () => {
    const nextCoords = calculatePosition();
    if (nextCoords) {
      setCoords(nextCoords);
    }
  };

  const handleOpen = () => {
    const initialCoords = calculatePosition();
    if (initialCoords) {
      setCoords(initialCoords);
    }
    if (!open) {
      setOpen(true);
      setQuery("");
      setDebouncedQuery("");
    }
  };

  useLayoutEffect(() => {
    if (open) {
      updatePosition();
    }
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    const handleScrollOrResize = () => {
      updatePosition();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current?.contains(e.target as Node) ||
        dropdownRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
      setQuery("");
      setDebouncedQuery("");
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value || (value && o.label === value));

  const filtered = (() => {
    const q = debouncedQuery.toLowerCase().trim();
    if (!q) {
      // Default: show first 120 items when not searching
      return options.slice(0, 120);
    }

    const words = q.split(/\s+/).filter(Boolean);
    const results: SearchableSelectOption[] = [];

    for (const o of options) {
      const isDefaultOption = o.value === "" || o.label.startsWith("--");
      if (isDefaultOption) {
        results.push(o);
        continue;
      }

      const label = (o.label || "").toLowerCase();
      const val = (o.value || "").toLowerCase();
      const sub = (o.subLabel || "").toLowerCase();
      const search = (o.searchKey || "").toLowerCase();
      const combined = `${label} ${val} ${sub} ${search}`;

      const allMatch = words.every((w) => combined.includes(w));
      if (allMatch) {
        results.push(o);
        if (results.length >= 200) break; // Limit rendering for high performance
      }
    }

    return results;
  })();

  const hasExactMatch = options.some(
    (o) =>
      o.label.trim().toLowerCase() === debouncedQuery.trim().toLowerCase() ||
      o.value.trim().toLowerCase() === debouncedQuery.trim().toLowerCase() ||
      (o.subLabel && o.subLabel.trim().toLowerCase() === debouncedQuery.trim().toLowerCase())
  );

  const displayVal = open ? query : selected ? selected.label : value || "";

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block", className || "w-32")}
    >
      <div className="relative flex items-center w-full h-6">
        <input
          ref={inputRef}
          type="text"
          className={cn(
            "w-full h-6 pl-1.5 pr-5 text-xs rounded text-left truncate transition-all outline-none",
            disabled
              ? "bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed select-none shadow-none"
              : "bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 shadow-2xs hover:border-blue-500 focus:border-blue-600 focus:ring-1 focus:ring-blue-500/25 cursor-pointer font-medium"
          )}
          placeholder={placeholder}
          value={displayVal}
          disabled={disabled}
          title={selected ? (selected.subLabel ? `${selected.label} (${selected.subLabel})` : selected.label) : value || ""}
          onFocus={handleOpen}
          onClick={handleOpen}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && allowCustom && query.trim()) {
              e.preventDefault();
              onChange(query.trim());
              setOpen(false);
              setQuery("");
            }
          }}
        />
        <div className={cn(
          "absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none transition-colors",
          disabled ? "text-slate-300 dark:text-slate-600" : "text-slate-400 dark:text-slate-400"
        )}>
          <ChevronDown className="w-3 h-3" />
        </div>
      </div>

      {open &&
        mounted &&
        coords &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: "absolute",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              minWidth: `${coords.minWidth}px`,
              maxWidth: `${coords.maxWidth}px`,
              width: "max-content",
              zIndex: 999999,
            }}
            className="max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white dark:bg-slate-900 shadow-2xl py-1 text-slate-800 dark:text-slate-100 animate-in fade-in-50 zoom-in-95 duration-100"
          >
            {allowCustom && query.trim() && !hasExactMatch && (
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/80 border-b border-blue-200 dark:border-blue-800 transition-colors whitespace-normal break-words"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(query.trim());
                  setOpen(false);
                  setQuery("");
                }}
              >
                ➕ Use &quot;{query.trim()}&quot; (Custom)
              </button>
            )}

            {filtered.length === 0 && (!allowCustom || !query.trim()) ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No matches found
              </div>
            ) : (
              filtered.map((o) => {
                const isDefaultOption = o.value === "" || o.label.startsWith("--");
                return (
                  <button
                    key={o.value || "__empty__"}
                    type="button"
                    className={cn(
                      "block w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/40",
                      isDefaultOption &&
                        "font-bold text-blue-600 dark:text-blue-400 border-b border-slate-100 dark:border-slate-800",
                      !isDefaultOption &&
                        o.value === value &&
                        "bg-blue-50/80 dark:bg-blue-950/60 font-bold text-blue-700 dark:text-blue-300"
                    )}
                    title={o.subLabel ? `${o.label} (${o.subLabel})` : o.label}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (o.value !== value) {
                        onChange(o.value);
                      }
                      setOpen(false);
                      setQuery("");
                      setDebouncedQuery("");
                    }}
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="whitespace-normal break-words leading-snug">{o.label}</span>
                      {o.subLabel && !isDefaultOption && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono whitespace-normal break-words mt-0.5">
                          {o.subLabel}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
