import { CostSheetService } from "@/features/cost-sheet";
import type { SavedCostSheetItem } from "@/features/cost-sheet";

export function getNextCostSheetId(styleId: string): Promise<string> {
  return CostSheetService.getNextCostSheetId(styleId);
}

export function subscribeToCostSheets(
  callback: (items: SavedCostSheetItem[]) => void
): () => void {
  return CostSheetService.subscribe(callback);
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
