"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { WorkOrdersService } from "../services/WorkOrdersService";
import type { WorkOrderItem } from "../types";
import { subscribeToStyles } from "@/lib/style-master/firestore";
import type { StyleMasterItem } from "@/lib/style-master/types";

export interface UseWorkOrdersFacadeReturn {
  workOrders: WorkOrderItem[];
  filteredWorkOrders: WorkOrderItem[];
  styles: StyleMasterItem[];
  loading: boolean;
  search: string;
  setSearch: (search: string) => void;
  dialogOpen: boolean;
  editingWorkOrder: WorkOrderItem | null;
  formId: string;
  setFormId: (id: string) => void;
  formStyleId: string;
  setFormStyleId: (styleId: string) => void;
  styleLabel: (styleId: string) => string;
  openAddDialog: () => void;
  openEditDialog: (wo: WorkOrderItem) => void;
  closeDialog: () => void;
  handleSubmit: () => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
}

export function useWorkOrdersFacade(): UseWorkOrdersFacadeReturn {
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>([]);
  const [styles, setStyles] = useState<StyleMasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrderItem | null>(null);
  const [formId, setFormId] = useState("");
  const [formStyleId, setFormStyleId] = useState("");

  useEffect(() => {
    setLoading(true);
    const unsubWO = WorkOrdersService.subscribe(
      (data) => {
        setWorkOrders(data);
        setLoading(false);
      },
      () => {
        setLoading(false);
        toast.error("Failed to load work orders");
      }
    );

    const unsubStyles = subscribeToStyles((data) => setStyles(data));

    return () => {
      unsubWO();
      unsubStyles();
    };
  }, []);

  const styleLabel = useCallback(
    (styleId: string): string => {
      const style = styles.find((s) => s.id === styleId);
      return style ? `${style.id} - ${style.styleName}` : styleId;
    },
    [styles]
  );

  const filteredWorkOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workOrders;
    return workOrders.filter((wo) => {
      const label = styleLabel(wo.styleId).toLowerCase();
      return wo.id.toLowerCase().includes(q) || label.includes(q);
    });
  }, [workOrders, search, styleLabel]);

  const openAddDialog = useCallback(() => {
    setEditingWorkOrder(null);
    setFormId("");
    setFormStyleId("");
    setDialogOpen(true);
  }, []);

  const openEditDialog = useCallback((wo: WorkOrderItem) => {
    setEditingWorkOrder(wo);
    setFormId(wo.id);
    setFormStyleId(wo.styleId);
    setDialogOpen(true);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setEditingWorkOrder(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmedId = formId.trim();
    if (!trimmedId) {
      toast.error("Please enter a work order number");
      return;
    }
    if (!formStyleId) {
      toast.error("Please select a style");
      return;
    }
    if (!editingWorkOrder && workOrders.some((w) => w.id === trimmedId)) {
      toast.error("A work order with this number already exists");
      return;
    }
    try {
      await WorkOrdersService.save({ id: trimmedId, styleId: formStyleId });
      toast.success(editingWorkOrder ? "Work order updated" : "Work order added");
      setDialogOpen(false);
    } catch (e) {
      console.error("Error saving work order:", e);
      toast.error("Failed to save work order");
    }
  }, [editingWorkOrder, formId, formStyleId, workOrders]);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm("Are you sure you want to delete this work order?")) return;
    try {
      await WorkOrdersService.delete(id);
      toast.success("Work order deleted");
    } catch (e) {
      console.error("Error deleting work order:", e);
      toast.error("Delete failed");
    }
  }, []);

  return {
    workOrders,
    filteredWorkOrders,
    styles,
    loading,
    search,
    setSearch,
    dialogOpen,
    editingWorkOrder,
    formId,
    setFormId,
    formStyleId,
    setFormStyleId,
    styleLabel,
    openAddDialog,
    openEditDialog,
    closeDialog,
    handleSubmit,
    handleDelete,
  };
}
