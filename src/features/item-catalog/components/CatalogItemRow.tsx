import { Edit, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CatalogItem } from "../types";

interface CatalogItemRowProps {
  item: CatalogItem;
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onStartEdit: (item: CatalogItem) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export function CatalogItemRow({
  item,
  isEditing,
  editingName,
  onEditingNameChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: CatalogItemRowProps) {
  if (isEditing) {
    return (
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <Input
          className="h-8"
          value={editingName}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSaveEdit(item.id)}
          autoFocus
        />
        <div className="flex gap-1 shrink-0">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => onSaveEdit(item.id)}
          >
            <Check className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={onCancelEdit}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <span className="text-sm font-medium">{item.name}</span>
      <div className="flex gap-1 shrink-0">
        <Button
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => onStartEdit(item)}
        >
          <Edit className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-8 text-destructive border-destructive/20 hover:bg-destructive/5"
          onClick={() => onDelete(item.id)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}
