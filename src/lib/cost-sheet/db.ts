/**
 * Shared DB helpers for cost-sheet API routes.
 *
 * - ensureCostSheetTable  — idempotent DDL (CREATE + ALTER column backfill)
 * - resolveTeamCustomers  — fetches the customer portfolio for a non-admin user
 */
import { getPool } from "@/lib/db";

type Pool = Awaited<ReturnType<typeof getPool>>;

// Module-level flag: best-effort, fine for a single instance.
// In serverless multi-instance deployments the DDL is idempotent (IF NOT EXISTS),
// so duplicate runs are safe.
let isTableEnsured = false;

/**
 * Ensures the `pre_order_cost_sheets` table exists and all columns are up-to-date.
 * Safe to call on every request — early-exits once confirmed per process lifetime.
 */
export async function ensureCostSheetTable(pool: Pool): Promise<void> {
  if (isTableEnsured) return;

  await pool.request().query(`
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_NAME = 'pre_order_cost_sheets'
    )
    BEGIN
        CREATE TABLE pre_order_cost_sheets (
            id                     NVARCHAR(64)   NOT NULL PRIMARY KEY,
            reference_name         NVARCHAR(256)  NOT NULL,
            style_id               NVARCHAR(64)   NOT NULL,
            style_name             NVARCHAR(256)  NOT NULL,
            customer_name          NVARCHAR(256)  NOT NULL,
            style_category         NVARCHAR(128)  NOT NULL,
            order_quantity         INT            NOT NULL DEFAULT 0,
            smv_sewing             FLOAT          NOT NULL DEFAULT 0,
            order_type             NVARCHAR(128)  NOT NULL DEFAULT '',
            wash_type              NVARCHAR(128)  NOT NULL DEFAULT '',
            costing_date           NVARCHAR(32)   NOT NULL DEFAULT '',
            costing_stage          NVARCHAR(64)   NOT NULL DEFAULT '',
            country                NVARCHAR(128)  NOT NULL DEFAULT '',
            payment_terms          NVARCHAR(128)  NOT NULL DEFAULT '',
            shipment_mode          NVARCHAR(128)  NOT NULL DEFAULT '',
            delivery_terms         NVARCHAR(128)  NOT NULL DEFAULT '',
            parity_sale            FLOAT          NOT NULL DEFAULT 0,
            parity_procurement     FLOAT          NOT NULL DEFAULT 0,
            manpower               INT            NOT NULL DEFAULT 0,
            efficiency_override    FLOAT          NULL,
            rejection_override     FLOAT          NULL,
            line_target_override   FLOAT          NULL,
            discount_rate          FLOAT          NOT NULL DEFAULT 0,
            payment_terms_days     INT            NOT NULL DEFAULT 0,
            ar_term_id             NVARCHAR(64)   NULL,
            ap_term_id             NVARCHAR(64)   NULL,
            factoring_days         INT            NOT NULL DEFAULT 0,
            commission_pct         FLOAT          NOT NULL DEFAULT 0,
            foreign_bank_charges   FLOAT          NOT NULL DEFAULT 0,
            order_fob              FLOAT          NOT NULL DEFAULT 0,
            quoted_price           FLOAT          NULL,
            intl_freight           FLOAT          NULL,
            intl_insurance         FLOAT          NULL,
            no_of_colors           INT            NULL,
            merch_group            NVARCHAR(128)  NULL,
            work_order_number      NVARCHAR(64)   NULL,
            delivery_destination   NVARCHAR(256)  NULL,
            ex_factory_date        NVARCHAR(32)   NULL,
            inhouse_or_subcontract NVARCHAR(64)   NULL,
            rebate_pct             FLOAT          NULL,
            bom_fabric             NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
            bom_lining             NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
            bom_accessories        NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
            bom_chemicals          NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
            bom_special_charges    NVARCHAR(MAX)  NOT NULL DEFAULT '[]',
            calculations           NVARCHAR(MAX)  NOT NULL DEFAULT '{}',
            saved_at               NVARCHAR(64)   NOT NULL
        );
        CREATE INDEX IX_pcs_style_id ON pre_order_cost_sheets (style_id);
        CREATE INDEX IX_pcs_saved_at ON pre_order_cost_sheets (saved_at DESC);
    END
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'tax_eds_pct')
      ALTER TABLE pre_order_cost_sheets ADD tax_eds_pct FLOAT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'inland_freight_pct')
      ALTER TABLE pre_order_cost_sheets ADD inland_freight_pct FLOAT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'local_bank_charges_pct')
      ALTER TABLE pre_order_cost_sheets ADD local_bank_charges_pct FLOAT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'rejection_pct')
      ALTER TABLE pre_order_cost_sheets ADD rejection_pct FLOAT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'direct_labour_foh_snapshot')
      ALTER TABLE pre_order_cost_sheets ADD direct_labour_foh_snapshot NVARCHAR(MAX) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'cutting_sam')
      ALTER TABLE pre_order_cost_sheets ADD cutting_sam FLOAT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'washing_sam')
      ALTER TABLE pre_order_cost_sheets ADD washing_sam FLOAT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'finishing_sam')
      ALTER TABLE pre_order_cost_sheets ADD finishing_sam FLOAT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'approvals')
      ALTER TABLE pre_order_cost_sheets ADD approvals NVARCHAR(MAX) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'approval_status')
      ALTER TABLE pre_order_cost_sheets ADD approval_status NVARCHAR(64) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'created_by_id')
      ALTER TABLE pre_order_cost_sheets ADD created_by_id INT NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'created_by_email')
      ALTER TABLE pre_order_cost_sheets ADD created_by_email NVARCHAR(256) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'created_by_name')
      ALTER TABLE pre_order_cost_sheets ADD created_by_name NVARCHAR(256) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'ar_term_id')
      ALTER TABLE pre_order_cost_sheets ADD ar_term_id NVARCHAR(64) NULL;
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('pre_order_cost_sheets') AND name = 'ap_term_id')
      ALTER TABLE pre_order_cost_sheets ADD ap_term_id NVARCHAR(64) NULL;
  `);

  isTableEnsured = true;
}

