"use client";

import { useEffect } from "react";

/**
 * Global component that disables the browser's default behavior
 * of changing number input values when scrolling with the mouse wheel.
 */
export function DisableNumberInputScroll() {
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const activeEl = document.activeElement;
      if (activeEl instanceof HTMLInputElement && activeEl.type === "number") {
        activeEl.blur();
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, []);

  return null;
}
