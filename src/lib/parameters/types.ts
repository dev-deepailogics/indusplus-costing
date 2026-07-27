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

export type DropdownListsData = {
  lists: { key: string; label: string; items: string[] }[];
};
