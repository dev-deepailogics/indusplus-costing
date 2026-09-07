"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ParametersService } from "../services/ParametersService";
import type { ParameterDef } from "../types";

export interface UseParameterTableFacadeReturn<T> {
  data: T | null;
  loading: boolean;
  handleSave: (next: T) => Promise<void>;
}

export function useParameterTableFacade<T>(slug: string): UseParameterTableFacadeReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = ParametersService.subscribeToTable<T>(
      slug,
      (nextData) => {
        setData(nextData);
        setLoading(false);
      },
      () => {
        setLoading(false);
        toast.error("Failed to load parameter data");
      }
    );
    return () => unsubscribe();
  }, [slug]);

  const handleSave = useCallback(
    async (next: T) => {
      setData(next);
      try {
        await ParametersService.saveTable(slug, next);
        toast.success("Changes saved");
      } catch (err) {
        console.error("Error saving table:", err);
        toast.error("Failed to save changes");
      }
    },
    [slug]
  );

  return {
    data,
    loading,
    handleSave,
  };
}
