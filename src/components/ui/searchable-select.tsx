"use client";

import { useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  className,
  align = "left",
}: {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  align?: "left" | "right";
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );

  const displayVal = open ? query : selected ? selected.label : value || "";

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block", className || "w-32")}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) {
          setOpen(false);
          setQuery("");
        }
      }}
    >
      <div className="relative flex items-center w-full h-7">
        <input
          ref={inputRef}
          type="text"
          className="w-full h-7 pl-2 pr-6 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-left truncate focus:bg-white focus:outline-none transition-colors"
          placeholder={placeholder}
          value={displayVal}
          title={selected ? selected.label : value || ""}
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onClick={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <ChevronDown className="w-3.5 h-3.5" />
        </div>
      </div>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 max-h-60 min-w-full w-[320px] max-w-[380px] overflow-auto rounded-md border border-slate-200 bg-white dark:bg-slate-900 shadow-xl py-1",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {value && (
            <button
              type="button"
              className="flex items-center gap-1.5 w-full px-3 py-1.5 text-left text-xs italic text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange("");
                setOpen(false);
                setQuery("");
              }}
            >
              <X className="w-3 h-3" />
              -- Clear Selection --
            </button>
          )}
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No matches found
            </div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.value}
                type="button"
                className={cn(
                  "block w-full truncate px-3 py-1.5 text-left text-xs hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors",
                  o.value === value &&
                    "bg-blue-50/80 dark:bg-blue-950/60 font-bold text-blue-700 dark:text-blue-300",
                )}
                title={o.label}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o.value);
                  setOpen(false);
                  setQuery("");
                }}
              >
                {o.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
