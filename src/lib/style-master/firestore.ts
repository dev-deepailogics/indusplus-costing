import { StyleMasterService } from "@/features/style-master";
import type { StyleMasterItem } from "@/features/style-master";

export function subscribeToStyles(onData: (styles: StyleMasterItem[]) => void): () => void {
  return StyleMasterService.subscribe(onData);
}

export async function saveStyle(style: StyleMasterItem): Promise<void> {
  await StyleMasterService.save(style);
}

export async function deleteStyle(id: string): Promise<void> {
  await StyleMasterService.delete(id);
}
