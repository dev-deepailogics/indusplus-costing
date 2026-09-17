import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { StyleMasterItem } from "@/lib/style-master/types";
import type { WorkOrderItem } from "../types";

interface WorkOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingWorkOrder: WorkOrderItem | null;
  formId: string;
  onFormIdChange: (id: string) => void;
  formStyleId: string;
  onFormStyleIdChange: (styleId: string) => void;
  styles: StyleMasterItem[];
  onSubmit: () => void;
}

export function WorkOrderDialog({
  open,
  onOpenChange,
  editingWorkOrder,
  formId,
  onFormIdChange,
  formStyleId,
  onFormStyleIdChange,
  styles,
  onSubmit,
}: WorkOrderDialogProps) {
  const isEditing = Boolean(editingWorkOrder);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Work Order" : "Add Work Order"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Work Order Number</label>
            <Input
              placeholder="e.g. WO-2024-001"
              value={formId}
              onChange={(e) => onFormIdChange(e.target.value)}
              disabled={isEditing}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Linked Style</label>
            <SearchableSelect
              options={styles.map((s) => ({
                value: s.id,
                label: `${s.id} - ${s.styleName}`,
              }))}
              value={formStyleId}
              onChange={onFormStyleIdChange}
              placeholder="Select style..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit}>
            {isEditing ? "Save Changes" : "Create Work Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
