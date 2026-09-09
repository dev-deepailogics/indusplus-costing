"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
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
  const [mounted, setMounted] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const calculatePosition = () => {
    if (!inputRef.current) return null;
    const rect = inputRef.current.getBoundingClientRect();
    const dropdownWidth = Math.max(rect.width, 340);
    let left = align === "right" ? rect.right - dropdownWidth : rect.left;

    // Viewport overflow boundary guards
    if (typeof window !== "undefined") {
      if (left + dropdownWidth > window.innerWidth - 12) {
        left = window.innerWidth - dropdownWidth - 12;
      }
      if (left < 12) left = 12;

      return {
        top: rect.bottom + window.scrollY + 4,
        left: left + window.scrollX,
        width: dropdownWidth,
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
    setOpen(true);
    setQuery("");
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

  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase()),
  );

  const displayVal = open ? query : selected ? selected.label : value || "";

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block", className || "w-32")}
    >
      <div className="relative flex items-center w-full h-7">
        <input
          ref={inputRef}
          type="text"
          className="w-full h-7 pl-2 pr-6 text-xs border border-slate-200 bg-slate-100/80 hover:bg-slate-100/95 font-semibold rounded text-left truncate focus:bg-white focus:outline-none transition-colors"
          placeholder={placeholder}
          value={displayVal}
          title={selected ? selected.label : value || ""}
          onFocus={handleOpen}
          onClick={handleOpen}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
          <ChevronDown className="w-3.5 h-3.5" />
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
              width: `${coords.width}px`,
              zIndex: 999999,
            }}
            className="max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white dark:bg-slate-900 shadow-2xl py-1 text-slate-800 dark:text-slate-100 animate-in fade-in-50 zoom-in-95 duration-100"
          >
            {filtered.length === 0 ? (
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
                      "block w-full truncate px-3 py-1.5 text-left text-xs transition-colors hover:bg-blue-50 dark:hover:bg-blue-950/40",
                      isDefaultOption &&
                        "font-bold text-blue-600 dark:text-blue-400 border-b border-slate-100 dark:border-slate-800",
                      !isDefaultOption &&
                        o.value === value &&
                        "bg-blue-50/80 dark:bg-blue-950/60 font-bold text-blue-700 dark:text-blue-300"
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
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
