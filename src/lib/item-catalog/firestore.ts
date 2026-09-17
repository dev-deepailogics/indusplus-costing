import { ItemCatalogService, FABRIC_COLLECTION, LINING_COLLECTION } from "@/features/item-catalog";
import type { CatalogItem, CatalogCollectionName } from "@/features/item-catalog";

export { FABRIC_COLLECTION, LINING_COLLECTION };

export function subscribeToCatalog(
  collectionName: CatalogCollectionName,
  onData: (items: CatalogItem[]) => void
): () => void {
  return ItemCatalogService.subscribe(collectionName, onData);
}

export async function addCatalogItem(collectionName: CatalogCollectionName, name: string): Promise<void> {
  await ItemCatalogService.addItem(collectionName, name);
}

export async function updateCatalogItem(
  collectionName: CatalogCollectionName,
  id: string,
  name: string
): Promise<void> {
  await ItemCatalogService.updateItem(collectionName, id, name);
}

export async function deleteCatalogItem(collectionName: CatalogCollectionName, id: string): Promise<void> {
  await ItemCatalogService.deleteItem(collectionName, id);
}