/**
 * Resolves the active team customer portfolio for a non-admin user.
 *
 * Returns an empty array for admins (they bypass all customer filters).
 * Logs a warning if the DB query fails so silent 403s don't occur.
 */
export async function resolveTeamCustomers(
  pool: Pool,
  session: { role: string; userId: number }
): Promise<string[]> {
  if (session.role === "admin") return [];

  try {
    const teamRes = await pool
      .request()
      .input("userId", session.userId)
      .query<{ customers: string }>(`
        SELECT t.customers
        FROM teams t
        INNER JOIN team_members m ON m.teamId = t.id
        WHERE m.userId = @userId AND t.isActive = 1
      `);

    const teamCustomers: string[] = [];
    for (const tr of teamRes.recordset) {
      if (!tr.customers) continue;
      try {
        if (tr.customers.startsWith("[")) {
          const parsed = JSON.parse(tr.customers);
          if (Array.isArray(parsed)) teamCustomers.push(...parsed);
        } else {
          teamCustomers.push(
            ...tr.customers
              .split(",")
              .map((c: string) => c.trim())
              .filter(Boolean)
          );
        }
      } catch {
        // Malformed JSON in customers column — skip this row
        console.warn("[resolveTeamCustomers] Could not parse customers JSON for userId", session.userId);
      }
    }
    return teamCustomers;
  } catch (err) {
    // Log so the team lookup failure is visible in server logs.
    // Return empty array rather than throwing — callers will treat the user
    // as having no team customers (stricter access, not an outright crash).
    console.error("[resolveTeamCustomers] DB error for userId", session.userId, err);
    return [];
  }
}
