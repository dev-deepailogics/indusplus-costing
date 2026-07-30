"use client";

import { useEffect, useState } from "react";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";

import { subscribeToWorkOrders, saveWorkOrder, deleteWorkOrder } from "@/lib/work-orders/firestore";
import type { WorkOrderItem } from "@/lib/work-orders/types";
import { subscribeToStyles } from "@/lib/style-master/firestore";
import type { StyleMasterItem } from "@/lib/style-master/types";

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrderItem[]>([]);
  const [styles, setStyles] = useState<StyleMasterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingWorkOrder, setEditingWorkOrder] = useState<WorkOrderItem | null>(null);
  const [formId, setFormId] = useState("");
  const [formStyleId, setFormStyleId] = useState("");

  useEffect(() => {
    const unsubWO = subscribeToWorkOrders((data) => {
      setWorkOrders(data);
      setLoading(false);
    });
    const unsubStyles = subscribeToStyles((data) => setStyles(data));
    return () => {
      unsubWO();
      unsubStyles();
    };
  }, []);

  function styleLabel(styleId: string) {
    const style = styles.find((s) => s.id === styleId);
    return style ? `${style.id} - ${style.styleName}` : styleId;
  }

  function openAddDialog() {
    setEditingWorkOrder(null);
    setFormId("");
    setFormStyleId("");
    setDialogOpen(true);
  }

  function openEditDialog(wo: WorkOrderItem) {
    setEditingWorkOrder(wo);
    setFormId(wo.id);
    setFormStyleId(wo.styleId);
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!formId.trim()) {
      toast.error("Please enter a work order number");
      return;
    }
    if (!formStyleId) {
      toast.error("Please select a style");
      return;
    }
    if (!editingWorkOrder && workOrders.some((w) => w.id === formId.trim())) {
      toast.error("A work order with this number already exists");
      return;
    }
    try {
      await saveWorkOrder({ id: formId.trim(), styleId: formStyleId });
      toast.success(editingWorkOrder ? "Work order updated" : "Work order added");
      setDialogOpen(false);
    } catch (e) {
      console.error(e);
      toast.error("Failed to save work order");
    }
  }

  async function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this work order?")) {
      try {
        await deleteWorkOrder(id);
        toast.success("Work order deleted");
      } catch (e) {
        console.error(e);
        toast.error("Delete failed");
      }
    }
  }

  const filtered = workOrders.filter((w) => {
    const q = search.toLowerCase();
    return w.id.toLowerCase().includes(q) || styleLabel(w.styleId).toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Work Orders</h1>
          <p className="text-sm text-muted-foreground">
            Each work order links to a single apparel style. A style can be used by multiple work orders.
          </p>
        </div>
        <Button size="sm" onClick={openAddDialog} className="h-9">
          <Plus className="mr-1.5 size-4" /> Add Work Order
        </Button>
      </div>

      <Card className="bg-card/50 backdrop-blur-sm border-muted/60">
        <CardContent className="p-4">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by Work Order No. or Style..."
              className="pl-9 h-9 w-full"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md border-muted/60">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Loading work orders…
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No work orders found.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-semibold text-foreground">Work Order No.</TableHead>
                  <TableHead className="font-semibold text-foreground">Style</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((wo) => (
                  <TableRow key={wo.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium text-primary">{wo.id}</TableCell>
                    <TableCell>{styleLabel(wo.styleId)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          onClick={() => openEditDialog(wo)}
                          title="Edit Work Order"
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 text-destructive border-destructive/20 hover:bg-destructive/5"
                          onClick={() => handleDelete(wo.id)}
                          title="Delete Work Order"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingWorkOrder ? "Edit Work Order" : "Add Work Order"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">
                Work Order No.
              </label>
              <Input
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                placeholder="e.g. WO-1001"
                disabled={!!editingWorkOrder}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Style</label>
              <SearchableSelect
                className="h-9 text-sm"
                placeholder="Search styles..."
                value={formStyleId}
                onChange={setFormStyleId}
                options={styles.map((s) => ({
                  value: s.id,
                  label: `${s.id} - ${s.styleName}`,
                }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              {editingWorkOrder ? "Save Changes" : "Add Work Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
