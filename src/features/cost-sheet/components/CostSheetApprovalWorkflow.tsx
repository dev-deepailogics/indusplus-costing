"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  Layers,
  Scissors,
  Timer,
  Droplets,
  TrendingUp,
  Briefcase,
  Crown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { approveCostSheet } from "@/lib/cost-sheet/api";
import { useAuth } from "@/lib/auth/auth-provider";
import type {
  CostSheetApprovals,
  ApprovalStage,
  ApprovalStep,
} from "../types";

interface Props {
  costSheetId: string;
  approvals?: CostSheetApprovals;
  onApprovalUpdated: (updatedApprovals: CostSheetApprovals, status: string) => void;
  onBeforeAction?: (
    stage: ApprovalStage,
    action: "approve" | "reject" | "revoke"
  ) => Promise<boolean | void>;
}

interface StepConfig {
  stage: ApprovalStage;
  title: string;
  /** Permission section key for this approval stage (e.g. "approval_fabric") */
  permissionSection: string;
  roleLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}

const STEPS: StepConfig[] = [
  {
    stage: "fabric",
    title: "Fabric Details",
    permissionSection: "approval_fabric",
    roleLabel: "Fabric Head",
    icon: Layers,
    description: "Locks fabric code, consumption, rates, and costs.",
  },
  {
    stage: "mmc",
    title: "Trims & Accessories",
    permissionSection: "approval_mmc",
    roleLabel: "MMC Head",
    icon: Scissors,
    description: "Locks trims categories, items, consumption, rates, and costs.",
  },
  {
    stage: "ie",
    title: "IE & SAMs",
    permissionSection: "approval_ie",
    roleLabel: "IE Head",
    icon: Timer,
    description: "Locks Sewing, Washing, Finishing, and Cutting SAMs.",
  },
  {
    stage: "washing",
    title: "Washing Rates",
    permissionSection: "approval_washing",
    roleLabel: "Washing Head",
    icon: Droplets,
    description: "Locks washing unit prices and recipe items for non-washing users.",
  },
  {
    stage: "marketing",
    title: "Marketing Approval",
    permissionSection: "approval_marketing",
    roleLabel: "Marketing",
    icon: TrendingUp,
    description: "Reviews commercial FOB pricing after departmental sign-offs.",
  },
  {
    stage: "costingHead",
    title: "Costing Head",
    permissionSection: "approval_costing_head",
    roleLabel: "Costing Head",
    icon: Briefcase,
    description: "Verifies margins, overhead absorption, and conversion costs.",
  },
  {
    stage: "director",
    title: "Director Sign-off",
    permissionSection: "approval_director",
    roleLabel: "Director",
    icon: Crown,
    description: "Final authorization that permanently locks the entire cost sheet.",
  },
];

