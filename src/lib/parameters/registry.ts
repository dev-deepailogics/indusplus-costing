export type ParameterKind = "simple" | "matrix" | "process-matrix" | "dropdown-lists";

export type ParameterDef = {
  slug: string;
  title: string;
  kind: ParameterKind;
};

export const PARAMETER_TABLES: ParameterDef[] = [
  { slug: "styles", title: "Styles", kind: "simple" },
  { slug: "cut-to-ship-grid", title: "Cut-to-Ship Grid", kind: "matrix" },
  { slug: "rejection-grid", title: "Rejection Grid", kind: "process-matrix" },
  { slug: "order-type", title: "Order Type", kind: "simple" },
  { slug: "customer-commission", title: "Customer Wise Commission", kind: "simple" },
  { slug: "cost-as-percent-of-sales", title: "Cost as % of Sales", kind: "simple" },
  { slug: "direct-labour-foh", title: "Direct Labour and FOH", kind: "simple" },
  { slug: "admin-selling", title: "Admin and Selling", kind: "simple" },
  { slug: "other-expenses", title: "Other Expenses", kind: "simple" },
  { slug: "dropdown-lists", title: "Dropdown Lists", kind: "dropdown-lists" },
];

export function getParameterDef(slug: string): ParameterDef | undefined {
  return PARAMETER_TABLES.find((t) => t.slug === slug);
}
