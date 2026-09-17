"use client";

import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useItemCatalogFacade } from "../hooks/useItemCatalogFacade";
import { CatalogItemRow } from "./CatalogItemRow";
import type { CatalogCollectionName } from "../types";

interface CatalogSectionProps {
  title: string;
  collectionName: CatalogCollectionName;
  placeholder: string;
}

export function CatalogSection({
  title,
  collectionName,
  placeholder,
}: CatalogSectionProps) {
  const {
    items,
    loading,
    newName,
    setNewName,
    editingId,
    editingName,
    setEditingName,
    startEditing,
    cancelEditing,
    handleAddItem,
    handleSaveEdit,
    handleDeleteItem,
  } = useItemCatalogFacade(collectionName);

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
            onKeyDown={(e) => e.key === "Enter" && handleAddItem(title)}
          />
          <Button
            size="sm"
            onClick={() => handleAddItem(title)}
            className="h-9 shrink-0"
          >
            <Plus className="mr-1.5 size-4" /> Add
          </Button>
        </div>

        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No items yet.
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {items.map((item) => (
              <CatalogItemRow
                key={item.id}
                item={item}
                isEditing={editingId === item.id}
                editingName={editingName}
                onEditingNameChange={setEditingName}
                onStartEdit={startEditing}
                onCancelEdit={cancelEditing}
                onSaveEdit={handleSaveEdit}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
