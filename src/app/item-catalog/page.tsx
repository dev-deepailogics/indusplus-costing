"use client";

import { useEffect, useState } from "react";
import { Plus, Edit, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  FABRIC_COLLECTION,
  LINING_COLLECTION,
  subscribeToCatalog,
  addCatalogItem,
  updateCatalogItem,
  deleteCatalogItem,
} from "@/lib/item-catalog/firestore";
import type { CatalogItem } from "@/lib/item-catalog/types";

function CatalogSection({
  title,
  collectionName,
  placeholder,
}: {
  title: string;
  collectionName: string;
  placeholder: string;
}) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    return subscribeToCatalog(collectionName, (data) => {
      setItems(data);
      setLoading(false);
    });
  }, [collectionName]);

  async function handleAdd() {
    const name = newName.trim();
    if (!name) {
      toast.error("Please enter an item name");
      return;
    }
    try {
      await addCatalogItem(collectionName, name);
      setNewName("");
      toast.success(`${title} item added`);
    } catch (e) {
      console.error(e);
      toast.error("Failed to add item");
    }
  }

  async function handleSaveEdit(id: string) {
    const name = editingName.trim();
    if (!name) {
      toast.error("Please enter an item name");
      return;
    }
    try {
      await updateCatalogItem(collectionName, id, name);
      setEditingId(null);
      toast.success("Item updated");
    } catch (e) {
      console.error(e);
      toast.error("Failed to update item");
    }
  }

  async function handleDelete(id: string) {
    if (confirm("Are you sure you want to delete this item?")) {
      try {
        await deleteCatalogItem(collectionName, id);
        toast.success("Item deleted");
      } catch (e) {
        console.error(e);
        toast.error("Delete failed");
      }
    }
  }

  return (
    <Card className="shadow-md border-muted/60">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder={placeholder}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button size="sm" onClick={handleAdd} className="h-9 shrink-0">
            <Plus className="mr-1.5 size-4" /> Add
          </Button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No items yet.</div>
        ) : (
          <div className="divide-y rounded-lg border">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2">
                {editingId === item.id ? (
                  <>
                    <Input
                      className="h-8"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(item.id)}
                      autoFocus
                    />
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() => handleSaveEdit(item.id)}
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() => setEditingId(null)}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-sm font-medium">{item.name}</span>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8"
                        onClick={() => {
                          setEditingId(item.id);
                          setEditingName(item.name);
                        }}
                      >
                        <Edit className="size-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-8 text-destructive border-destructive/20 hover:bg-destructive/5"
                        onClick={() => handleDelete(item.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ItemCatalogPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Item Catalog</h1>
        <p className="text-sm text-muted-foreground">
          Manage the reusable list of fabric and lining items available across styles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CatalogSection
          title="Fabric Items"
          collectionName={FABRIC_COLLECTION}
          placeholder="e.g. FVG0562 Black IAF-3605"
        />
        <CatalogSection
          title="Lining Items"
          collectionName={LINING_COLLECTION}
          placeholder="e.g. IAF-34663%4% 65:35 PC"
        />
      </div>
    </div>
  );
}
