import type {
  DropdownListsData,
  MatrixTableData,
  ProcessMatrixTableData,
  SimpleTableData,
} from "./types";

function simpleRows(columns: string[], data: string[][]): SimpleTableData["rows"] {
  return data.map((values, i) => ({
    id: `row-${i}`,
    values: Object.fromEntries(columns.map((c, j) => [c, values[j] ?? ""])),
  }));
}

const QTY_BANDS = [
  "<=500",
  "501-1000",
  "1001-2000",
  "2001-3000",
  "3001-4000",
  "4001-5000",
  "5001-10000",
  "10001-25000",
  ">25000",
];

const STYLE_CATEGORIES = ["Basic", "Semi Fashion", "Fashion", "High Fashion"];

function matrix(values: number[][], suffix = ""): MatrixTableData {
  const cells: MatrixTableData["cells"] = {};
  QTY_BANDS.forEach((band, i) => {
    cells[band] = {};
    STYLE_CATEGORIES.forEach((cat, j) => {
      cells[band][cat] = `${values[i][j]}${suffix}`;
    });
  });
  return { rowLabels: QTY_BANDS, columnLabels: STYLE_CATEGORIES, cells };
}

export const SEED_SIMPLE: Record<string, SimpleTableData> = {
  styles: {
    columns: [
      { key: "styleName", label: "Style Name" },
      { key: "samPcFrom", label: "SAM/PC From" },
      { key: "samPcTo", label: "SAM/PC To" },
    ],
    rows: simpleRows(
      ["styleName", "samPcFrom", "samPcTo"],
      [
        ["Basic", "", "<=18"],
        ["Semi Fashion", "19", "23"],
        ["Fashion", "24", "36"],
        ["High Fashion", ">=37", ""],
      ]
    ),
  },
  "order-type": {
    columns: [{ key: "orderType", label: "Order Type" }],
    rows: simpleRows(["orderType"], [["Denim"], ["Non-Denim"]]),
  },
  "customer-commission": {
    columns: [
      { key: "customer", label: "Customer" },
      { key: "commissionPercent", label: "Commission %" },
    ],
    rows: [],
  },
  "cost-as-percent-of-sales": {
    columns: [
      { key: "description", label: "Description" },
      { key: "percentOfSales", label: "% of Sales" },
    ],
    rows: simpleRows(
      ["description", "percentOfSales"],
      [["Taxes", ""], ["EDS", ""], ["Rebate", ""], ["Exchange Rate", ""]]
    ),
  },
  "direct-labour-foh": {
    columns: [
      { key: "description", label: "Description" },
      { key: "costPerSam", label: "Cost/SAM" },
    ],
    rows: simpleRows(
      ["description", "costPerSam"],
      [
        ["Direct Labour", ""],
        ["Fixed Salaries", ""],
        ["Utilities Cost", ""],
        ["Repair and Maintenance", ""],
        ["Manufacturing FOH", ""],
        ["Depreciation", ""],
      ]
    ),
  },
  "admin-selling": {
    columns: [
      { key: "description", label: "Description" },
      { key: "costPerSam", label: "Cost/SAM" },
    ],
    rows: simpleRows(
      ["description", "costPerSam"],
      [
        ["Salaries", ""],
        ["FOH", ""],
        ["Inland Freight and Clearing", ""],
        ["Export Freight", ""],
      ]
    ),
  },
  "other-expenses": {
    columns: [
      { key: "description", label: "Description" },
      { key: "percentOfSales", label: "% of Sales" },
    ],
    rows: simpleRows(
      ["description", "percentOfSales"],
      [["Financial Charges", ""], ["Taxation", ""]]
    ),
  },
};

export const SEED_CUT_TO_SHIP: MatrixTableData = matrix([
  [54, 50, 47, 45],
  [56, 52, 48, 46],
  [58, 53, 50, 48],
  [60, 55, 52, 50],
  [62, 57, 54, 52],
  [65, 59, 56, 54],
  [68, 62, 58, 56],
  [72, 65, 60, 58],
  [75, 66, 62, 60],
]);

const REJECTION_VALUES: number[][] = [
  [0.6, 0.65, 0.7, 0.75],
  [0.5, 0.5, 0.5, 0.5],
  [0.5, 0.5, 0.5, 0.5],
  [0.5, 0.5, 0.5, 0.5],
  [0.5, 0.5, 0.5, 0.5],
  [0.5, 0.5, 0.5, 0.5],
  [0.4, 0.4, 0.4, 0.4],
  [0.4, 0.4, 0.4, 0.4],
  [0.4, 0.4, 0.4, 0.4],
];

export const REJECTION_PROCESSES = ["Fabric", "Cutting", "Sewing", "Finishing", "E1"];

export const SEED_REJECTION_GRID: ProcessMatrixTableData = {
  processes: REJECTION_PROCESSES,
  tables: Object.fromEntries(
    REJECTION_PROCESSES.map((p) => [p, matrix(REJECTION_VALUES, "%")])
  ),
};

export const SEED_DROPDOWN_LISTS: DropdownListsData = {
  lists: [
    { key: "deliveryTerms", label: "Delivery Terms", items: ["FOB", "CIF", "CIR"] },
    { key: "paymentTerms", label: "Payment Terms", items: ["DA", "LC 60 Days", "Advance"] },
    { key: "washType", label: "Wash Type", items: ["Softener", "Soft Wash", "Rinse"] },
    {
      key: "styleCategory",
      label: "Style Category",
      items: ["Top Ware", "Boy's Pant", "Girls Pant"],
    },
  ],
};