export function CostSheetApprovalWorkflow({
  costSheetId,
  approvals = {},
  onApprovalUpdated,
  onBeforeAction,
}: Props) {
  const { user, role, can } = useAuth();
  const isAdmin = role === "admin";

  const [activeModal, setActiveModal] = useState<{
    stage: ApprovalStage;
    action: "approve" | "reject" | "revoke";
  } | null>(null);
  const [commentInput, setCommentInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Departmental completeness check
  const fabricApproved = approvals.fabric?.status === "approved";
  const mmcApproved = approvals.mmc?.status === "approved";
  const ieApproved = approvals.ie?.status === "approved";
  const washingApproved = approvals.washing?.status === "approved";
  const deptCompleted = fabricApproved && mmcApproved && ieApproved && washingApproved;

  const marketingApproved = approvals.marketing?.status === "approved";
  const costingHeadApproved = approvals.costingHead?.status === "approved";
  const directorApproved = approvals.director?.status === "approved";

  const overallStatus = approvals.overallStatus || "draft";

  function canPerform(stage: ApprovalStage, action: "approve" | "reject" | "revoke"): {
    allowed: boolean;
    reason?: string;
  } {
    const stepConfig = STEPS.find((s) => s.stage === stage);
    if (!stepConfig) return { allowed: false, reason: "Unknown stage" };

    if (!isAdmin && !can(stepConfig.permissionSection, "approve")) {
      return {
        allowed: false,
        reason: `Only ${stepConfig.roleLabel} (or Admin) can perform this action.`,
      };
    }

    if (action === "approve") {
      if (stage === "marketing" && !deptCompleted) {
        return {
          allowed: false,
          reason: "Fabric, MMC, IE, and Washing must all be approved first.",
        };
      }
      if (stage === "costingHead" && !marketingApproved) {
        return {
          allowed: false,
          reason: "Marketing approval is required before Costing Head approval.",
        };
      }
      if (stage === "director" && !costingHeadApproved) {
        return {
          allowed: false,
          reason: "Costing Head approval is required before Director approval.",
        };
      }
    }

    if (action === "revoke") {
      if (stage === "fabric" || stage === "mmc" || stage === "ie" || stage === "washing") {
        if (directorApproved && !isAdmin) {
          return {
            allowed: false,
            reason: "Locked: Final Director sign-off is complete.",
          };
        }
        if (costingHeadApproved && !isAdmin) {
          return {
            allowed: false,
            reason: "Locked: Costing Head has approved. Costing Head must revoke first.",
          };
        }
        if (marketingApproved && !isAdmin) {
          return {
            allowed: false,
            reason: "Locked: Marketing has approved. Marketing must revoke first.",
          };
        }
      }

      if (stage === "marketing") {
        if (directorApproved && !isAdmin) {
          return {
            allowed: false,
            reason: "Locked: Final Director sign-off is complete.",
          };
        }
        if (costingHeadApproved && !isAdmin) {
          return {
            allowed: false,
            reason: "Locked: Costing Head has approved. Costing Head must revoke first.",
          };
        }
      }

      if (stage === "costingHead") {
        if (directorApproved && !isAdmin) {
          return {
            allowed: false,
            reason: "Locked: Final Director sign-off is complete. Director must revoke first.",
          };
        }
      }
    }

    return { allowed: true };
  }

  async function handleConfirmAction() {
    if (!activeModal) return;
    const { stage, action } = activeModal;

    if (action === "reject" && (!commentInput || commentInput.trim() === "")) {
      toast.error("Please provide remarks explaining the rejection.");
      return;
    }

    setIsProcessing(true);
    try {
      if (onBeforeAction) {
        const canProceed = await onBeforeAction(stage, action);
        if (canProceed === false) {
          setIsProcessing(false);
          return;
        }
      }

      const res = await approveCostSheet(costSheetId, {
        stage,
        action,
        comments: commentInput,
      });

      onApprovalUpdated(res.approvals, res.approvalStatus);
      toast.success(
        action === "approve"
          ? `${stage.toUpperCase()} approved successfully.`
          : action === "reject"
          ? `${stage.toUpperCase()} rejected.`
          : `${stage.toUpperCase()} approval revoked.`
      );
      setActiveModal(null);
      setCommentInput("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Approval action failed.");
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <Card className="border-border/70 shadow-sm bg-card overflow-hidden">
      {/* Banner / Status Header */}
      <div className="bg-slate-900 text-white px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-5 text-emerald-400" />
          <div>
            <h2 className="text-sm font-bold tracking-tight">Costing Approval Workflow</h2>
            <p className="text-[11px] text-slate-300">
              Multi-department verification chain following production protocol.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-300 font-medium">Overall Status:</span>
          {overallStatus === "fully_approved" ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs px-2.5 py-0.5 flex items-center gap-1.5 shadow-xs">
              <CheckCircle2 className="size-3.5" />
              Director Approved (Final)
            </Badge>
          ) : overallStatus === "costing_approved" ? (
            <Badge className="bg-indigo-600 hover:bg-indigo-600 text-white font-bold text-xs px-2.5 py-0.5 flex items-center gap-1.5 shadow-xs">
              <CheckCircle2 className="size-3.5" />
              Costing Head Approved
            </Badge>
          ) : overallStatus === "marketing_approved" ? (
            <Badge className="bg-purple-600 hover:bg-purple-600 text-white font-bold text-xs px-2.5 py-0.5 flex items-center gap-1.5 shadow-xs">
              <CheckCircle2 className="size-3.5" />
              Marketing Approved
            </Badge>
          ) : overallStatus === "in_review" ? (
            <Badge className="bg-blue-600 hover:bg-blue-600 text-white font-bold text-xs px-2.5 py-0.5 flex items-center gap-1.5 shadow-xs">
              <Clock className="size-3.5" />
              In Review ({[fabricApproved, mmcApproved, ieApproved, washingApproved].filter(Boolean).length}/4 Depts)
            </Badge>
          ) : overallStatus === "rejected" ? (
            <Badge variant="destructive" className="font-bold text-xs px-2.5 py-0.5 flex items-center gap-1.5 shadow-xs">
              <XCircle className="size-3.5" />
              Rejected / Needs Revision
            </Badge>
          ) : (
            <Badge variant="secondary" className="font-semibold text-xs px-2.5 py-0.5">
              Draft Mode
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-4 space-y-4">
        {/* Horizontal Flow Steps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
          {STEPS.map((step, idx) => {
            const stepData = approvals[step.stage] as ApprovalStep | undefined;
            const status = stepData?.status || "pending";
            const isApproved = status === "approved";
            const isRejected = status === "rejected";
            const Icon = step.icon;

            const check = canPerform(step.stage, "approve");
            const canApprove = check.allowed;
            const canRevoke = canPerform(step.stage, "revoke").allowed;

            return (
              <div
                key={step.stage}
                className={`rounded-lg border p-2.5 flex flex-col justify-between transition-all overflow-hidden relative ${
                  isApproved
                    ? "border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/20"
                    : isRejected
                    ? "border-red-500/50 bg-red-50/40 dark:bg-red-950/20"
                    : "border-border bg-card/60 hover:border-slate-400/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Step {idx + 1}
                    </span>
                    {isApproved ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="size-3.5" /> Approved
                      </span>
                    ) : isRejected ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 shrink-0">
                        <XCircle className="size-3.5" /> Rejected
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                        <Clock className="size-3" /> Pending
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-1">
                    <div
                      className={`p-1.5 rounded-md shrink-0 ${
                        isApproved
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300"
                          : isRejected
                          ? "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold leading-tight truncate" title={step.title}>{step.title}</h4>
                      <p className="text-[10px] text-muted-foreground truncate" title={step.roleLabel}>{step.roleLabel}</p>
                    </div>
                  </div>

                  {stepData?.approvedBy && (
                    <div className="mt-2 text-[10px] text-muted-foreground bg-muted/40 p-1.5 rounded border border-border/60">
                      <p className="truncate font-medium text-foreground">
                        By: {stepData.approvedBy}
                      </p>
                      {stepData.approvedAt && (
                        <p className="text-[9px]">
                          {new Date(stepData.approvedAt).toLocaleDateString()}{" "}
                          {new Date(stepData.approvedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                      {stepData.comments && (
                        <p className="italic text-[10px] mt-0.5 text-foreground/80 line-clamp-2" title={stepData.comments}>
                          &ldquo;{stepData.comments}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-3 pt-2 border-t border-border/40 flex flex-col gap-1.5">
                  {!isApproved ? (
                    <div className="grid grid-cols-2 gap-1.5 w-full">
                      <Button
                        size="sm"
                        disabled={!canApprove || isProcessing}
                        onClick={() => {
                          setCommentInput("");
                          setActiveModal({ stage: step.stage, action: "approve" });
                        }}
                        className={`w-full h-7 px-1 text-[11px] font-semibold truncate ${
                          canApprove
                            ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                            : "bg-slate-100 hover:bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 border border-slate-200 dark:border-slate-800 cursor-not-allowed shadow-none"
                        }`}
                        title={check.reason || `Approve as ${step.roleLabel}`}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!canApprove || isProcessing}
                        onClick={() => {
                          setCommentInput("");
                          setActiveModal({ stage: step.stage, action: "reject" });
                        }}
                        className={`w-full h-7 px-1 text-[11px] font-semibold truncate ${
                          canApprove
                            ? "text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 dark:border-red-900/60 dark:hover:bg-red-950/40"
                            : "text-slate-400 dark:text-slate-600 border-slate-200 dark:border-slate-800 cursor-not-allowed opacity-50 shadow-none"
                        }`}
                        title="Reject with remarks"
                      >
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!canRevoke || isProcessing}
                      onClick={() => {
                        setCommentInput("");
                        setActiveModal({ stage: step.stage, action: "revoke" });
                      }}
                      className="w-full h-7 text-[11px] text-muted-foreground hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                      title="Revoke approval"
                    >
                      <RotateCcw className="size-3 mr-1" /> Revoke
                    </Button>
                  )}

                  {!canApprove && !isApproved && check.reason && (
                    <span className="text-[9px] text-muted-foreground text-center leading-tight">
                      {check.reason}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* Approval / Rejection Dialog */}
      <Dialog open={!!activeModal} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {activeModal?.action === "approve" && (
                <>
                  <CheckCircle2 className="size-5 text-emerald-600" />
                  Approve {activeModal.stage.toUpperCase()}
                </>
              )}
              {activeModal?.action === "reject" && (
                <>
                  <XCircle className="size-5 text-red-600" />
                  Reject {activeModal?.stage.toUpperCase()}
                </>
              )}
              {activeModal?.action === "revoke" && (
                <>
                  <AlertTriangle className="size-5 text-amber-600" />
                  Revoke Approval for {activeModal?.stage.toUpperCase()}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {activeModal?.action === "approve" &&
                "Confirm approval for this section. Relevant inputs will be locked in the Cost Sheet."}
              {activeModal?.action === "reject" &&
                "Rejecting this section requires specifying the reason so the merchandiser can make adjustments."}
              {activeModal?.action === "revoke" &&
                "Are you sure you want to revoke approval? Any subsequent approval stages will be reset."}
            </DialogDescription>
          </DialogHeader>

          {activeModal?.action !== "revoke" && (
            <div className="space-y-2 py-2">
              <Label htmlFor="approval-comments" className="text-xs font-semibold">
                {activeModal?.action === "reject" ? "Reason for Rejection *" : "Remarks / Comments (Optional)"}
              </Label>
              <textarea
                id="approval-comments"
                rows={3}
                placeholder={
                  activeModal?.action === "reject"
                    ? "Explain what needs to be changed..."
                    : "Add any approval notes or verifications..."
                }
                value={commentInput}
                onChange={(e) => setCommentInput(e.target.value)}
                className="w-full text-xs p-2.5 rounded-md border border-input bg-background shadow-2xs focus:outline-none focus:ring-1 focus:ring-primary font-normal"
              />
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveModal(null)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmAction}
              disabled={isProcessing}
              className={
                activeModal?.action === "reject"
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : activeModal?.action === "revoke"
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white"
              }
            >
              {isProcessing
                ? "Processing…"
                : activeModal?.action === "approve"
                ? "Confirm Approval"
                : activeModal?.action === "reject"
                ? "Confirm Rejection"
                : "Confirm Revoke"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
