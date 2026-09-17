"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, AlertCircle, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import type { DropdownListsData } from "@/lib/parameters/types";
import { PromptDialog } from "./prompt-dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

const COST_SHEET_FIELDS = [
  { value: "Style Category", label: "Style Category" },
  { value: "Order Type", label: "Order Type" },
  { value: "Wash Type", label: "Wash Type" },
  { value: "Costing Stage", label: "Costing Stage" },
  { value: "Country", label: "Country" },
  { value: "Payment Terms", label: "Payment Terms" },
  { value: "Shipment Mode", label: "Shipment Mode" },
  { value: "Delivery Terms", label: "Delivery Terms" },
  { value: "Inhouse Or Subcontract", label: "Inhouse Or Subcontract" },
  { value: "Merch Group", label: "Merch Group" },
  { value: "Delivery Destination", label: "Delivery Destination" },
  { value: "Chemical Costs", label: "Chemical Costs" },
  { value: "Special Charges", label: "Special Charges" },
];

export function DropdownListsEditor({
  data,
  onSave,
}: {
  data: DropdownListsData;
  onSave: (data: DropdownListsData) => Promise<void>;
}) {
  const [lists, setLists] = useState<DropdownListsData["lists"]>(data.lists || []);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ key: string; index: number } | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [newListField, setNewListField] = useState("");
  const [deletingListKey, setDeletingListKey] = useState<string | null>(null);

  // Sync local lists if external data updates and there are no unsaved changes
  useEffect(() => {
    if (hasChanges) return;
    setLists(data.lists || []);
  }, [data, hasChanges]);

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    if (!hasChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as Element).closest("a");
      if (target && target.href && target.origin === window.location.origin) {
        if (target.pathname !== window.location.pathname) {
          if (!window.confirm("You have unsaved changes. Are you sure you want to leave this page?")) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("click", handleClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("click", handleClick, true);
    };
  }, [hasChanges]);

  function updateItem(listKey: string, index: number, value: string) {
    setLists((prev) =>
      prev.map((l) =>
        l.key === listKey
          ? { ...l, items: l.items.map((it, i) => (i === index ? value : it)) }
          : l
      )
    );
    setHasChanges(true);
  }

  function addItem(listKey: string, value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setLists((prev) =>
      prev.map((l) =>
        l.key === listKey ? { ...l, items: [...l.items, trimmed] } : l
      )
    );
    setHasChanges(true);
  }

  function removeItem(listKey: string, index: number) {
    setLists((prev) =>
      prev.map((l) =>
        l.key === listKey ? { ...l, items: l.items.filter((_, i) => i !== index) } : l
      )
    );
    setHasChanges(true);
  }

  function addList(label: string) {
    const newKey = label.toLowerCase().replace(/[^a-z0-9]/g, "-");
    if (lists.some((l) => l.key === newKey)) {
      toast.error("A list with a similar name already exists");
      return;
    }
    setLists((prev) => [...prev, { key: newKey, label, items: [] }]);
    setHasChanges(true);
  }

  function removeList(key: string) {
    setLists((prev) => prev.filter((l) => l.key !== key));
    setHasChanges(true);
  }

  async function handleManualSave() {
    try {
      setIsSaving(true);
      await onSave({ lists });
      setHasChanges(false);
      toast.success("Dropdown lists saved successfully");
    } catch {
      toast.error("Failed to save dropdown lists");
    } finally {
      setIsSaving(false);
    }
  }

  const existingKeys = new Set(lists.map((l) => l.key.toLowerCase()));
  const existingLabels = new Set(lists.map((l) => l.label.toLowerCase()));

  const availableFieldOptions = COST_SHEET_FIELDS.filter((field) => {
    const fieldKey = field.value.toLowerCase().replace(/[^a-z0-9]/g, "-");
    const fieldLabel = field.label.toLowerCase();
    return !existingKeys.has(fieldKey) && !existingLabels.has(fieldLabel);
  });

  return (
    <div className="space-y-4">
      {/* Top action toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-foreground">
            {lists.length} Dropdown {lists.length === 1 ? "List" : "Lists"}
          </span>
          {hasChanges && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 px-2.5 py-0.5 rounded-full">
              <AlertCircle className="size-3.5" />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAddingList(true)}
            className="gap-1.5"
          >
            <Plus className="size-4" /> Add new list
          </Button>
          <Button
            size="sm"
            onClick={handleManualSave}
            disabled={isSaving || !hasChanges}
            className={
              hasChanges
                ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-xs"
                : "gap-1.5"
            }
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                {hasChanges ? <Check className="size-4" /> : <Save className="size-4" />} Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Grid of lists */}
      <div className="grid gap-4 md:grid-cols-2">
        {lists.map((list) => (
          <Card key={list.key}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base font-semibold">{list.label}</CardTitle>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeletingListKey(list.key)}
                  title="Delete list"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {list.items.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    className="h-8"
                    value={item}
                    onChange={(e) => updateItem(list.key, i, e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => setDeleting({ key: list.key, index: i })}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setAddingTo(list.key)}>
                <Plus className="size-3.5 mr-1" /> Add item
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Bottom action bar if changes exist or to add more */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
        <Button variant="outline" size="sm" onClick={() => setAddingList(true)}>
          <Plus className="mr-1.5 size-4" /> Add new list
        </Button>
        {hasChanges && (
          <Button
            size="sm"
            onClick={handleManualSave}
            disabled={isSaving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
          >
            {isSaving ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Check className="size-4" /> Save Changes
              </>
            )}
          </Button>
        )}
      </div>

      <PromptDialog
        open={addingTo !== null}
        onOpenChange={(open) => !open && setAddingTo(null)}
        title="Add item"
        label="Value"
        onSubmit={(value) => addingTo && addItem(addingTo, value)}
      />
      <ConfirmDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete item?"
        description="This cannot be undone."
        onConfirm={() => deleting && removeItem(deleting.key, deleting.index)}
      />

      <Dialog open={addingList} onOpenChange={setAddingList}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Cost Sheet Field</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {availableFieldOptions.length > 0 ? (
              <SearchableSelect
                options={availableFieldOptions}
                value={newListField}
                onChange={setNewListField}
                placeholder="Select a field..."
              />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                All available cost sheet fields are already connected.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingList(false)}>Cancel</Button>
            <Button
              disabled={!newListField || availableFieldOptions.length === 0}
              onClick={() => {
                if (newListField) {
                  addList(newListField);
                  setAddingList(false);
                  setNewListField("");
                }
              }}
            >
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDeleteDialog
        open={deletingListKey !== null}
        onOpenChange={(open) => !open && setDeletingListKey(null)}
        title="Delete list?"
        description="This will remove the list and all its items. This cannot be undone."
        onConfirm={() => deletingListKey && removeList(deletingListKey)}
      />
    </div>
  );
}
