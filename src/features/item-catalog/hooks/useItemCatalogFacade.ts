"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { ItemCatalogService } from "../services/ItemCatalogService";
import type { CatalogItem, CatalogCollectionName } from "../types";

export interface UseItemCatalogFacadeReturn {
  items: CatalogItem[];
  loading: boolean;
  newName: string;
  setNewName: (name: string) => void;
  editingId: string | null;
  editingName: string;
  setEditingName: (name: string) => void;
  startEditing: (item: CatalogItem) => void;
  cancelEditing: () => void;
  handleAddItem: (title: string) => Promise<void>;
  handleSaveEdit: (id: string) => Promise<void>;
  handleDeleteItem: (id: string) => Promise<void>;
}

export function useItemCatalogFacade(collectionName: CatalogCollectionName): UseItemCatalogFacadeReturn {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    setLoading(true);
    const unsubscribe = ItemCatalogService.subscribe(
      collectionName,
      (data) => {
        setItems(data);
        setLoading(false);
      },
      () => {
        setLoading(false);
        toast.error("Failed to load catalog items");
      }
    );
    return () => unsubscribe();
  }, [collectionName]);

  const startEditing = useCallback((item: CatalogItem) => {
    setEditingId(item.id);
    setEditingName(item.name);
  }, []);

  const cancelEditing = useCallback(() => {
    setEditingId(null);
    setEditingName("");
  }, []);

  const handleAddItem = useCallback(
    async (title: string) => {
      const trimmed = newName.trim();
      if (!trimmed) {
        toast.error("Please enter an item name");
        return;
      }
      try {
        await ItemCatalogService.addItem(collectionName, trimmed);
        setNewName("");
        toast.success(`${title} item added`);
      } catch (err) {
        console.error("Error adding item:", err);
        toast.error("Failed to add item");
      }
    },
    [collectionName, newName]
  );

  const handleSaveEdit = useCallback(
    async (id: string) => {
      const trimmed = editingName.trim();
      if (!trimmed) {
        toast.error("Please enter an item name");
        return;
      }
      try {
        await ItemCatalogService.updateItem(collectionName, id, trimmed);
        setEditingId(null);
        setEditingName("");
        toast.success("Item updated");
      } catch (err) {
        console.error("Error updating item:", err);
        toast.error("Failed to update item");
      }
    },
    [collectionName, editingName]
  );

  const handleDeleteItem = useCallback(
    async (id: string) => {
      if (!confirm("Are you sure you want to delete this item?")) return;
      try {
        await ItemCatalogService.deleteItem(collectionName, id);
        toast.success("Item deleted");
      } catch (err) {
        console.error("Error deleting item:", err);
        toast.error("Delete failed");
      }
    },
    [collectionName]
  );

  return {
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
  };
}
