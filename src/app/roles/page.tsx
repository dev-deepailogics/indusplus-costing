"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Shield,
  Plus,
  Pencil,
  Trash2,
  Check,
  Lock,
  RefreshCw,
  CheckCheck,
  Eye,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SECTION_REGISTRY,
  type SectionPermission,
  type RoleDefinition,
  type PermissionAction,
} from "@/lib/rbac/permissions";
import { useAuth } from "@/lib/auth/auth-provider";

// ─── Permission Matrix Component ──────────────────────────────────────
function PermissionMatrix({
  permissions,
  onChange,
  readOnly = false,
}: {
  permissions: SectionPermission[];
  onChange: (updated: SectionPermission[]) => void;
  readOnly?: boolean;
}) {
  const pageSections = SECTION_REGISTRY.filter((s) => s.group === "pages");
  const costSheetSections = SECTION_REGISTRY.filter((s) => s.group === "cost_sheet_sections");
  const approvalSections = SECTION_REGISTRY.filter((s) => s.group === "approvals");

  function toggle(sectionKey: string, action: PermissionAction) {
    if (readOnly) return;
    const costSheetSectionKeys = costSheetSections.map((s) => s.key);
    const approvalSectionKeys = approvalSections.map((s) => s.key);

    let updated = permissions.map((p) => {
      if (p.section !== sectionKey) return p;
      const nextVal = !p[action];
      const next = { ...p, [action]: nextVal };
      // If enabling any action other than view, automatically enable view
      if (nextVal && action !== "view") {
        next.view = true;
      }
      // If disabling view, automatically disable all other actions
      if (!nextVal && action === "view") {
        next.create = false;
        next.edit = false;
        next.delete = false;
        next.approve = false;
      }
      return next;
    });

    // ── 1. MASTER TOGGLE CASCADE: When toggling page_cost_sheets ──
    if (sectionKey === "page_cost_sheets") {
      const pagePerm = updated.find((p) => p.section === "page_cost_sheets");
      if (action === "edit") {
        const isMasterEdit = !!pagePerm?.edit;
        // Master Edit turned ON -> grant edit + view to all 8 cost sheet sections
        // Master Edit turned OFF -> revoke edit on all 8 cost sheet sections
        updated = updated.map((p) => {
          if (costSheetSectionKeys.includes(p.section)) {
            return {
              ...p,
              edit: isMasterEdit,
              view: isMasterEdit ? true : p.view,
            };
          }
          return p;
        });
      } else if (action === "view" && !pagePerm?.view) {
        // Disabling page_cost_sheets view -> disable all cost sheet sections and approvals
        updated = updated.map((p) => {
          if (
            costSheetSectionKeys.includes(p.section) ||
            approvalSectionKeys.includes(p.section)
          ) {
            return {
              ...p,
              view: false,
              create: false,
              edit: false,
              delete: false,
              approve: false,
            };
          }
          return p;
        });
      }
    }

    // ── 2. GRANULAR SECTION UPWARD AUTO-SYNC ──
    const isCostSheetSection = costSheetSectionKeys.includes(sectionKey);
    const isApprovalSection = approvalSectionKeys.includes(sectionKey);

    if (isCostSheetSection || isApprovalSection) {
      const targetPerm = updated.find((p) => p.section === sectionKey);
      const hasAnyActive =
        targetPerm &&
        (targetPerm.view ||
          targetPerm.create ||
          targetPerm.edit ||
          targetPerm.delete ||
          targetPerm.approve);

      // If enabling any section/approval, automatically activate page_cost_sheets view
      if (hasAnyActive) {
        updated = updated.map((p) => {
          if (p.section === "page_cost_sheets") {
            return { ...p, view: true };
          }
          return p;
        });
      }

      // Check if all 8 cost sheet sections can edit -> sync page_cost_sheets edit
      if (isCostSheetSection) {
        const allSectionsCanEdit = costSheetSectionKeys.every((k) => {
          const perm = updated.find((p) => p.section === k);
          return perm?.edit === true;
        });

        updated = updated.map((p) => {
          if (p.section === "page_cost_sheets") {
            return { ...p, edit: allSectionsCanEdit };
          }
          return p;
        });
      }
    }

    onChange(updated);
  }

  function toggleRow(sectionKey: string, applicableActions: PermissionAction[]) {
    if (readOnly) return;
    const costSheetSectionKeys = costSheetSections.map((s) => s.key);
    const approvalSectionKeys = approvalSections.map((s) => s.key);

    const current = permissions.find((p) => p.section === sectionKey);
    const allActive = applicableActions.every((a) => current && current[a]);
    const willBeActive = !allActive;

    let updated = permissions.map((p) => {
      if (p.section !== sectionKey) return p;
      const next = { ...p };
      for (const a of applicableActions) {
        next[a] = willBeActive;
      }
      return next;
    });

    // Master row cascade
    if (sectionKey === "page_cost_sheets") {
      if (willBeActive) {
        // Granted all on page_cost_sheets -> turn on edit + view on all cost sheet sections
        updated = updated.map((p) => {
          if (costSheetSectionKeys.includes(p.section)) {
            return { ...p, view: true, edit: true };
          }
          return p;
        });
      } else {
        // Cleared page_cost_sheets -> revoke all actions on cost sheet sections and approvals
        updated = updated.map((p) => {
          if (
            costSheetSectionKeys.includes(p.section) ||
            approvalSectionKeys.includes(p.section)
          ) {
            return {
              ...p,
              view: false,
              create: false,
              edit: false,
              delete: false,
              approve: false,
            };
          }
          return p;
        });
      }
    }

    // Granular section row toggle upward auto-sync
    const isCostSheetSection = costSheetSectionKeys.includes(sectionKey);
    const isApprovalSection = approvalSectionKeys.includes(sectionKey);

    if (isCostSheetSection || isApprovalSection) {
      if (willBeActive) {
        updated = updated.map((p) => {
          if (p.section === "page_cost_sheets") {
            return { ...p, view: true };
          }
          return p;
        });
      }

      if (isCostSheetSection) {
        const allSectionsCanEdit = costSheetSectionKeys.every((k) => {
          const perm = updated.find((p) => p.section === k);
          return perm?.edit === true;
        });
        updated = updated.map((p) => {
          if (p.section === "page_cost_sheets") {
            return { ...p, edit: allSectionsCanEdit };
          }
          return p;
        });
      }
    }

    onChange(updated);
  }

  function applyPreset(type: "all" | "none" | "view_only") {
    if (readOnly) return;
    const updated = SECTION_REGISTRY.map((s) => {
      const p: SectionPermission = {
        section: s.key,
        view: type === "all" || type === "view_only",
        create: type === "all" && s.applicableActions.includes("create"),
        edit: type === "all" && s.applicableActions.includes("edit"),
        delete: type === "all" && s.applicableActions.includes("delete"),
        approve: type === "all" && s.applicableActions.includes("approve"),
      };
      return p;
    });
    onChange(updated);
  }

  function getVal(sectionKey: string, action: PermissionAction): boolean {
    const p = permissions.find((x) => x.section === sectionKey);
    return p ? p[action] : false;
  }

  const actions: { key: PermissionAction; label: string; width: string }[] = [
    { key: "view", label: "View", width: "w-20" },
    { key: "create", label: "Create", width: "w-20" },
    { key: "edit", label: "Edit", width: "w-20" },
    { key: "delete", label: "Delete", width: "w-20" },
    { key: "approve", label: "Approve", width: "w-24" },
  ];

  function renderSectionGroup(
    title: string,
    badgeText: string,
    sections: typeof SECTION_REGISTRY,
  ) {
    const activeCount = sections.filter((s) => {
      const p = permissions.find((x) => x.section === s.key);
      return p && (p.view || p.create || p.edit || p.delete || p.approve);
    }).length;

    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {title}
            </h4>
            <Badge variant="secondary" className="text-[10px] font-semibold px-2 py-0">
              {activeCount}/{sections.length} active
            </Badge>
          </div>
          <span className="text-[11px] text-muted-foreground">{badgeText}</span>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80 dark:bg-slate-900/50 border-b">
                  <TableHead className="min-w-[220px] text-xs font-bold text-slate-700 dark:text-slate-200">
                    Section Name
                  </TableHead>
                  {actions.map((a) => (
                    <TableHead
                      key={a.key}
                      className={`text-center text-xs font-bold text-slate-700 dark:text-slate-200 ${a.width}`}
                    >
                      {a.label}
                    </TableHead>
                  ))}
                  {!readOnly && (
                    <TableHead className="w-16 text-center text-xs font-bold text-slate-500">
                      All
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section) => {
                  const allActive = section.applicableActions.every(
                    (a) => getVal(section.key, a),
                  );

                  return (
                    <TableRow
                      key={section.key}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-900/40 transition-colors"
                    >
                      <TableCell className="text-xs font-medium py-2.5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {section.label}
                          </span>
                          {section.description && (
                            <span className="text-[11px] text-muted-foreground line-clamp-1">
                              {section.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {actions.map((a) => {
                        const isApplicable = section.applicableActions.includes(a.key);
                        const isChecked = getVal(section.key, a.key);

                        return (
                          <TableCell key={a.key} className="text-center py-2.5">
                            {isApplicable ? (
                              <button
                                type="button"
                                disabled={readOnly}
                                onClick={() => toggle(section.key, a.key)}
                                className={`inline-flex items-center justify-center size-6 rounded-md border transition-all duration-150 ${
                                  isChecked
                                    ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                                    : "bg-background border-slate-300 dark:border-slate-700 hover:border-emerald-500"
                                } ${readOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer active:scale-95"}`}
                                title={`${a.label} for ${section.label}`}
                              >
                                {isChecked && <Check className="size-3.5 stroke-[3]" />}
                              </button>
                            ) : (
                              <span className="text-slate-300 dark:text-slate-700 text-xs font-light">
                                —
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                      {!readOnly && (
                        <TableCell className="text-center py-2.5">
                          <button
                            type="button"
                            onClick={() => toggleRow(section.key, section.applicableActions)}
                            className={`text-[11px] px-2 py-0.5 rounded border font-medium transition-colors ${
                              allActive
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                : "text-slate-500 hover:text-slate-900 border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                            }`}
                            title="Toggle all permissions for this row"
                          >
                            {allActive ? "Clear" : "All"}
                          </button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Quick Presets Bar */}
      {!readOnly && (
        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
            <SlidersHorizontal className="size-3.5" />
            <span>Quick Presets:</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset("view_only")}
              className="h-7 text-xs px-2.5"
            >
              <Eye className="size-3 mr-1" />
              View Only
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset("all")}
              className="h-7 text-xs px-2.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
            >
              <CheckCheck className="size-3 mr-1" />
              Grant All
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset("none")}
              className="h-7 text-xs px-2.5 text-slate-500 hover:text-slate-700"
            >
              <XCircle className="size-3 mr-1" />
              Clear All
            </Button>
          </div>
        </div>
      )}

      {renderSectionGroup(
        "1. Page Access (Sidebar Navigation)",
        "Controls top-level sidebar navigation, creation of new cost sheets, and record deletion",
        pageSections,
      )}
      {renderSectionGroup(
        "2. Cost Sheet Sections (Calculator Form Fields)",
        "Controls granular view & edit access to individual calculator cards and field groups inside the cost sheet",
        costSheetSections,
      )}
      {renderSectionGroup(
        "3. Approval Workflow Sign-Offs",
        "Sign-off stages in Costing Approval workflow",
        approvalSections,
      )}
    </div>
  );
}

// ─── Create default empty permissions ─────────────────────────────────
function createEmptyPermissions(): SectionPermission[] {
  return SECTION_REGISTRY.map((s) => ({
    section: s.key,
    view: false,
    create: false,
    edit: false,
    delete: false,
    approve: false,
  }));
}

// ─── Main Roles Page ──────────────────────────────────────────────────
export default function ManageRolesPage() {
  const { user: currentUser, can } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const canCreate = isAdmin || can("page_roles", "create");
  const canEdit = isAdmin || can("page_roles", "edit");
  const canDelete = isAdmin || can("page_roles", "delete");

  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Role dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newPermissions, setNewPermissions] = useState<SectionPermission[]>(
    createEmptyPermissions(),
  );
  const [creating, setCreating] = useState(false);

  // Edit Role dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleDefinition | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPermissions, setEditPermissions] = useState<SectionPermission[]>([]);
  const [saving, setSaving] = useState(false);

  // Delete confirmation
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteRole, setDeleteRole] = useState<RoleDefinition | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/roles");
      const data = await res.json();
      if (Array.isArray(data.roles)) {
        setRoles(data.roles);
      }
    } catch {
      toast.error("Failed to load roles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // ── Create ──
  function openCreateDialog() {
    setNewRoleName("");
    setNewRoleDescription("");
    setNewPermissions(createEmptyPermissions());
    setCreateOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newRoleName.trim()) {
      toast.error("Role name is required.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newRoleName,
          description: newRoleDescription,
          permissions: newPermissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Your login session has expired. Please log in again.");
        }
        throw new Error(data.error || "Failed to create role.");
      }
      toast.success(`Role "${newRoleName}" created successfully.`);
      setCreateOpen(false);
      await fetchRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create role.");
    } finally {
      setCreating(false);
    }
  }

  // ── Edit ──
  function openEditDialog(r: RoleDefinition) {
    setEditRole(r);
    setEditName(r.name);
    setEditDescription(r.description || "");
    // Merge existing permissions with full section list
    const merged = SECTION_REGISTRY.map((s) => {
      const existing = r.permissions.find((p) => p.section === s.key);
      return (
        existing || {
          section: s.key,
          view: false,
          create: false,
          edit: false,
          delete: false,
          approve: false,
        }
      );
    });
    setEditPermissions(merged);
    setEditOpen(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editRole) return;
    if (!editName.trim()) {
      toast.error("Role name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${editRole.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          permissions: editPermissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Your login session has expired. Please log in again.");
        }
        throw new Error(data.error || "Failed to update role.");
      }
      toast.success(`Role "${editName}" updated successfully.`);
      setEditOpen(false);
      await fetchRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role.");
    } finally {
      setSaving(false);
    }
  }

  // ── Delete ──
  function openDeleteDialog(r: RoleDefinition) {
    setDeleteRole(r);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleteRole) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/roles/${deleteRole.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Your login session has expired. Please log in again.");
        }
        throw new Error(data.error || "Failed to delete role.");
      }
      toast.success(`Role "${deleteRole.name}" deleted.`);
      setDeleteOpen(false);
      await fetchRoles();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete role.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-500/10">
            <Shield className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Manage Roles & Permissions
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure dynamic system roles with fine-grained section permissions.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={fetchRoles} title="Refresh roles">
            <RefreshCw className="size-3.5 mr-1.5" />
            Refresh
          </Button>
          {canCreate && (
            <Button
              size="sm"
              onClick={openCreateDialog}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
            >
              <Plus className="size-4 mr-1.5" />
              Create Role
            </Button>
          )}
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {roles.map((r) => {
          const permCount = r.permissions.filter(
            (p) => p.view || p.create || p.edit || p.delete || p.approve,
          ).length;
          const totalSections = SECTION_REGISTRY.length;

          return (
            <Card
              key={r.id}
              className={`border transition-all hover:shadow-md ${
                r.isSystem
                  ? "border-amber-300/70 bg-gradient-to-br from-amber-50/40 via-background to-amber-50/10 dark:from-amber-950/20 dark:to-background dark:border-amber-800/50"
                  : "border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-900"
              }`}
            >
              <CardContent className="p-5 flex flex-col h-full justify-between gap-4">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold truncate text-foreground">
                          {r.name}
                        </h3>
                        {r.isSystem && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-2 py-0.5 border-amber-400 text-amber-800 dark:text-amber-300 bg-amber-100/50 dark:bg-amber-900/30 shrink-0 font-semibold"
                          >
                            <Lock className="size-2.5 mr-1" />
                            System
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded inline-block">
                        {r.slug}
                      </p>
                    </div>
                    {!r.isSystem && canEdit ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(r)}
                          className="h-8 w-8 p-0 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                          title="Edit Role & Permissions"
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(r)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                            title="Delete Role"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(r)}
                          className="h-7 px-2.5 text-xs shrink-0"
                          title="View Permissions"
                        >
                          <Eye className="size-3 mr-1" />
                          View
                        </Button>
                        {!r.isSystem && canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDeleteDialog(r)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                            title="Delete Role"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 min-h-[32px]">
                    {r.description || "No description provided."}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <div className="size-2 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">
                      <span className="font-bold text-foreground">{permCount}</span>
                      /{totalSections} sections
                    </span>
                  </div>

                  {/* Show permission summary chips */}
                  <div className="flex items-center gap-1 flex-wrap justify-end">
                    {r.permissions
                      .filter((p) => p.approve)
                      .slice(0, 2)
                      .map((p) => {
                        const section = SECTION_REGISTRY.find((s) => s.key === p.section);
                        return (
                          <Badge
                            key={p.section}
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 font-medium"
                          >
                            {section?.label?.replace("Approval: ", "") ?? p.section}
                          </Badge>
                        );
                      })}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {roles.length === 0 && (
        <div className="text-center py-16 bg-muted/20 rounded-2xl border border-dashed text-muted-foreground">
          <Shield className="size-12 mx-auto mb-3 opacity-30 text-indigo-500" />
          <p className="text-sm font-semibold">No roles configured.</p>
          <p className="text-xs mt-1 text-muted-foreground">
            Run the RBAC migration first to seed default roles, or click &ldquo;Create Role&rdquo;.
          </p>
        </div>
      )}

      {/* ─── Create Role Dialog ─── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-full sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400">
                <Plus className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Create New Role</DialogTitle>
                <DialogDescription className="text-xs">
                  Define a new role and configure its granular section-level permissions.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreate} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {/* Form Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div className="space-y-1.5">
                  <Label htmlFor="new-role-name" className="text-xs font-semibold">
                    Role Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="new-role-name"
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. Quality Assurance Manager"
                    className="bg-background text-sm"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-role-desc" className="text-xs font-semibold">
                    Description
                  </Label>
                  <Input
                    id="new-role-desc"
                    value={newRoleDescription}
                    onChange={(e) => setNewRoleDescription(e.target.value)}
                    placeholder="Brief description of this role's purpose"
                    className="bg-background text-sm"
                  />
                </div>
              </div>

              {/* Permission Matrix */}
              <PermissionMatrix
                permissions={newPermissions}
                onChange={setNewPermissions}
              />
            </div>

            <DialogFooter className="px-6 py-3 border-t bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
              >
                {creating ? "Creating Role…" : "Create Role"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Role Dialog ─── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="w-full sm:max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  editRole?.isSystem
                    ? "bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400"
                    : !canEdit
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                    : "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400"
                }`}
              >
                {editRole?.isSystem ? (
                  <Lock className="size-5" />
                ) : !canEdit ? (
                  <Eye className="size-5" />
                ) : (
                  <Pencil className="size-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {editRole?.isSystem ? (
                    <>View Permissions — {editRole?.name}</>
                  ) : !canEdit ? (
                    <>View Role & Permissions — {editRole?.name}</>
                  ) : (
                    <>Edit Role — {editRole?.name}</>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {editRole?.isSystem
                    ? "System roles have predefined permissions and cannot be modified."
                    : !canEdit
                    ? "Viewing role configuration and permissions in read-only mode."
                    : "Modify the role name, description, and fine-grained section permissions."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {!editRole?.isSystem && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/60 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-role-name" className="text-xs font-semibold">
                      Role Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="edit-role-name"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      disabled={!canEdit}
                      className="bg-background text-sm disabled:opacity-75 disabled:cursor-not-allowed"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-role-desc" className="text-xs font-semibold">
                      Description
                    </Label>
                    <Input
                      id="edit-role-desc"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      disabled={!canEdit}
                      className="bg-background text-sm disabled:opacity-75 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {/* Permission Matrix */}
              <PermissionMatrix
                permissions={editPermissions}
                onChange={setEditPermissions}
                readOnly={!!editRole?.isSystem || !canEdit}
              />
            </div>

            <DialogFooter className="px-6 py-3 border-t bg-slate-50/80 dark:bg-slate-900/80 shrink-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
              >
                {editRole?.isSystem || !canEdit ? "Close" : "Cancel"}
              </Button>
              {!editRole?.isSystem && canEdit && (
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                >
                  {saving ? "Saving Changes…" : "Save Changes"}
                </Button>
              )}
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="w-full sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-600">
                <Trash2 className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-red-600">
                  Delete Role
                </DialogTitle>
                <DialogDescription className="text-xs">
                  This action will remove this role from the system.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-bold text-foreground">&ldquo;{deleteRole?.name}&rdquo;</span>?
            Users assigned to this role must be reassigned to another role before they can access the platform.
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
