import { getPool } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * GET /api/reports/employees
 * Employee & Team Productivity Report (Costing Database Only)
 * Powered exclusively by users, teams, team_members, roles, and pre_order_cost_sheets:
 * 1. Merchandisers & Costing Creators:
 *    - Creator Name, Email, Assigned Customer
 *    - Total Pre-Order Cost Sheets Authored
 *    - Approval Pipeline (Approved, In Review, Draft)
 *    - Cumulative Units Costed and Total Commercial Value ($)
 *    - Average FOB ($)
 * 2. Cross-Functional Teams:
 *    - Team Name, Assigned Customers Portfolio, Active Member Count
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const roleFilter = searchParams.get("role")?.trim() || "";

    const appPool = await getPool();

    // 1. Fetch Users from Costing DB
    const usersRes = await appPool.request().query<{
      id: number;
      email: string;
      displayName: string;
      role: string;
      assignedCustomer: string | null;
      isActive: boolean;
      inserted_at: string;
    }>(
      `SELECT id, email, displayName, role, assignedCustomer, isActive, inserted_at
       FROM users
       WHERE isdeleted = 0
       ORDER BY displayName ASC`
    );

    // 2. Fetch Cost Sheets Metrics grouped by Creator
    const csRes = await appPool.request().query<{
      id: string;
      reference_name: string;
      created_by_name: string | null;
      created_by_email: string | null;
      created_by_id: number | null;
      inserted_by: string | null;
      order_quantity: number;
      order_fob: number;
      approval_status: string;
      customer_name: string;
    }>(
      `SELECT id, reference_name, created_by_name, created_by_email, created_by_id,
              inserted_by, order_quantity, order_fob, approval_status, customer_name
       FROM pre_order_cost_sheets
       WHERE deleted_at IS NULL`
    );

    // 3. Fetch Teams and Members from Costing DB
    const teamsRes = await appPool.request().query<{
      id: number;
      name: string;
      customers: string;
      isActive: boolean;
    }>(
      `SELECT id, name, customers, isActive FROM teams WHERE isActive = 1`
    );

    const teamMembersRes = await appPool.request().query<{
      teamId: number;
      userId: number;
      roleSlug: string;
    }>(
      `SELECT teamId, userId, roleSlug FROM team_members`
    );

    // Map team associations
    const userTeamsMap = new Map<number, string[]>();
    for (const tm of teamMembersRes.recordset) {
      const team = teamsRes.recordset.find((t) => t.id === tm.teamId);
      if (team) {
        if (!userTeamsMap.has(tm.userId)) {
          userTeamsMap.set(tm.userId, []);
        }
        userTeamsMap.get(tm.userId)!.push(team.name);
      }
    }

    // Aggregate user metrics
    const userStatsMap = new Map<string, any>();

    for (const cs of csRes.recordset) {
      // Identity can be created_by_name, created_by_email, or inserted_by
      const nameKey = (cs.created_by_name || cs.inserted_by || "").toLowerCase().trim();
      const emailKey = (cs.created_by_email || "").toLowerCase().trim();
      const idKey = cs.created_by_id ? String(cs.created_by_id) : "";

      const qty = cs.order_quantity || 0;
      const fob = cs.order_fob || 0;
      const value = qty * fob;
      const status = cs.approval_status || "draft";

      const targets = [nameKey, emailKey, idKey].filter(Boolean);

      for (const t of targets) {
        if (!userStatsMap.has(t)) {
          userStatsMap.set(t, {
            sheets: 0,
            approved: 0,
            inReview: 0,
            draft: 0,
            units: 0,
            totalValue: 0,
            fobSum: 0,
          });
        }
        const s = userStatsMap.get(t)!;
        s.sheets += 1;
        if (status === "approved" || status === "fully_approved") s.approved += 1;
        else if (status === "in_review") s.inReview += 1;
        else s.draft += 1;

        s.units += qty;
        s.totalValue += value;
        s.fobSum += fob;
      }
    }

    let employees = usersRes.recordset.map((u) => {
      const stats =
        userStatsMap.get(u.displayName.toLowerCase().trim()) ||
        userStatsMap.get(u.email.toLowerCase().trim()) ||
        userStatsMap.get(String(u.id)) ||
        { sheets: 0, approved: 0, inReview: 0, draft: 0, units: 0, totalValue: 0, fobSum: 0 };

      const teams = userTeamsMap.get(u.id) || [];
      const count = stats.sheets || 1;

      return {
        id: u.id,
        name: u.displayName,
        email: u.email,
        role: u.role,
        assignedCustomer: u.assignedCustomer || "None",
        teams,
        isActive: u.isActive,
        totalSheetsCreated: stats.sheets,
        approvedSheets: stats.approved,
        inReviewSheets: stats.inReview,
        draftSheets: stats.draft,
        totalUnitsCosted: stats.units,
        totalValueUSD: Number(stats.totalValue.toFixed(2)),
        avgFob: stats.sheets > 0 ? Number((stats.fobSum / count).toFixed(2)) : 0,
      };
    });

    if (roleFilter) {
      employees = employees.filter((e) => e.role.toLowerCase() === roleFilter.toLowerCase());
    }

    if (search) {
      employees = employees.filter(
        (e) =>
          e.name.toLowerCase().includes(search) ||
          e.email.toLowerCase().includes(search) ||
          e.role.toLowerCase().includes(search) ||
          e.assignedCustomer.toLowerCase().includes(search)
      );
    }

    // Teams Overview
    const teamsOverview = teamsRes.recordset.map((t) => {
      let custs: string[] = [];
      try { custs = JSON.parse(t.customers); } catch (_) {}
      const members = teamMembersRes.recordset.filter((m) => m.teamId === t.id);
      return {
        id: t.id,
        name: t.name,
        customers: custs,
        membersCount: members.length,
      };
    });

    return NextResponse.json({
      summary: {
        totalEmployees: employees.length,
        totalSheetsCosted: employees.reduce((acc, e) => acc + e.totalSheetsCreated, 0),
        totalUnitsCosted: employees.reduce((acc, e) => acc + e.totalUnitsCosted, 0),
        totalCommercialValueUSD: Number(
          employees.reduce((acc, e) => acc + e.totalValueUSD, 0).toFixed(2)
        ),
      },
      employees,
      teams: teamsOverview,
    });
  } catch (err: any) {
    console.error("[/api/reports/employees] Error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to fetch employee costing reports" },
      { status: 500 }
    );
  }
}
