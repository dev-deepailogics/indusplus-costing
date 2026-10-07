"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Plus, KeyRound, Power, Trash2, Search, X } from "lucide-react";
import { useUsersFacade } from "../hooks/useUsersFacade";
import { type UserProfile } from "../types";
import type { RoleDefinition } from "@/lib/rbac/permissions";

import { useAuth } from "@/lib/auth/auth-provider";

// ── Client-side password generator (mirrors server-side logic) ──
function generatePasswordClient(length = 16): string {
  const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lower = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const symbols = "!@#$%^&*_+-=";
  const all = upper + lower + digits + symbols;

  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);

  const mandatory = [
    upper[arr[0] % upper.length],
    lower[arr[1] % lower.length],
    digits[arr[2] % digits.length],
    symbols[arr[3] % symbols.length],
  ];

  const remaining: string[] = [];
  for (let i = mandatory.length; i < length; i++) {
    remaining.push(all[arr[i] % all.length]);
  }

  const chars = [...mandatory, ...remaining];
  // Fisher-Yates shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = arr[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export function UsersTable() {
  const { user: currentUser, can } = useAuth();
  const isAdmin = currentUser?.role === "admin";
  const canCreate = isAdmin || can("page_users", "create");
  const canEdit = isAdmin || can("page_users", "edit");
  const canDelete = isAdmin || can("page_users", "delete");

  const {
    users,
    currentUserId,
    loading,
    updateRole,
    toggleActive,
    deleteUser,
    createUser,
    adminResetPassword,
  } = useUsersFacade();

  // Fetch roles from API for dynamic dropdowns
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    fetch("/api/roles")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.roles)) {
          setRoles(data.roles);
        }
      })
      .catch(() => {
        setRoles([]);
      })
      .finally(() => setRolesLoading(false));
  }, []);

  // Build a map of slug -> label for display
  const roleLabels: Record<string, string> = {};
  for (const r of roles) {
    roleLabels[r.slug] = r.name;
  }

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Dynamic role options for dropdown
  const filterRoleOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of roles) {
      map.set(r.slug, r.name);
    }
    for (const u of users) {
      if (u.role && !map.has(u.role)) {
        map.set(u.role, roleLabels[u.role] ?? u.role);
      }
    }
    return Array.from(map.entries()).map(([slug, name]) => ({ slug, name }));
  }, [roles, users, roleLabels]);

  // Filtered users list
  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) {
        return false;
      }
      if (q) {
        const nameMatch = (u.displayName ?? "").toLowerCase().includes(q);
        const emailMatch = (u.email ?? "").toLowerCase().includes(q);
        return nameMatch || emailMatch;
      }
      return true;
    });
  }, [users, searchQuery, roleFilter]);

  // Create User dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("merchant");
  const [creating, setCreating] = useState(false);

  // Reset Password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState<UserProfile | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resettingPw, setResettingPw] = useState(false);

  // Delete User confirmation dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [deleting, setDeleting] = useState(false);

  function openCreateDialog() {
    setNewEmail("");
    setNewDisplayName("");
    setNewPassword("");
    setNewRole("merchant");
    setCreateOpen(true);
  }

  function openDeleteDialog(u: UserProfile) {
    setUserToDelete(u);
    setDeleteOpen(true);
  }

  async function handleDeleteUser() {
    if (!userToDelete) return;
    setDeleting(true);
    try {
      await deleteUser(userToDelete.id);
      setDeleteOpen(false);
      setUserToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await createUser({
        email: newEmail,
        displayName: newDisplayName,
        password: newPassword,
        role: newRole,
      });
      setCreateOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user.");
    } finally {
      setCreating(false);
    }
  }

  function openResetDialog(u: UserProfile) {
    setResetUser(u);
    setResetPassword("");
    setResetOpen(true);
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetUser) return;
    if (resetPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setResettingPw(true);
    try {
      await adminResetPassword(resetUser.id, resetPassword);
      setResetOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setResettingPw(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48 rounded-md" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight">Manage Users</h1>
          {(searchQuery || roleFilter !== "all") && (
            <Badge variant="secondary" className="font-semibold text-xs px-2 py-0.5">
              {filteredUsers.length} of {users.length}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search by name or email */}
          <div className="relative w-64 sm:w-72">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search name, email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8.5 pr-8 h-9 text-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                title="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Roles Dropdown Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            aria-label="Filter users by role"
            className="h-9 rounded-md border border-input bg-background px-3 text-xs font-medium focus:outline-hidden focus:ring-1 focus:ring-ring cursor-pointer"
          >
            <option value="all">All Roles</option>
            {filterRoleOptions.map((r) => (
              <option key={r.slug} value={r.slug}>
                {r.name}
              </option>
            ))}
          </select>

          {canCreate && (
            <Button
              onClick={openCreateDialog}
              size="sm"
              className="h-9 gap-1.5 font-semibold bg-[#990000] hover:bg-[#800000] text-white shadow-xs"
            >
              <Plus className="size-4" />
              Create User
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((u) => {
              const isSelf = u.id === currentUserId;
              const isTargetAdmin = u.role === "admin";
              const canModifyThisUser = !isSelf && (isAdmin || !isTargetAdmin);

              return (
                <TableRow key={u.id} className={!u.isActive ? "opacity-50" : ""}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {u.displayName ?? "—"}
                      {u.mustResetPassword && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          Must reset
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>
                    {!canModifyThisUser || !canEdit ? (
                      <Badge variant="default" className="font-semibold text-xs">
                        {roleLabels[u.role] ?? u.role}
                      </Badge>
                    ) : (
                      <select
                        value={u.role}
                        onChange={(e) => updateRole(u.id, e.target.value)}
                        className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium shadow-2xs hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        <>
                          {!roles.some((r) => r.slug === u.role) && (
                            <option value={u.role}>
                              {roleLabels[u.role] ?? u.role}
                            </option>
                          )}
                          {roles.map((r) => (
                            <option key={r.slug} value={r.slug}>
                              {r.name}
                            </option>
                          ))}
                        </>
                      </select>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? "default" : "destructive"}>
                      {u.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1.5">
                      {canEdit && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canModifyThisUser}
                            onClick={() => openResetDialog(u)}
                            title="Reset Password"
                          >
                            <KeyRound className="size-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!canModifyThisUser}
                            onClick={() => toggleActive(u)}
                            title={u.isActive ? "Deactivate" : "Activate"}
                          >
                            <Power className="size-3.5" />
                          </Button>
                        </>
                      )}
                      {canDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!canModifyThisUser}
                          onClick={() => openDeleteDialog(u)}
                          title="Delete User"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                  {searchQuery || roleFilter !== "all" ? (
                    <div className="space-y-1.5 max-w-sm mx-auto">
                      <p className="text-sm font-medium text-foreground">No users match your filters.</p>
                      <p className="text-xs text-muted-foreground">
                        Try searching for a different keyword or resetting your filter options.
                      </p>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => {
                          setSearchQuery("");
                          setRoleFilter("all");
                        }}
                        className="text-xs text-[#990000] p-0 h-auto font-medium"
                      >
                        Reset filters
                      </Button>
                    </div>
                  ) : (
                    "No users found."
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. They will be required to change their password on first login.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleCreateUser}>
            <div className="space-y-1.5">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-displayName">Display Name</Label>
              <Input
                id="create-displayName"
                type="text"
                required
                value={newDisplayName}
                onChange={(e) => setNewDisplayName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-password">Password</Label>
              <div className="flex gap-2">
                <Input
                  id="create-password"
                  type="text"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setNewPassword(generatePasswordClient())}
                  className="shrink-0"
                  title="Generate Password"
                >
                  <RefreshCw className="size-3.5 mr-1" />
                  Generate
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="create-role">Role</Label>
              <select
                id="create-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {roles.map((r) => (
                  <option key={r.slug} value={r.slug}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={creating}>
              {creating ? "Creating…" : "Create User"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for{" "}
              <span className="font-medium text-foreground">{resetUser?.email}</span>.
              The user will be required to change it on next login.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={handleResetPassword}>
            <div className="space-y-1.5">
              <Label htmlFor="reset-password">New Password</Label>
              <div className="flex gap-2">
                <Input
                  id="reset-password"
                  type="text"
                  required
                  minLength={6}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setResetPassword(generatePasswordClient())}
                  className="shrink-0"
                  title="Generate Password"
                >
                  <RefreshCw className="size-3.5 mr-1" />
                  Generate
                </Button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={resettingPw}>
              {resettingPw ? "Resetting…" : "Reset Password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/50 text-red-600">
                <Trash2 className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold text-destructive">
                  Delete User
                </DialogTitle>
                <DialogDescription className="text-xs">
                  This action cannot be undone.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            Are you sure you want to permanently delete user{" "}
            <span className="font-semibold text-foreground">
              {userToDelete?.displayName || userToDelete?.email}
            </span>{" "}
            {userToDelete?.displayName && (
              <span>({userToDelete.email})</span>
            )}?
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDeleteOpen(false);
                setUserToDelete(null);
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
