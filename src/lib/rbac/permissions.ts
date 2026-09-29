/**
 * Dynamic RBAC — Core permission types, section registry, and server-side helpers.
 *
 * Every permission check (client or server) flows through the types and
 * helpers defined here, ensuring a single source of truth.
 */

// ─── Actions ──────────────────────────────────────────────────────────
export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve";

export const ALL_ACTIONS: PermissionAction[] = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
];

// ─── Section Definition ───────────────────────────────────────────────
export type SectionGroup = "pages" | "cost_sheet_sections" | "approvals";

export interface SectionDefinition {
  key: string;
  label: string;
  group: SectionGroup;
  description?: string;
  /** Actions that make sense for this section. */
  applicableActions: PermissionAction[];
}

export const SECTION_REGISTRY: SectionDefinition[] = [
  // ── 1. Page Access (Sidebar Navigation) ──
  {
    key: "page_cost_sheets",
    label: "Cost Sheets List",
    group: "pages",
    description: "Sidebar navigation, browse saved sheets, create new sheets, or master full-sheet edit",
    applicableActions: ["view", "create", "edit", "delete"],
  },
  {
    key: "page_parameters",
    label: "POC Parameters",
    group: "pages",
    description: "View and configure grid/value/dropdown parameters",
    applicableActions: ["view", "create", "edit", "delete"],
  },
  {
    key: "page_users",
    label: "Manage Users",
    group: "pages",
    description: "User account management and password resets",
    applicableActions: ["view", "create", "edit", "delete"],
  },
  {
    key: "page_roles",
    label: "Manage Roles",
    group: "pages",
    description: "Dynamic role creation and permission matrix management",
    applicableActions: ["view", "create", "edit", "delete"],
  },
  {
    key: "page_teams",
    label: "Manage Teams",
    group: "pages",
    description: "Customer-centric team management, member role assignments, and customer portfolio mapping",
    applicableActions: ["view", "create", "edit", "delete"],
  },

  // ── 2. Cost Sheet Sections (Calculator Form Fields & Controls) ──
  {
    key: "section_header",
    label: "Pre-Order Cost Sheet Header",
    group: "cost_sheet_sections",
    description: "Style & QTY Specs, Logistics, Customer, FOB targets, and financial rates",
    applicableActions: ["view", "edit"],
  },
  {
    key: "section_fabric",
    label: "Fabric Details",
    group: "cost_sheet_sections",
    description: "Fabric item names, consumption (mtr), rates ($/Rs), and line costs",
    applicableActions: ["view", "edit"],
  },
  {
    key: "section_pocket_lining",
    label: "Pocket Lining Details",
    group: "cost_sheet_sections",
    description: "Pocket lining materials, consumption, rates, and line costs",
    applicableActions: ["view", "edit"],
  },
  {
    key: "section_trims",
    label: "Trims & Accessories Details",
    group: "cost_sheet_sections",
    description: "Buttons, zippers, labels, threads, consumption, and unit rates",
    applicableActions: ["view", "edit"],
  },
  {
    key: "section_chemicals",
    label: "Chemicals & Washing Details",
    group: "cost_sheet_sections",
    description: "Wash type selection, recipe chemicals, consumption, and wash rates",
    applicableActions: ["view", "edit"],
  },
  {
    key: "section_special_charges",
    label: "Special Charges",
    group: "cost_sheet_sections",
    description: "Embroidery, printing, washing special effects, and testing charges",
    applicableActions: ["view", "edit"],
  },
  {
    key: "section_sam_labor",
    label: "SAM & Labor Metrics (IE)",
    group: "cost_sheet_sections",
    description: "Sewing SAM, Cutting SAM, Washing SAM, Finishing SAM, manpower & efficiency",
    applicableActions: ["view", "edit"],
  },
  {
    key: "section_profitability",
    label: "Cost & Profitability Summary",
    group: "cost_sheet_sections",
    description: "FOB selling price, gross CM, overheads (FOH/Salaries), and net profit summary",
    applicableActions: ["view", "edit"],
  },

  // ── 3. Approval Workflow Sign-Offs ──
  {
    key: "approval_fabric",
    label: "Approval: Fabric Head",
    group: "approvals",
    description: "Sign-off stage for fabric consumption and fabric pricing",
    applicableActions: ["view", "approve"],
  },
  {
    key: "approval_mmc",
    label: "Approval: Trims / MMC Head",
    group: "approvals",
    description: "Sign-off stage for accessories and trims pricing",
    applicableActions: ["view", "approve"],
  },
  {
    key: "approval_ie",
    label: "Approval: IE Head (SAM)",
    group: "approvals",
    description: "Sign-off stage for SAM / SMV breakdowns and line targets",
    applicableActions: ["view", "approve"],
  },
  {
    key: "approval_washing",
    label: "Approval: Washing Head",
    group: "approvals",
    description: "Sign-off stage for wash type and chemical costs",
    applicableActions: ["view", "approve"],
  },
  {
    key: "approval_marketing",
    label: "Approval: Marketing",
    group: "approvals",
    description: "Commercial FOB pricing sign-off after all 4 department head approvals",
    applicableActions: ["view", "approve"],
  },
  {
    key: "approval_costing_head",
    label: "Approval: Costing Head",
    group: "approvals",
    description: "Overheads, margins, and conversion cost review sign-off",
    applicableActions: ["view", "approve"],
  },
  {
    key: "approval_director",
    label: "Approval: Director",
    group: "approvals",
    description: "Final authorization that permanently locks the cost sheet",
    applicableActions: ["view", "approve"],
  },
];

