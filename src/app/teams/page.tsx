"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { toast } from "sonner";
import {
  UsersRound,
  Plus,
  Search,
  Pencil,
  Trash2,
  Copy,
  RefreshCw,
  Building2,
  UserCheck,
  Shield,
  LayoutGrid,
  Table as TableIcon,
  X,
  UserPlus,
  AlertCircle,
  Briefcase,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useAuth } from "@/lib/auth/auth-provider";
import { CustomerMultiSelect } from "@/features/auth/components/CustomerMultiSelect";

// ─── Interfaces ────────────────────────────────────────────────────────
interface TeamMember {
  id?: number;
  userId: number;
  userEmail: string;
  userDisplayName: string;
  userDefaultRole?: string;
  roleSlug: string;
  roleName?: string;
  notes?: string | null;
  createdAt?: string;
}

interface Team {
  id: number;
  name: string;
  description: string | null;
  customers: string[];
  isActive: boolean;
  memberCount: number;
  members: TeamMember[];
  createdAt: string;
  updatedAt: string;
}

interface UserOption {
  id: number;
  email: string;
  displayName: string;
  role: string;
  isActive: boolean;
}

interface RoleOption {
  id: number;
  name: string;
  slug: string;
  description: string | null;
}

// ─── Role badge styling map ──────────────────────────────────────────
const ROLE_BADGE_STYLES: Record<string, { bg: string; border: string }> = {
  admin: { bg: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400", border: "border-red-200 dark:border-red-800/60" },
  merchant: { bg: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800/60" },
  fabric_head: { bg: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800/60" },
  mmc_head: { bg: "bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800/60" },
  ie_head: { bg: "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300", border: "border-sky-200 dark:border-sky-800/60" },
  washing_head: { bg: "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800/60" },
  marketing: { bg: "bg-pink-50 text-pink-800 dark:bg-pink-950/40 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800/60" },
  costing_head: { bg: "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800/60" },
  director: { bg: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200", border: "border-slate-300 dark:border-slate-700" },
};

function getRoleBadgeStyle(slug: string) {
  return ROLE_BADGE_STYLES[slug] || {
    bg: "bg-muted text-muted-foreground",
    border: "border-border",
  };
}

// ─── Main Manage Teams Page Component ──────────────────────────────────
export default function ManageTeamsPage() {
  const { can, user: currentUser } = useAuth();
  const canCreate = can("teams", "create") || currentUser?.role === "admin";
  const canEdit = can("teams", "edit") || currentUser?.role === "admin";
  const canDelete = can("teams", "delete") || currentUser?.role === "admin";

  // State
  const [teams, setTeams] = useState<Team[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [allRoles, setAllRoles] = useState<RoleOption[]>([]);
  const [allCustomers, setAllCustomers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState("all");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Dialogs
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deleteTeamTarget, setDeleteTeamTarget] = useState<Team | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCustomers, setFormCustomers] = useState<string[]>([]);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formMembers, setFormMembers] = useState<
    { userId: number; roleSlug: string; notes: string }[]
  >([]);

  // ─── Data Loading ────────────────────────────────────────────────────
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const [teamsRes, usersRes, rolesRes, custRes] = await Promise.all([
        fetch("/api/teams").then((r) => r.json()),
        fetch("/api/users").then((r) => r.json()),
        fetch("/api/roles").then((r) => r.json()),
        fetch("/api/customers").then((r) => r.json()),
      ]);

      if (teamsRes.teams) setTeams(teamsRes.teams);
      if (usersRes.users) setAllUsers(usersRes.users.filter((u: UserOption) => u.isActive));
      if (rolesRes.roles) setAllRoles(rolesRes.roles.filter((r: RoleOption) => r.slug !== "admin"));
      if (custRes.customers) setAllCustomers(custRes.customers);
    } catch (err) {
      console.error("Failed to load teams data:", err);
      toast.error("Failed to load teams data. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Modal Open Handlers ─────────────────────────────────────────────
  const openCreateDialog = () => {
    setEditingTeam(null);
    setFormName("");
    setFormDescription("");
    setFormCustomers([]);
    setFormIsActive(true);
    setFormMembers([]);
    setIsFormOpen(true);
  };

  const openEditDialog = (team: Team) => {
    setEditingTeam(team);
    setFormName(team.name);
    setFormDescription(team.description || "");
    setFormCustomers(team.customers || []);
    setFormIsActive(team.isActive);
    setFormMembers(
      team.members.map((m) => ({
        userId: m.userId,
        roleSlug: m.roleSlug,
        notes: m.notes || "",
      }))
    );
    setIsFormOpen(true);
  };

  const handleDuplicateTeam = (team: Team) => {
    setEditingTeam(null);
    setFormName(`${team.name} (Copy)`);
    setFormDescription(team.description || "");
    setFormCustomers([...(team.customers || [])]);
    setFormIsActive(true);
    setFormMembers(
      team.members.map((m) => ({
        userId: m.userId,
        roleSlug: m.roleSlug,
        notes: m.notes || "",
      }))
    );
    setIsFormOpen(true);
    toast.info(`Cloned configuration from "${team.name}". Review and save.`);
  };

  // ─── Dynamic Member Helpers ──────────────────────────────────────────
  const handleAddMemberRow = () => {
    const availableUser = allUsers.find((u) => !formMembers.some((m) => m.userId === u.id)) || allUsers[0];
    const defaultRole = availableUser ? availableUser.role : "merchant";

    setFormMembers((prev) => [
      ...prev,
      {
        userId: availableUser ? availableUser.id : 0,
        roleSlug: defaultRole,
        notes: "",
      },
    ]);
  };

  const handleUpdateMember = (
    index: number,
    field: "userId" | "notes",
    val: unknown
  ) => {
    setFormMembers((prev) => {
      const next = [...prev];
      if (field === "userId") {
        const uid = Number(val);
        const selectedUser = allUsers.find((u) => u.id === uid);
        next[index] = {
          ...next[index],
          userId: uid,
          roleSlug: selectedUser?.role || "merchant",
        };
      } else if (field === "notes") {
        next[index] = { ...next[index], notes: String(val) };
      }
      return next;
    });
  };

  const handleRemoveMember = (index: number) => {
    setFormMembers((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Save Team Handler ───────────────────────────────────────────────
  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Please enter a team name.");
      return;
    }

    if (formCustomers.length === 0) {
      toast.warning("Tip: Assigning at least one Customer will map this team's access to cost sheets.");
    }

    setIsSubmitting(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        customers: formCustomers,
        isActive: formIsActive,
        members: formMembers.filter((m) => m.userId > 0 && m.roleSlug),
      };

      let res;
      if (editingTeam) {
        res = await fetch(`/api/teams/${editingTeam.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/teams", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save team");
      }

      toast.success(
        editingTeam
          ? `Team "${formName}" updated successfully!`
          : `Team "${formName}" created successfully!`
      );
      setIsFormOpen(false);
      loadData(true);
    } catch (err) {
      console.error("Save team error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to save team");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Delete Team Handler ─────────────────────────────────────────────
  const handleDeleteTeam = async () => {
    if (!deleteTeamTarget) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/teams/${deleteTeamTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete team");
      }
      toast.success(`Team "${deleteTeamTarget.name}" deleted.`);
      setDeleteTeamTarget(null);
      loadData(true);
    } catch (err) {
      console.error("Delete team error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete team");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Filtered Teams ──────────────────────────────────────────────────
  const filteredTeams = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return teams.filter((t) => {
      if (selectedStatusFilter === "active" && !t.isActive) return false;
      if (selectedStatusFilter === "inactive" && t.isActive) return false;

      if (
        selectedCustomerFilter !== "all" &&
        !t.customers.some((c) => c.toLowerCase() === selectedCustomerFilter.toLowerCase())
      ) {
        return false;
      }

      if (
        selectedRoleFilter !== "all" &&
        !t.members.some((m) => m.roleSlug === selectedRoleFilter)
      ) {
        return false;
      }

      if (q) {
        const matchesName = t.name.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        const matchesCust = t.customers.some((c) => c.toLowerCase().includes(q));
        const matchesMember = t.members.some(
          (m) =>
            m.userDisplayName.toLowerCase().includes(q) ||
            m.userEmail.toLowerCase().includes(q) ||
            (m.roleName && m.roleName.toLowerCase().includes(q)) ||
            (m.notes && m.notes.toLowerCase().includes(q))
        );
        return matchesName || matchesDesc || matchesCust || matchesMember;
      }

      return true;
    });
  }, [teams, searchQuery, selectedStatusFilter, selectedCustomerFilter, selectedRoleFilter]);

  // ─── KPI Stats ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalTeamsCount = teams.length;
    const activeTeamsCount = teams.filter((t) => t.isActive).length;
    const uniqueCustomers = new Set<string>();
    let totalAssignments = 0;
    const assignedUserIds = new Set<number>();

    teams.forEach((t) => {
      if (t.isActive) {
        t.customers.forEach((c) => uniqueCustomers.add(c.toLowerCase()));
        t.members.forEach((m) => {
          totalAssignments++;
          assignedUserIds.add(m.userId);
        });
      }
    });

    return {
      totalTeamsCount,
      activeTeamsCount,
      uniqueCustomersCount: uniqueCustomers.size,
      totalAssignments,
      uniqueUsersAssigned: assignedUserIds.size,
    };
  }, [teams]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* ─── Page Header ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/50 text-[#990000] dark:text-red-400 shadow-2xs">
              <UsersRound className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Manage Teams
                </h1>
                <Badge variant="secondary" className="font-semibold text-xs px-2 py-0.5">
                  {teams.length} {teams.length === 1 ? "Team" : "Teams"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Organize customer-centric teams, map brand portfolios, and assign specialized workflow roles.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing || loading}
            className="h-9 gap-1.5 text-xs font-medium"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>

          {canCreate && (
            <Button
              size="sm"
              onClick={openCreateDialog}
              className="h-9 gap-1.5 font-semibold shadow-sm bg-[#990000] hover:bg-[#800000] text-white"
            >
              <Plus className="size-4" />
              <span>Create New Team</span>
            </Button>
          )}
        </div>
      </div>

      {/* ─── Metric KPI Stats Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Teams</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold">{stats.totalTeamsCount}</span>
                <span className="text-xs text-emerald-600 font-medium">
                  {stats.activeTeamsCount} Active
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-600 dark:text-blue-400">
              <UsersRound className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Customers Mapped</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold">{stats.uniqueCustomersCount}</span>
                <span className="text-xs text-muted-foreground">Brand Portfolios</span>
              </div>
            </div>
            <div className="rounded-lg bg-purple-500/10 p-2.5 text-purple-600 dark:text-purple-400">
              <Building2 className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Assigned Users</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold">{stats.uniqueUsersAssigned}</span>
                <span className="text-xs text-muted-foreground">of {allUsers.length} total users</span>
              </div>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400">
              <UserCheck className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xs border-border/80">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Role Assignments</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-bold">{stats.totalAssignments}</span>
                <span className="text-xs text-muted-foreground">Functional slots</span>
              </div>
            </div>
            <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400">
              <Shield className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Search, Filters & View Toggle Bar ───────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card p-3 rounded-xl border shadow-xs">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative min-w-[240px] flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search team, customer, member or role…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Customer Filter */}
          <select
            value={selectedCustomerFilter}
            onChange={(e) => setSelectedCustomerFilter(e.target.value)}
            aria-label="Filter teams by customer"
            className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-hidden focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Customers</option>
            {allCustomers.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {/* Role Filter */}
          <select
            value={selectedRoleFilter}
            onChange={(e) => setSelectedRoleFilter(e.target.value)}
            aria-label="Filter teams by functional role"
            className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-hidden focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Roles</option>
            {allRoles.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatusFilter}
            onChange={(e) => setSelectedStatusFilter(e.target.value as any)}
            aria-label="Filter teams by status"
            className="h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-hidden focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 self-end sm:self-auto border rounded-lg p-0.5 bg-muted/30">
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="h-7 px-2.5 text-xs gap-1.5"
          >
            <LayoutGrid className="size-3.5" />
            <span>Cards</span>
          </Button>
          <Button
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setViewMode("table")}
            className="h-7 px-2.5 text-xs gap-1.5"
          >
            <TableIcon className="size-3.5" />
            <span>Table</span>
          </Button>
        </div>
      </div>

      {/* ─── Main Content ────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="p-5 space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-16 w-full rounded-md" />
              <Skeleton className="h-20 w-full rounded-md" />
            </Card>
          ))}
        </div>
      ) : filteredTeams.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent className="space-y-3">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted">
              <UsersRound className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold">No teams found</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {searchQuery || selectedCustomerFilter !== "all" || selectedRoleFilter !== "all"
                ? "Try adjusting your search query or filters to find what you're looking for."
                : "Get started by creating your first customer team with assigned roles."}
            </p>
            {canCreate && !searchQuery && (
              <Button onClick={openCreateDialog} size="sm" className="mt-2 gap-1.5 bg-[#990000] hover:bg-[#800000] text-white">
                <Plus className="size-4" />
                <span>Create First Team</span>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        /* ─── CARDS GRID VIEW ───────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTeams.map((team) => (
            <Card
              key={team.id}
              className={`flex flex-col justify-between transition-all duration-200 hover:shadow-md border-border/80 ${
                !team.isActive ? "opacity-75 bg-muted/20" : ""
              }`}
            >
              <div>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base font-bold text-foreground hover:text-primary transition-colors">
                          {team.name}
                        </CardTitle>
                        <Badge
                          variant={team.isActive ? "default" : "secondary"}
                          className={`text-[10px] px-1.5 py-0 h-4 font-medium ${
                            team.isActive
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 border-emerald-500/20"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {team.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {team.description && (
                        <CardDescription className="text-xs line-clamp-2">
                          {team.description}
                        </CardDescription>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {canCreate && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title="Clone / Duplicate Team"
                          onClick={() => handleDuplicateTeam(team)}
                        >
                          <Copy className="size-3.5" />
                        </Button>
                      )}
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title="Edit Team"
                          onClick={() => openEditDialog(team)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:bg-destructive/10"
                          title="Delete Team"
                          onClick={() => setDeleteTeamTarget(team)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  {/* Customer Badges */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1">
                      <Building2 className="size-3" />
                      Assigned Customers ({team.customers.length})
                    </span>
                    <div className="flex flex-wrap gap-1.5 min-h-6">
                      {team.customers.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">
                          No customer restriction (All accessible)
                        </span>
                      ) : (
                        team.customers.map((cust) => (
                          <Badge
                            key={cust}
                            variant="outline"
                            className="bg-primary/5 text-primary border-primary/20 text-[11px] font-medium py-0.5 px-2"
                          >
                            {cust}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Team Members List */}
                  <div className="space-y-2 pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase flex items-center gap-1">
                        <UsersRound className="size-3" />
                        Team Members ({team.members.length})
                      </span>
                    </div>

                    {team.members.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic py-1">
                        No members assigned to this team yet.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                        {team.members.map((m) => {
                          const badgeStyle = getRoleBadgeStyle(m.roleSlug);
                          return (
                            <div
                              key={`${m.userId}-${m.roleSlug}`}
                              className="flex items-center justify-between gap-2 p-1.5 rounded-md bg-muted/40 text-xs border border-transparent hover:border-border transition-colors"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                                  {m.userDisplayName.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium truncate leading-tight">
                                    {m.userDisplayName}
                                  </p>
                                  {m.notes && (
                                    <p className="text-[10px] text-muted-foreground truncate leading-tight">
                                      {m.notes}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0 shrink-0 font-medium ${badgeStyle.bg} ${badgeStyle.border}`}
                              >
                                {m.roleName || m.roleSlug}
                              </Badge>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </div>

              {/* Card Footer */}
              <div className="p-4 pt-0 border-t mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Updated {team.updatedAt ? new Date(team.updatedAt).toLocaleDateString() : "Recently"}
                </span>
                {canEdit && (
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-xs text-primary font-medium"
                    onClick={() => openEditDialog(team)}
                  >
                    Edit Members →
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        /* ─── TABLE VIEW ────────────────────────────────────────────── */
        <Card className="shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-[200px] text-xs font-semibold">Team Name</TableHead>
                  <TableHead className="w-[80px] text-xs font-semibold">Status</TableHead>
                  <TableHead className="w-[240px] text-xs font-semibold">Assigned Customers</TableHead>
                  <TableHead className="text-xs font-semibold">Members & Functional Roles</TableHead>
                  <TableHead className="w-[120px] text-right text-xs font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTeams.map((team) => (
                  <TableRow key={team.id} className="hover:bg-muted/30">
                    <TableCell className="align-top py-3">
                      <div className="font-semibold text-sm">{team.name}</div>
                      {team.description && (
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {team.description}
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="align-top py-3">
                      <Badge
                        variant={team.isActive ? "default" : "secondary"}
                        className={`text-[10px] px-1.5 py-0 h-4 font-medium ${
                          team.isActive
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {team.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>

                    <TableCell className="align-top py-3">
                      <div className="flex flex-wrap gap-1">
                        {team.customers.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">
                            All Customers
                          </span>
                        ) : (
                          team.customers.map((c) => (
                            <Badge
                              key={c}
                              variant="outline"
                              className="text-[10px] bg-primary/5 text-primary border-primary/20 py-0 px-1.5"
                            >
                              {c}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="align-top py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {team.members.map((m) => {
                          const badgeStyle = getRoleBadgeStyle(m.roleSlug);
                          return (
                            <div
                              key={`${m.userId}-${m.roleSlug}`}
                              className="inline-flex items-center gap-1.5 bg-muted/60 px-2 py-0.5 rounded text-xs border"
                            >
                              <span className="font-medium text-foreground">
                                {m.userDisplayName}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[9px] px-1 py-0 ${badgeStyle.bg} ${badgeStyle.border}`}
                              >
                                {m.roleName || m.roleSlug}
                              </Badge>
                            </div>
                          );
                        })}
                        {team.members.length === 0 && (
                          <span className="text-xs text-muted-foreground italic">
                            No members assigned
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="align-top text-right py-3">
                      <div className="flex items-center justify-end gap-1">
                        {canCreate && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Duplicate"
                            onClick={() => handleDuplicateTeam(team)}
                          >
                            <Copy className="size-3.5 text-muted-foreground" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7"
                            title="Edit"
                            onClick={() => openEditDialog(team)}
                          >
                            <Pencil className="size-3.5 text-muted-foreground" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:bg-destructive/10"
                            title="Delete"
                            onClick={() => setDeleteTeamTarget(team)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ─── CREATE / EDIT TEAM DIALOG (SPACIOUS & BEAUTIFULLY STYLED) ── */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl border bg-background">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/50 text-[#990000] dark:text-red-400">
                <UsersRound className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  {editingTeam ? `Edit Team: ${editingTeam.name}` : "Create New Customer Team"}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Group team members by customer portfolio and assign dedicated functional roles for cost sheet approvals.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveTeam} className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Step 1: Team Information */}
            <div className="rounded-xl border bg-card/60 p-4 space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-border/60">
                <span className="flex size-5 items-center justify-center rounded-full bg-[#990000] text-[11px] text-white font-bold">
                  1
                </span>
                <h3 className="text-sm font-bold text-foreground">
                  Team Information
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1.5">
                  <Label htmlFor="team-name" className="text-xs font-semibold text-foreground">
                    Team Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="team-name"
                    placeholder="e.g. Levi's Core Merchandising Team"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="team-status" className="text-xs font-semibold text-foreground">
                    Status
                  </Label>
                  <select
                    id="team-status"
                    value={formIsActive ? "active" : "inactive"}
                    onChange={(e) => setFormIsActive(e.target.value === "active")}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-xs focus:outline-hidden focus:ring-2 focus:ring-ring"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>

                <div className="md:col-span-3 space-y-1.5">
                  <Label htmlFor="team-desc" className="text-xs font-semibold text-foreground">
                    Description / Scope <span className="text-muted-foreground font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id="team-desc"
                    placeholder="e.g. Dedicated costing team managing US & European denim styles"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Customer Portfolio */}
            <div className="rounded-xl border bg-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-[#990000] text-[11px] text-white font-bold">
                    2
                  </span>
                  <h3 className="text-sm font-bold text-foreground">
                    Customer Portfolio
                  </h3>
                </div>
                <Badge variant="outline" className="text-[11px] font-semibold bg-primary/5 text-primary border-primary/20">
                  {formCustomers.length} {formCustomers.length === 1 ? "Customer" : "Customers"} Selected
                </Badge>
              </div>

              <div className="space-y-2 pt-1">
                <CustomerMultiSelect
                  customers={allCustomers}
                  selected={formCustomers}
                  onChange={setFormCustomers}
                  placeholder="Search and select customer brands for this team…"
                />
                <p className="text-[11px] text-muted-foreground">
                  All assigned members will automatically inherit access and approval rights for Cost Sheets belonging to these selected customer brands.
                </p>
              </div>
            </div>

            {/* Step 3: Team Members & Functional Roles */}
            <div className="rounded-xl border bg-card/60 p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-border/60">
                <div className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-[#990000] text-[11px] text-white font-bold">
                    3
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Team Members & Functional Roles
                    </h3>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddMemberRow}
                  className="h-8 gap-1.5 text-xs font-semibold border-red-200 dark:border-red-900/60 text-[#990000] dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                >
                  <UserPlus className="size-3.5" />
                  <span>Add Member</span>
                </Button>
              </div>

              {formMembers.length === 0 ? (
                <div className="rounded-xl border border-dashed p-8 text-center bg-muted/20 space-y-3">
                  <div className="size-10 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                    <UsersRound className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">
                      No members assigned to this team yet.
                    </p>
                    <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                      Add users and assign their specialized workflow roles (Merchant, Fabric, MMC, IE, Washing, Marketing).
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddMemberRow}
                    className="h-8 text-xs gap-1.5 bg-background shadow-xs font-medium"
                  >
                    <Plus className="size-3.5" />
                    <span>Assign First Member</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Table Column Headers on Desktop */}
                  <div className="hidden sm:grid sm:grid-cols-12 gap-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <div className="sm:col-span-5">User Account</div>
                    <div className="sm:col-span-3">Role in Team</div>
                    <div className="sm:col-span-3">Notes / Responsibilities</div>
                    <div className="sm:col-span-1 text-right">Action</div>
                  </div>

                  {/* Member Rows */}
                  <div className="space-y-2">
                    {formMembers.map((member, idx) => {
                      const selectedUser = allUsers.find((u) => u.id === member.userId);
                      return (
                        <div
                          key={idx}
                          className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 rounded-lg border bg-background items-center shadow-2xs hover:border-primary/40 transition-colors"
                        >
                          {/* User Picker */}
                          <div className="sm:col-span-5 space-y-1 sm:space-y-0">
                            <span className="sm:hidden text-[10px] font-semibold text-muted-foreground uppercase block">
                              User Account
                            </span>
                            <select
                              value={member.userId}
                              onChange={(e) => handleUpdateMember(idx, "userId", e.target.value)}
                              aria-label="Select user account"
                              className="w-full h-9 rounded-md border border-input bg-background px-2.5 text-xs focus:outline-hidden focus:ring-1 focus:ring-ring"
                            >
                              <option value={0}>Select a user…</option>
                              {allUsers.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.displayName || u.email} ({u.email})
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Functional Role (Derived from User Profile) */}
                          <div className="sm:col-span-3 space-y-1 sm:space-y-0">
                            <span className="sm:hidden text-[10px] font-semibold text-muted-foreground uppercase block">
                              Role in Team
                            </span>
                            <div className="h-9 flex items-center px-2.5 rounded-md border border-input/60 bg-muted/40 text-xs">
                              {selectedUser ? (
                                <Badge
                                  variant="outline"
                                  className={`text-[11px] px-2 py-0.5 font-semibold ${getRoleBadgeStyle(selectedUser.role).bg} ${getRoleBadgeStyle(selectedUser.role).border}`}
                                >
                                  {allRoles.find((r) => r.slug === selectedUser.role)?.name ||
                                    selectedUser.role}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground italic text-xs">
                                  Select user first
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Notes / Responsibility */}
                          <div className="sm:col-span-3 space-y-1 sm:space-y-0">
                            <span className="sm:hidden text-[10px] font-semibold text-muted-foreground uppercase block">
                              Notes / Lead
                            </span>
                            <Input
                              placeholder="e.g. Lead Merchant, Primary IE"
                              value={member.notes}
                              onChange={(e) => handleUpdateMember(idx, "notes", e.target.value)}
                              className="h-9 text-xs"
                            />
                          </div>

                          {/* Remove Button */}
                          <div className="sm:col-span-1 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveMember(idx)}
                              className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md"
                              title="Remove member from team"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="pt-4 border-t gap-2.5 shrink-0 bg-muted/20 px-6 py-4 -mx-6 -mb-6 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFormOpen(false)}
                disabled={isSubmitting}
                className="text-xs h-9 px-4 font-medium"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="text-xs h-9 font-semibold min-w-[120px] bg-[#990000] hover:bg-[#800000] text-white shadow-xs"
              >
                {isSubmitting ? (
                  <RefreshCw className="size-3.5 animate-spin mr-1.5" />
                ) : null}
                <span>{editingTeam ? "Save Changes" : "Create Team"}</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── DELETE CONFIRMATION DIALOG ─────────────────────────────── */}
      <Dialog
        open={Boolean(deleteTeamTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTeamTarget(null);
        }}
      >
        <DialogContent className="w-[90vw] sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-5" />
              <span>Delete Team</span>
            </DialogTitle>
            <DialogDescription className="text-xs pt-2">
              Are you sure you want to delete the team{" "}
              <strong className="text-foreground">{deleteTeamTarget?.name}</strong>?
              {deleteTeamTarget && deleteTeamTarget.members.length > 0 && (
                <span className="block mt-1 text-destructive font-medium">
                  This will remove {deleteTeamTarget.members.length} member assignment(s). This action cannot be undone.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteTeamTarget(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteTeam}
              disabled={isSubmitting}
            >
              {isSubmitting ? <RefreshCw className="size-3.5 animate-spin mr-1.5" /> : null}
              Delete Team
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
