"use client";

import { useState } from "react";
import { Plus, Trash2, Edit2 } from "lucide-react";
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
];

export function DropdownListsEditor({
  data,
  onSave,
}: {
  data: DropdownListsData;
  onSave: (data: DropdownListsData) => Promise<void>;
}) {
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ key: string; index: number } | null>(null);
  const [addingList, setAddingList] = useState(false);
  const [newListField, setNewListField] = useState("");
  const [editingList, setEditingList] = useState<{ key: string; label: string } | null>(null);
  const [deletingListKey, setDeletingListKey] = useState<string | null>(null);

  function updateItem(listKey: string, index: number, value: string) {
    const next: DropdownListsData = {
      lists: data.lists.map((l) =>
        l.key === listKey
          ? { ...l, items: l.items.map((it, i) => (i === index ? value : it)) }
          : l
      ),
    };
    onSave(next);
  }

  function addItem(listKey: string, value: string) {
    const next: DropdownListsData = {
      lists: data.lists.map((l) =>
        l.key === listKey ? { ...l, items: [...l.items, value] } : l
      ),
    };
    onSave(next).then(() => toast.success("Item added"));
  }

  function removeItem(listKey: string, index: number) {
    const next: DropdownListsData = {
      lists: data.lists.map((l) =>
        l.key === listKey ? { ...l, items: l.items.filter((_, i) => i !== index) } : l
      ),
    };
    onSave(next).then(() => toast.success("Item deleted"));
  }

  function addList(label: string) {
    const newKey = label.toLowerCase().replace(/[^a-z0-9]/g, "-");
    if (data.lists.some((l) => l.key === newKey)) {
      toast.error("A list with a similar name already exists");
      return;
    }
    const next: DropdownListsData = {
      lists: [...data.lists, { key: newKey, label, items: [] }],
    };
    onSave(next).then(() => toast.success("List added"));
  }

  function updateList(key: string, newLabel: string) {
    const next: DropdownListsData = {
      lists: data.lists.map((l) =>
        l.key === key ? { ...l, label: newLabel } : l
      ),
    };
    onSave(next).then(() => toast.success("List updated"));
  }

  function removeList(key: string) {
    const next: DropdownListsData = {
      lists: data.lists.filter((l) => l.key !== key),
    };
    onSave(next).then(() => toast.success("List deleted"));
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.lists.map((list) => (
        <Card key={list.key}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">{list.label}</CardTitle>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setEditingList({ key: list.key, label: list.label })}
              >
                <Edit2 className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setDeletingListKey(list.key)}
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
                  defaultValue={item}
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
              <Plus /> Add item
            </Button>
          </CardContent>
        </Card>
      ))}

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
      
      <div className="md:col-span-2 flex justify-center mt-4">
        <Button onClick={() => setAddingList(true)}>
          <Plus className="mr-2 size-4" /> Add new list
        </Button>
      </div>

      <Dialog open={addingList} onOpenChange={setAddingList}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Cost Sheet Field</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <SearchableSelect
              options={COST_SHEET_FIELDS}
              value={newListField}
              onChange={setNewListField}
              placeholder="Select a field..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddingList(false)}>Cancel</Button>
            <Button onClick={() => {
              if (newListField) {
                addList(newListField);
                setAddingList(false);
                setNewListField("");
              }
            }}>Connect</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PromptDialog
        open={editingList !== null}
        onOpenChange={(open) => !open && setEditingList(null)}
        title="Edit list name"
        label="List Name"
        defaultValue={editingList?.label}
        onSubmit={(value) => editingList && updateList(editingList.key, value)}
      />
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