export const ALL_SECTION_KEYS = SECTION_REGISTRY.map((s) => s.key);

// ─── Permission object (flat, serializable — stored in JWT) ───────────
export interface SectionPermission {
  section: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
}

// ─── Role definitions ─────────────────────────────────────────────────
export interface RoleDefinition {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  permissions: SectionPermission[];
  createdAt?: string;
  updatedAt?: string;
}

// Legacy key backwards compatibility mapping — also used by server.ts
export const SECTION_ALIASES: Record<string, string> = {
  cost_sheets: "page_cost_sheets",
  cost_sheet_editor: "section_header",
  parameters: "page_parameters",
  users: "page_users",
  roles: "page_roles",
  teams: "page_teams",
};

// ─── Client-side permission checker ───────────────────────────────────
/**
 * Check whether a permissions array grants a specific action on a section.
 * Backwards compatible with legacy section keys.
 */
export function can(
  permissions: SectionPermission[],
  section: string,
  action: PermissionAction,
): boolean {
  if (!Array.isArray(permissions)) return false;
  const targetKey = SECTION_ALIASES[section] || section;
  const entry = permissions.find(
    (p) => p.section === targetKey || p.section === section,
  );
  if (!entry) return false;
  if (entry[action] === true) return true;
  // Any create/edit/delete/approve permission implicitly includes view permission
  if (action === "view" && (entry.create || entry.edit || entry.delete || entry.approve)) {
    return true;
  }
  return false;
}

// ─── Map approval stage → permission section key ──────────────────────
export const APPROVAL_STAGE_TO_SECTION: Record<string, string> = {
  fabric: "approval_fabric",
  mmc: "approval_mmc",
  ie: "approval_ie",
  washing: "approval_washing",
  marketing: "approval_marketing",
  costingHead: "approval_costing_head",
  director: "approval_director",
};

// ─── Default permission seeds ─────────────────────────────────────────
/** Build full admin permissions — every section, every action = true. */
export function buildAdminPermissions(): SectionPermission[] {
  return SECTION_REGISTRY.map((s) => ({
    section: s.key,
    view: true,
    create: true,
    edit: true,
    delete: true,
    approve: true,
  }));
}

/**
 * Build default permissions for a role slug.
 */
export function buildDefaultPermissions(slug: string): SectionPermission[] {
  const perms: SectionPermission[] = SECTION_REGISTRY.map((s) => ({
    section: s.key,
    view: false,
    create: false,
    edit: false,
    delete: false,
    approve: false,
  }));

  const set = (section: string, overrides: Partial<SectionPermission>) => {
    const p = perms.find((x) => x.section === section);
    if (p) Object.assign(p, overrides);
  };

  // Base: everyone can view cost sheets
  set("page_cost_sheets", { view: true });

  switch (slug) {
    case "admin":
      return buildAdminPermissions();

    case "merchant":
      // Merchant can view, create, edit, delete cost sheets and all cost sheet sections
      set("page_cost_sheets", { view: true, create: true, edit: true, delete: true });
      set("page_parameters", { view: true });
      SECTION_REGISTRY.filter((s) => s.group === "cost_sheet_sections").forEach((s) => {
        set(s.key, { view: true, edit: true });
      });
      break;

    case "fabric_head":
      // View all sections, edit fabric & lining, approve fabric
      SECTION_REGISTRY.filter((s) => s.group === "cost_sheet_sections").forEach((s) => {
        set(s.key, { view: true });
      });
      set("section_fabric", { view: true, edit: true });
      set("section_pocket_lining", { view: true, edit: true });
      set("approval_fabric", { view: true, approve: true });
      break;

    case "mmc_head":
      // View all sections, edit trims, approve MMC
      SECTION_REGISTRY.filter((s) => s.group === "cost_sheet_sections").forEach((s) => {
        set(s.key, { view: true });
      });
      set("section_trims", { view: true, edit: true });
      set("approval_mmc", { view: true, approve: true });
      break;

    case "ie_head":
      // View all sections, edit SAM/labor, approve IE
      SECTION_REGISTRY.filter((s) => s.group === "cost_sheet_sections").forEach((s) => {
        set(s.key, { view: true });
      });
      set("section_sam_labor", { view: true, edit: true });
      set("approval_ie", { view: true, approve: true });
      break;

    case "washing_head":
      // View all sections, edit chemicals & wash, approve washing
      SECTION_REGISTRY.filter((s) => s.group === "cost_sheet_sections").forEach((s) => {
        set(s.key, { view: true });
      });
      set("section_chemicals", { view: true, edit: true });
      set("approval_washing", { view: true, approve: true });
      break;

    case "marketing":
      // View all sections, edit header & profitability, approve marketing
      SECTION_REGISTRY.filter((s) => s.group === "cost_sheet_sections").forEach((s) => {
        set(s.key, { view: true });
      });
      set("section_header", { view: true, edit: true });
      set("section_profitability", { view: true, edit: true });
      set("approval_marketing", { view: true, approve: true });
      break;

    case "costing_head":
      // View & edit all sections, approve costing head
      SECTION_REGISTRY.filter((s) => s.group === "cost_sheet_sections").forEach((s) => {
        set(s.key, { view: true, edit: true });
      });
      set("approval_costing_head", { view: true, approve: true });
      break;

    case "director":
      // View all sections, approve director (final lock)
      SECTION_REGISTRY.filter((s) => s.group === "cost_sheet_sections").forEach((s) => {
        set(s.key, { view: true });
      });
      set("approval_director", { view: true, approve: true });
      break;
  }

  return perms;
}
