import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getPool } from "@/lib/db";
import { APPROVAL_STAGE_TO_SECTION } from "@/lib/rbac/permissions";
import { checkSessionPermission } from "@/lib/rbac/server";
import { canUserAccessCostSheet, rowToCostSheetItem } from "@/lib/cost-sheet/auth";
import { ensureCostSheetTable, resolveTeamCustomers } from "@/lib/cost-sheet/db";
import type {
  ApprovalStage,
  CostSheetApprovals,
  ApprovalStep,
} from "@/features/cost-sheet/types";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
    }

    const { stage, action, comments } = body as {
      stage: ApprovalStage;
      action: "approve" | "reject" | "revoke";
      comments?: string;
    };

    if (!stage || !["cad", "fabric", "mmc", "ie", "washing", "marketing", "costingHead", "director"].includes(stage)) {
      return NextResponse.json({ error: "Invalid approval stage" }, { status: 400 });
    }

    if (!action || !["approve", "reject", "revoke"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    // Map approval stage to permission section key
    const permissionSection = APPROVAL_STAGE_TO_SECTION[stage];
    if (!permissionSection) {
      return NextResponse.json(
        { error: `Unknown approval stage: ${stage}` },
        { status: 400 }
      );
    }

    const hasPerm = await checkSessionPermission(session, permissionSection, "approve");
    if (!hasPerm) {
      return NextResponse.json(
        { error: `Forbidden: You do not have permission to perform actions on ${stage}` },
        { status: 403 }
      );
    }

    if (action === "reject" && (!comments || comments.trim() === "")) {
      return NextResponse.json(
        { error: "A comment explaining the reason for rejection is required." },
        { status: 400 }
      );
    }

    const pool = await getPool();
    await ensureCostSheetTable(pool);

    // Fetch the cost sheet — full row needed for BOM validation and approvals JSON
    const res = await pool
      .request()
      .input("id", id)
      .query("SELECT * FROM pre_order_cost_sheets WHERE id = @id");

    if (res.recordset.length === 0) {
      return NextResponse.json({ error: "Cost sheet not found" }, { status: 404 });
    }

    const sheetItem = rowToCostSheetItem(res.recordset[0]);
    const teamCustomers = await resolveTeamCustomers(pool, session);
    const sessionWithTeams = { ...session, teamCustomers };

    if (!canUserAccessCostSheet(sessionWithTeams, sheetItem)) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to perform actions on this cost sheet." },
        { status: 403 }
      );
    }

    let approvals: CostSheetApprovals = {};
    if (res.recordset[0].approvals) {
      try {
        approvals = JSON.parse(res.recordset[0].approvals);
      } catch {
        approvals = {};
      }
    }

    // Check if entire cost sheet is already finalized by Director
    const isDirectorApproved = approvals.director?.status === "approved";
    if (isDirectorApproved && stage !== "director" && action !== "revoke") {
      return NextResponse.json(
        { error: "This cost sheet has been finalized by the Director and cannot be modified." },
        { status: 400 }
      );
    }

    // Input Data Validation for each approval stage
    if (action === "approve") {
      const row = res.recordset[0];

      // Stage: Fabric Details
      if (stage === "fabric") {
        let fabrics: any[] = [];
        let linings: any[] = [];
        try { fabrics = JSON.parse(row.bom_fabric || "[]"); } catch {}
        try { linings = JSON.parse(row.bom_lining || "[]"); } catch {}

        const hasValidFabric = Array.isArray(fabrics) && fabrics.some((f) => {
          if (!f || typeof f !== "object") return false;
          const name = (f.itemName || "").trim();
          const cons = Number(f.consumptionPerPc ?? f.consumptionMtr ?? f.consPerPc ?? 0);
          const rate = Number(f.ratePKR ?? f.rateUSD ?? 0);
          const cost = Number(f.fabricCostPKR ?? f.costPKR ?? 0);
          const hasName = name !== "" && !name.startsWith("--");
          return (hasName && (cons > 0 || rate > 0 || cost > 0)) || cost > 0 || (cons > 0 && rate > 0);
        });

        const hasValidLining = Array.isArray(linings) && linings.some((l) => {
          if (!l || typeof l !== "object") return false;
          const name = (l.itemName || "").trim();
          const cons = Number(l.consumptionPerPc ?? l.consumptionMtr ?? l.consPerPc ?? 0);
          const rate = Number(l.ratePKR ?? l.rateUSD ?? 0);
          const cost = Number(l.liningCostPKR ?? l.costPKR ?? 0);
          const hasName = name !== "" && !name.startsWith("--");
          return (hasName && (cons > 0 || rate > 0 || cost > 0)) || cost > 0 || (cons > 0 && rate > 0);
        });

        if (!hasValidFabric && !hasValidLining) {
          return NextResponse.json(
            {
              error: "Cannot approve Fabric stage: Please enter valid Fabric or Pocket Lining items with consumption and rates before approving.",
            },
            { status: 400 }
          );
        }
      }

      // Stage: Trims & Accessories (MMC)
      if (stage === "mmc") {
        let trims: any[] = [];
        try { trims = JSON.parse(row.bom_accessories || "[]"); } catch {}

        const hasValidTrims = Array.isArray(trims) && trims.some((t) => {
          if (!t || typeof t !== "object") return false;
          const name = (t.itemName || t.category || "").trim();
          const cons = Number(t.consPerPc ?? t.consumptionPerPc ?? t.consumption ?? 0);
          const rate = Number(t.ratePKR ?? t.rateUSD ?? 0);
          const cost = Number(t.totalCostPKR ?? t.costPKR ?? t.itemCostPKR ?? 0);
          const hasName = name !== "" && !name.startsWith("--");
          return (hasName && (cons > 0 || rate > 0 || cost > 0)) || cost > 0 || (cons > 0 && rate > 0);
        });

        if (!hasValidTrims) {
          return NextResponse.json(
            {
              error: "Cannot approve Trims / MMC stage: Please enter valid Trims & Accessories items with consumption and rates before approving.",
            },
            { status: 400 }
          );
        }
      }

      // Stage: IE & SAMs
      if (stage === "ie") {
        const smv = Number(row.smv_sewing) || 0;
        if (smv <= 0) {
          return NextResponse.json(
            {
              error: "Cannot approve IE stage: Sewing SMV must be entered and greater than 0.",
            },
            { status: 400 }
          );
        }
      }

      // Stage: Washing Rates
      if (stage === "washing") {
        let chemicals: any[] = [];
        try { chemicals = JSON.parse(row.bom_chemicals || "[]"); } catch {}
        const washType = (row.wash_type || "").trim();

        const hasValidChemicals = Array.isArray(chemicals) && chemicals.some((c) => {
          if (!c || typeof c !== "object") return false;
          const name = (c.washItem || c.itemName || "").trim();
          const cons = Number(c.consPerPc ?? c.consumptionPerPc ?? c.consumption ?? 0);
          const rate = Number(c.ratePKR ?? c.rateUSD ?? 0);
          const cost = Number(c.totalCostPKR ?? c.costPKR ?? c.itemCostPKR ?? 0);
          const hasName = name !== "" && !name.startsWith("--");
          return (hasName && (cons > 0 || rate > 0 || cost > 0)) || cost > 0 || (cons > 0 && rate > 0);
        });

        const hasWashType = washType !== "" && washType.toLowerCase() !== "none" && washType.toLowerCase() !== "no wash" && !washType.startsWith("--");

        if (!hasValidChemicals && !hasWashType) {
          return NextResponse.json(
            {
              error: "Cannot approve Washing stage: Please select a Wash Type or enter Chemical recipe details before approving.",
            },
            { status: 400 }
          );
        }
      }

      // Stage: Marketing
      if (stage === "marketing") {
        const orderFob = Number(row.order_fob) || Number(row.quoted_price) || 0;
        if (orderFob <= 0) {
          return NextResponse.json(
            {
              error: "Cannot approve Marketing stage: Order FOB / Selling Price must be greater than $0.00.",
            },
            { status: 400 }
          );
        }
      }
    }

    // Sequential Prerequisites validation for approval
    if (action === "approve") {
      // Step 1 is CAD: departmental heads require CAD approval first
      if (stage === "fabric" || stage === "mmc" || stage === "ie" || stage === "washing") {
        if (approvals.cad?.status !== "approved") {
          return NextResponse.json(
            {
              error: "CAD approval is required before departmental head approvals.",
            },
            { status: 400 }
          );
        }
      }

      if (stage === "marketing") {
        const cadOk = approvals.cad?.status === "approved";
        const fabricOk = approvals.fabric?.status === "approved";
        const mmcOk = approvals.mmc?.status === "approved";
        const ieOk = approvals.ie?.status === "approved";
        const washingOk = approvals.washing?.status === "approved";

        if (!cadOk || !fabricOk || !mmcOk || !ieOk || !washingOk) {
          const missing: string[] = [];
          if (!cadOk) missing.push("CAD");
          if (!fabricOk) missing.push("Fabric Head");
          if (!mmcOk) missing.push("MMC Head");
          if (!ieOk) missing.push("IE Head");
          if (!washingOk) missing.push("Washing Head");

          return NextResponse.json(
            {
              error: `Marketing approval requires prior approval from CAD and all departmental heads: ${missing.join(", ")} pending.`,
            },
            { status: 400 }
          );
        }
      }

      if (stage === "costingHead") {
        if (approvals.marketing?.status !== "approved") {
          return NextResponse.json(
            { error: "Marketing approval is required before Costing Head can approve." },
            { status: 400 }
          );
        }
      }

      if (stage === "director") {
        if (approvals.costingHead?.status !== "approved") {
          return NextResponse.json(
            { error: "Costing Head approval is required before Director can give final approval." },
            { status: 400 }
          );
        }
      }
    }

    if (action === "reject") {
      if (stage === "fabric" || stage === "mmc" || stage === "ie" || stage === "washing") {
        if (approvals.cad?.status !== "approved") {
          return NextResponse.json(
            { error: "CAD approval must be completed before departmental heads can review." },
            { status: 400 }
          );
        }
      }
      if (stage === "marketing") {
        const cadOk = approvals.cad?.status === "approved";
        const fabricOk = approvals.fabric?.status === "approved";
        const mmcOk = approvals.mmc?.status === "approved";
        const ieOk = approvals.ie?.status === "approved";
        const washingOk = approvals.washing?.status === "approved";
        if (!cadOk || !fabricOk || !mmcOk || !ieOk || !washingOk) {
          return NextResponse.json(
            { error: "Marketing review requires CAD and all 4 departmental heads to complete sign-off first." },
            { status: 400 }
          );
        }
      }
      if (stage === "costingHead" && approvals.marketing?.status !== "approved") {
        return NextResponse.json(
          { error: "Costing Head review requires prior Marketing approval." },
          { status: 400 }
        );
      }
      if (stage === "director" && approvals.costingHead?.status !== "approved") {
        return NextResponse.json(
          { error: "Director review requires prior Costing Head approval." },
          { status: 400 }
        );
      }
    }

    // Apply the action to the stage
    const now = new Date().toISOString();

    if (action === "approve") {
      approvals[stage] = {
        status: "approved",
        approvedBy: session.displayName || session.email,
        approvedByEmail: session.email,
        approvedById: session.userId,
        approvedAt: now,
        comments: comments?.trim() || undefined,
      };
    } else if (action === "reject") {
      approvals[stage] = {
        status: "rejected",
        approvedBy: session.displayName || session.email,
        approvedByEmail: session.email,
        approvedById: session.userId,
        approvedAt: now,
        comments: comments?.trim(),
      };
    } else if (action === "revoke") {
      const fabricApproved = approvals.fabric?.status === "approved";
      const mmcApproved = approvals.mmc?.status === "approved";
      const ieApproved = approvals.ie?.status === "approved";
      const washingApproved = approvals.washing?.status === "approved";
      const deptCompleted = fabricApproved && mmcApproved && ieApproved && washingApproved;

      const marketingApproved = approvals.marketing?.status === "approved";
      const costingHeadApproved = approvals.costingHead?.status === "approved";
      const directorApproved = approvals.director?.status === "approved";

      const directorRejected = approvals.director?.status === "rejected";
      const costingHeadRejected = approvals.costingHead?.status === "rejected";
      const marketingRejected = approvals.marketing?.status === "rejected";

      const directorPending = costingHeadApproved && !directorApproved && !directorRejected;
      const costingHeadPending = marketingApproved && !costingHeadApproved && !costingHeadRejected;
      const marketingPending = deptCompleted && !marketingApproved && !marketingRejected;

      // Enforce strict reverse hierarchical workflow - no direct jump allowed for revoke
      if (stage === "cad") {
        if (directorApproved || directorPending) {
          return NextResponse.json(
            { error: "Cannot revoke CAD: Approval is at Director stage. Cannot skip approval hierarchy." },
            { status: 400 }
          );
        }
        if (costingHeadApproved || costingHeadPending) {
          return NextResponse.json(
            { error: "Cannot revoke CAD: Approval is at Costing Head stage. Cannot skip approval hierarchy." },
            { status: 400 }
          );
        }
        if (marketingApproved || marketingPending) {
          return NextResponse.json(
            { error: "Cannot revoke CAD: Approval is at Marketing stage. Cannot skip approval hierarchy." },
            { status: 400 }
          );
        }
        if (fabricApproved || mmcApproved || ieApproved || washingApproved) {
          return NextResponse.json(
            { error: "Cannot revoke CAD: Departmental heads have already approved. Departmental approvals must be revoked before revoking CAD." },
            { status: 400 }
          );
        }
      } else if (stage === "costingHead") {
        if (directorApproved) {
          return NextResponse.json(
            { error: "Cannot revoke Costing Head: Director has finalized this cost sheet. Director approval must be revoked first." },
            { status: 400 }
          );
        }
        if (directorPending) {
          return NextResponse.json(
            { error: "Cannot revoke Costing Head: Approval is currently with Director. Director must reject before Costing Head can revoke." },
            { status: 400 }
          );
        }
      } else if (stage === "marketing") {
        if (directorApproved || directorPending) {
          return NextResponse.json(
            { error: "Cannot revoke Marketing: Cost sheet is at Director stage. Cannot skip approval hierarchy." },
            { status: 400 }
          );
        }
        if (costingHeadApproved) {
          return NextResponse.json(
            { error: "Cannot revoke Marketing: Costing Head has already approved. Costing Head must revoke first." },
            { status: 400 }
          );
        }
        if (costingHeadPending) {
          return NextResponse.json(
            { error: "Cannot revoke Marketing: Approval is currently with Costing Head. Costing Head must reject before Marketing can revoke." },
            { status: 400 }
          );
        }
      } else if (stage === "fabric" || stage === "mmc" || stage === "ie" || stage === "washing") {
        if (directorApproved || directorPending) {
          return NextResponse.json(
            { error: `Cannot revoke ${stage.toUpperCase()}: Approval is at Director stage. Cannot skip approval hierarchy.` },
            { status: 400 }
          );
        }
        if (costingHeadApproved || costingHeadPending) {
          return NextResponse.json(
            { error: `Cannot revoke ${stage.toUpperCase()}: Approval is at Costing Head stage. Cannot skip approval hierarchy.` },
            { status: 400 }
          );
        }
        if (marketingApproved) {
          return NextResponse.json(
            { error: `Cannot revoke ${stage.toUpperCase()}: Marketing has already approved. Marketing approval must be revoked first.` },
            { status: 400 }
          );
        }
        if (marketingPending) {
          return NextResponse.json(
            { error: `Cannot revoke ${stage.toUpperCase()}: Approval is currently with Marketing. Marketing must reject before departmental stages can revoke.` },
            { status: 400 }
          );
        }
      }

      // Reset that stage
      approvals[stage] = {
        status: "pending",
      };

      // When revoking a stage, resolve any higher-level rejection that triggered this revocation
      if (stage === "costingHead") {
        if (approvals.director?.status === "rejected") {
          approvals.director = { status: "pending" };
        }
      } else if (stage === "marketing") {
        if (approvals.costingHead?.status === "rejected") {
          approvals.costingHead = { status: "pending" };
        }
      } else if (stage === "fabric" || stage === "mmc" || stage === "ie" || stage === "washing") {
        if (approvals.marketing?.status === "rejected") {
          approvals.marketing = { status: "pending" };
        }
      }
    }

    // Calculate new overallStatus
    let overallStatus: CostSheetApprovals["overallStatus"] = "draft";

    const hasRejection = Object.values(approvals).some(
      (step: unknown) => (step as ApprovalStep)?.status === "rejected"
    );

    if (hasRejection) {
      overallStatus = "rejected";
    } else if (approvals.director?.status === "approved") {
      overallStatus = "fully_approved";
    } else if (approvals.costingHead?.status === "approved") {
      overallStatus = "costing_approved";
    } else if (approvals.marketing?.status === "approved") {
      overallStatus = "marketing_approved";
    } else if (
      approvals.cad?.status === "approved" ||
      approvals.fabric?.status === "approved" ||
      approvals.mmc?.status === "approved" ||
      approvals.ie?.status === "approved" ||
      approvals.washing?.status === "approved"
    ) {
      overallStatus = "in_review";
    } else {
      overallStatus = "draft";
    }

    approvals.overallStatus = overallStatus;

    // Persist to database
    await pool
      .request()
      .input("id", id)
      .input("approvals", JSON.stringify(approvals))
      .input("approval_status", overallStatus)
      .query(`
        UPDATE pre_order_cost_sheets
        SET approvals = @approvals,
            approval_status = @approval_status
        WHERE id = @id
      `);

    return NextResponse.json({
      ok: true,
      stage,
      action,
      approvals,
      approvalStatus: overallStatus,
    });
  } catch (err) {
    console.error("[POST /api/cost-sheets/[id]/approve] error:", err);
    return NextResponse.json(
      { error: "Failed to process approval", details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
