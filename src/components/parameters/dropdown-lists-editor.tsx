"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DropdownListsData } from "@/lib/parameters/types";
import { PromptDialog } from "./prompt-dialog";
import { ConfirmDeleteDialog } from "./confirm-delete-dialog";

export function DropdownListsEditor({
  data,
  onSave,
}: {
  data: DropdownListsData;
  onSave: (data: DropdownListsData) => Promise<void>;
}) {
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<{ key: string; index: number } | null>(null);

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

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.lists.map((list) => (
        <Card key={list.key}>
          <CardHeader>
            <CardTitle className="text-base">{list.label}</CardTitle>
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
    </div>
  );
}
