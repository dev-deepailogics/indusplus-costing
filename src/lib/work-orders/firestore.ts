import { WorkOrdersService } from "@/features/work-orders";
import type { WorkOrderItem } from "@/features/work-orders";

export function subscribeToWorkOrders(onData: (items: WorkOrderItem[]) => void): () => void {
  return WorkOrdersService.subscribe(onData);
}

export async function saveWorkOrder(item: WorkOrderItem): Promise<void> {
  await WorkOrdersService.save(item);
}

export async function deleteWorkOrder(id: string): Promise<void> {
  await WorkOrdersService.delete(id);
}
