"use client";

import React, { useEffect, useRef, useState } from "react";
import { Pipette, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESETS = [
  { name: "Sky Blue", value: "#a0d9ef" },
  { name: "Soft Pink", value: "#FFC0CB" },
];

export function ThemeColorToggle({ className }: { className?: string }) {
  const [currentColor, setCurrentColor] = useState<string>("#a0d9ef");
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Read persisted theme or default to #a0d9ef
    const saved = localStorage.getItem("app_bg_theme") || "#a0d9ef";
    applyColor(saved);
  }, []);

  const applyColor = (color: string) => {
    setCurrentColor(color);
    localStorage.setItem("app_bg_theme", color);

    // Apply directly to root CSS variables for instant whole-site reactivity
    document.documentElement.style.setProperty("--background", color);
    document.documentElement.style.setProperty("--sidebar", color);
    document.documentElement.removeAttribute("data-theme");
  };

  const handleCustomColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value;
    applyColor(hex);
  };

  const handleReset = () => {
    applyColor("#a0d9ef");
  };

  const isPresetActive = (val: string) =>
    currentColor.toLowerCase() === val.toLowerCase();

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 p-1 rounded-full border border-black/20 bg-background/95 shadow-sm backdrop-blur-xs select-none",
        className
      )}
      title="Customize website background color"
    >
      {/* Preset Buttons */}
      {PRESETS.map((preset) => {
        const active = isPresetActive(preset.value);
        return (
          <button
            key={preset.value}
            type="button"
            onClick={() => applyColor(preset.value)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer",
              active
                ? "text-slate-900 shadow-xs border border-black/30 ring-1 ring-black/25"
                : "text-muted-foreground hover:text-foreground opacity-75 hover:opacity-100"
            )}
            style={active ? { backgroundColor: preset.value } : undefined}
          >
            <span
              className="size-3 rounded-full border border-black/30 shadow-2xs inline-block shrink-0"
              style={{ backgroundColor: preset.value }}
            />
            <span>{preset.name.split(" ")[1] || preset.name}</span>
          </button>
        );
      })}

      {/* Color Picker Button */}
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => colorInputRef.current?.click()}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer border",
            !PRESETS.some((p) => isPresetActive(p.value))
              ? "text-slate-900 shadow-xs border-black/40 ring-1 ring-black/25"
              : "border-black/20 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground"
          )}
          style={
            !PRESETS.some((p) => isPresetActive(p.value))
              ? { backgroundColor: currentColor }
              : undefined
          }
          title="Pick any custom background color"
        >
          <Pipette className="size-3.5 shrink-0" />
          <span>Color Picker</span>
        </button>

        {/* Hidden native HTML5 Color Input */}
        <input
          ref={colorInputRef}
          type="color"
          value={currentColor.startsWith("#") ? currentColor : "#a0d9ef"}
          onChange={handleCustomColorChange}
          className="sr-only opacity-0 absolute pointer-events-none"
          tabIndex={-1}
          aria-label="Pick custom background color"
        />
      </div>

      {/* Reset button if custom color is active */}
      {!isPresetActive("#a0d9ef") && (
        <button
          type="button"
          onClick={handleReset}
          className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/10 transition-colors cursor-pointer"
          title="Reset to default Sky Blue"
        >
          <RotateCcw className="size-3" />
        </button>
      )}
    </div>
  );
}
