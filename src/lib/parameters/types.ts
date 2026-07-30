export type SimpleColumn = {
  key: string;
  label: string;
};

export type SimpleRow = {
  id: string;
  values: Record<string, string>;
};

export type SimpleTableData = {
  columns: SimpleColumn[];
  rows: SimpleRow[];
};

export type MatrixTableData = {
  rowLabels: string[];
  columnLabels: string[];
  // cells[rowLabel][columnLabel] = value
  cells: Record<string, Record<string, string>>;
};

export type ProcessMatrixTableData = {
  processes: string[];
  tables: Record<string, MatrixTableData>;
};

export type GridCard<T> = {
  id: string;
  serialNo: number;
  name: string;
  isActive: boolean;
  data: T;
};

export type GridCardListData<T> = {
  cards: GridCard<T>[];
};

export function getActiveCard<T>(list: GridCardListData<T> | undefined): GridCard<T> | undefined {
  return list?.cards?.find((c) => c.isActive) ?? list?.cards?.[0];
}

export type DropdownListsData = {
  lists: { key: string; label: string; items: string[] }[];
};
