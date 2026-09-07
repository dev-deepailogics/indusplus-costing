"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CostSheetSaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  referenceName: string;
  onReferenceNameChange: (val: string) => void;
  onSave: () => void;
  isSaving: boolean;
  isUpdating: boolean;
}

export function CostSheetSaveDialog({
  open,
  onOpenChange,
  referenceName,
  onReferenceNameChange,
  onSave,
  isSaving,
  isUpdating,
}: CostSheetSaveDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isUpdating ? "Update Costing Snapshot" : "Save Costing Scenario"}</DialogTitle>
          <DialogDescription className="text-xs">
            Provide a descriptive reference name to easily identify this costing scenario later (e.g. &quot;Target FOB Quote - Rev 1&quot;).
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">Scenario Reference Name *</label>
          <Input
            autoFocus
            placeholder="e.g. Target FOB Quote - Rev 1"
            value={referenceName}
            onChange={(e) => onReferenceNameChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSave()}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : isUpdating ? "Update Scenario" : "Save Snapshot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
