import { CostSheetService } from "@/features/cost-sheet";
import type { SavedCostSheetItem, ApprovalStage } from "@/features/cost-sheet";

export function getNextCostSheetId(styleId: string): Promise<string> {
  return CostSheetService.getNextCostSheetId(styleId);
}

export function subscribeToCostSheets(
  callback: (items: SavedCostSheetItem[]) => void,
  onError?: (error: Error) => void
): () => void {
  return CostSheetService.subscribe(callback, onError);
}

export function getCostSheetById(id: string): Promise<SavedCostSheetItem | null> {
  return CostSheetService.getById(id);
}

export function saveCostSheet(item: SavedCostSheetItem): Promise<void> {
  return CostSheetService.save(item);
}

export function deleteCostSheet(id: string): Promise<void> {
  return CostSheetService.delete(id);
}

export function approveCostSheet(
  id: string,
  payload: {
    stage: ApprovalStage;
    action: "approve" | "reject" | "revoke";
    comments?: string;
  }
) {
  return CostSheetService.approve(id, payload);
}
