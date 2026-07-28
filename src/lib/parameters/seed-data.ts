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
  // Style Categories — SAM/PC range classifier (used by formula engine to map SMV → category)
  styles: {
    columns: [
      { key: "styleName", label: "Style Category" },
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
      [
        ["Taxes", ""],
        ["EDS", ""],
        ["Rebate", ""],
        ["Exchange Rate", ""],
        ["Inland Freight", ""],
        ["Local Bank Charges", ""],
        ["Discount Rate", ""]
      ]
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

const FABRIC_REJECTION: number[][] = [
  [0.6, 0.65, 0.7, 0.75], // <=500
  [0.5, 0.5, 0.5, 0.5],   // 501-1000
  [0.5, 0.5, 0.5, 0.5],   // 1001-2000
  [0.5, 0.5, 0.5, 0.5],   // 2001-3000
  [0.5, 0.5, 0.5, 0.5],   // 3001-4000
  [0.5, 0.5, 0.5, 0.5],   // 4001-5000
  [0.4, 0.4, 0.4, 0.4],   // 5001-10000
  [0.4, 0.4, 0.4, 0.4],   // 10001-25000
  [0.4, 0.4, 0.4, 0.4],   // >25000
];

const CUTTING_REJECTION: number[][] = [
  [0.3, 0.3, 0.3, 0.3],     // <=500
  [0.25, 0.25, 0.25, 0.25], // 501-1000
  [0.25, 0.25, 0.25, 0.25], // 1001-2000
  [0.25, 0.25, 0.25, 0.25], // 2001-3000
  [0.25, 0.25, 0.25, 0.25], // 3001-4000
  [0.25, 0.25, 0.25, 0.25], // 4001-5000
  [0.2, 0.2, 0.2, 0.2],     // 5001-10000
  [0.2, 0.2, 0.2, 0.2],     // 10001-25000
  [0.2, 0.2, 0.2, 0.2],     // >25000
];

const SEWING_REJECTION: number[][] = [
  [1.5, 1.5, 1.5, 1.5],     // <=500
  [0.75, 1.0, 1.0, 1.0],    // 501-1000
  [0.75, 1.0, 1.0, 1.0],    // 1001-2000
  [0.75, 0.75, 0.75, 0.75], // 2001-3000
  [0.65, 0.85, 0.85, 0.85], // 3001-4000
  [0.65, 0.85, 0.85, 0.85], // 4001-5000
  [0.5, 0.65, 0.75, 0.75],  // 5001-10000
  [0.5, 0.65, 0.75, 0.75],  // 10001-25000
  [0.5, 0.65, 0.75, 0.75],  // >25000
];

const FINISHING_REJECTION: number[][] = [
  [0.5, 0.5, 0.5, 0.5],     // <=500
  [0.5, 0.5, 0.5, 0.5],     // 501-1000
  [0.25, 0.3, 0.3, 0.3],    // 1001-2000
  [0.25, 0.3, 0.3, 0.3],    // 2001-3000
  [0.25, 0.3, 0.3, 0.3],    // 3001-4000
  [0.25, 0.3, 0.3, 0.3],    // 4001-5000
  [0.25, 0.3, 0.3, 0.3],    // 5001-10000
  [0.25, 0.3, 0.3, 0.3],    // 10001-25000
  [0.25, 0.3, 0.3, 0.3],    // >25000
];



const E1_REJECTION: number[][] = [
  [0.1, 0.1, 0.1, 0.1], // <=500
  [0.1, 0.1, 0.1, 0.1], // 501-1000
  [0.1, 0.1, 0.1, 0.1], // 1001-2000
  [0.1, 0.1, 0.1, 0.1], // 2001-3000
  [0.1, 0.1, 0.1, 0.1], // 3001-4000
  [0.1, 0.1, 0.1, 0.1], // 4001-5000
  [0.1, 0.1, 0.1, 0.1], // 5001-10000
  [0.1, 0.1, 0.1, 0.1], // 10001-25000
  [0.1, 0.1, 0.1, 0.1], // >25000
];

const WIP_REJECTION: number[][] = [
  [0, 0, 0, 0], // <=500
  [0, 0, 0, 0], // 501-1000
  [0, 0, 0, 0], // 1001-2000
  [0, 0, 0, 0], // 2001-3000
  [0, 0, 0, 0], // 3001-4000
  [0, 0, 0, 0], // 4001-5000
  [0, 0, 0, 0], // 5001-10000
  [0, 0, 0, 0], // 10001-25000
  [0, 0, 0, 0], // >25000
];

export const REJECTION_PROCESSES = ["Fabric", "Cutting", "Sewing", "Finishing", "WIP", "E1"];

export const SEED_REJECTION_GRID: ProcessMatrixTableData = {
  processes: REJECTION_PROCESSES,
  tables: {
    Fabric: matrix(FABRIC_REJECTION, "%"),
    Cutting: matrix(CUTTING_REJECTION, "%"),
    Sewing: matrix(SEWING_REJECTION, "%"),
    Finishing: matrix(FINISHING_REJECTION, "%"),
    WIP: matrix(WIP_REJECTION, "%"),
    E1: matrix(E1_REJECTION, "%"),
  },
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
