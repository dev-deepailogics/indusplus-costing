"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Save, Check, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DropdownListsData } from "../types";
import { PromptDialog } from "./PromptDialog";
import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

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

  useEffect(() => {
    if (hasChanges) return;
    setLists(data.lists || []);
  }, [data, hasChanges]);

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold">
            {lists.length} Dropdown Lists
          </span>
          {hasChanges && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full">
              <AlertCircle className="size-3.5" />
              Unsaved changes
            </span>
          )}
        </div>
        <Button
          size="sm"
          onClick={handleManualSave}
          disabled={isSaving || !hasChanges}
          className={
            hasChanges
              ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
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

      <div className="grid gap-4 md:grid-cols-2">
        {lists.map((list) => (
          <Card key={list.key}>
            <CardHeader>
              <CardTitle className="text-base">{list.label}</CardTitle>
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
                <Plus className="mr-1.5 size-4" /> Add item
              </Button>
            </CardContent>
          </Card>
        ))}
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
    </div>
  );
}
