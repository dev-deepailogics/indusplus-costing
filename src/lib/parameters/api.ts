import { ParametersService } from "@/features/parameters";

export function subscribeToTable<T>(
  slug: string,
  onData: (data: T) => void
): () => void {
  return ParametersService.subscribeToTable<T>(slug, onData);
}

export async function saveTable(slug: string, data: unknown): Promise<void> {
  return ParametersService.saveTable(slug, data);
}

export type {
  DropdownListsData,
  MatrixTableData,
  ProcessMatrixTableData,
  SimpleTableData,
} from "@/features/parameters/types";
