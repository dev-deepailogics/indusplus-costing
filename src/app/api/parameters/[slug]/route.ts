import { NextRequest } from "next/server";
import { getPool, sql } from "@/lib/db";
import type {
  DropdownListsData,
  MatrixTableData,
  ProcessMatrixTableData,
  SimpleTableData,
  SimpleTableCard,
} from "@/lib/parameters/types";

// ---------------------------------------------------------------------------
// DDL — runs once per server lifetime
// ---------------------------------------------------------------------------
let tablesReady = false;

async function ensureTables(pool: Awaited<ReturnType<typeof getPool>>) {
  if (tablesReady) return;

  const ddlStatements = [
    // ── cut_to_ship_grid ────────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='cut_to_ship_grid')
     CREATE TABLE cut_to_ship_grid (
       qty_band       NVARCHAR(64) NOT NULL,
       style_category NVARCHAR(64) NOT NULL,
       value          NVARCHAR(32) NOT NULL DEFAULT '',
       row_order      INT          NOT NULL DEFAULT 0,
       col_order      INT          NOT NULL DEFAULT 0,
       PRIMARY KEY (qty_band, style_category)
     )`,

    // ── rejection_grid ──────────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='rejection_grid')
     CREATE TABLE rejection_grid (
       process        NVARCHAR(64) NOT NULL,
       qty_band       NVARCHAR(64) NOT NULL,
       style_category NVARCHAR(64) NOT NULL,
       value          NVARCHAR(32) NOT NULL DEFAULT '',
       process_order  INT          NOT NULL DEFAULT 0,
       row_order      INT          NOT NULL DEFAULT 0,
       col_order      INT          NOT NULL DEFAULT 0,
       PRIMARY KEY (process, qty_band, style_category)
     )`,

    // ── customer_rejections ──────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='customer_rejections')
     CREATE TABLE customer_rejections (
       customer_name NVARCHAR(128) NOT NULL PRIMARY KEY,
       rejection_pct NVARCHAR(32)  NOT NULL DEFAULT '',
       row_order     INT           NOT NULL DEFAULT 0
     )`,

    // ── rejection_settings ───────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='rejection_settings')
     CREATE TABLE rejection_settings (
       id                 INT          NOT NULL PRIMARY KEY DEFAULT 1,
       use_grid_rejection BIT          NOT NULL DEFAULT 1,
       default_rejection  NVARCHAR(32) NOT NULL DEFAULT '4.00%'
     )`,

    // ── styles (dedicated 2-table schema for dynamic fields with multi-card support) ────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='styles_columns')
     CREATE TABLE styles_columns (
       card_id    NVARCHAR(128) NOT NULL DEFAULT 'card-1',
       col_key    NVARCHAR(128) NOT NULL,
       col_label  NVARCHAR(256) NOT NULL,
       sort_order INT           NOT NULL DEFAULT 0
     )
     ELSE
     BEGIN
       DECLARE @ConstraintName_styles_columns nvarchar(200);
       SELECT @ConstraintName_styles_columns = Name FROM sys.key_constraints WHERE type = 'PK' AND parent_object_id = OBJECT_ID('styles_columns');
       IF @ConstraintName_styles_columns IS NOT NULL
         EXEC('ALTER TABLE styles_columns DROP CONSTRAINT ' + @ConstraintName_styles_columns);
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('styles_columns') AND name = 'card_id')
         ALTER TABLE styles_columns ADD card_id NVARCHAR(128) NOT NULL DEFAULT 'card-1';
     END`,

    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='styles_values')
     CREATE TABLE styles_values (
       card_id     NVARCHAR(128) NOT NULL DEFAULT 'card-1',
       card_name   NVARCHAR(256) NOT NULL DEFAULT 'Card 1',
       is_active   BIT           NOT NULL DEFAULT 1,
       card_serial INT           NOT NULL DEFAULT 1,
       row_id      NVARCHAR(128) NOT NULL,
       col_key     NVARCHAR(128) NOT NULL,
       col_value   NVARCHAR(MAX) NOT NULL DEFAULT '',
       row_order   INT           NOT NULL DEFAULT 0
     )
     ELSE
     BEGIN
       DECLARE @ConstraintName_styles_values nvarchar(200);
       SELECT @ConstraintName_styles_values = Name FROM sys.key_constraints WHERE type = 'PK' AND parent_object_id = OBJECT_ID('styles_values');
       IF @ConstraintName_styles_values IS NOT NULL
         EXEC('ALTER TABLE styles_values DROP CONSTRAINT ' + @ConstraintName_styles_values);
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('styles_values') AND name = 'card_id')
         ALTER TABLE styles_values ADD card_id NVARCHAR(128) NOT NULL DEFAULT 'card-1';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('styles_values') AND name = 'card_name')
         ALTER TABLE styles_values ADD card_name NVARCHAR(256) NOT NULL DEFAULT 'Card 1';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('styles_values') AND name = 'is_active')
         ALTER TABLE styles_values ADD is_active BIT NOT NULL DEFAULT 1;
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('styles_values') AND name = 'card_serial')
         ALTER TABLE styles_values ADD card_serial INT NOT NULL DEFAULT 1;
     END`,

    // ── other_expenses ──────────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='other_expenses')
     CREATE TABLE other_expenses (
       id               NVARCHAR(128) NOT NULL,
       card_id          NVARCHAR(128) NOT NULL DEFAULT 'card-1',
       card_name        NVARCHAR(256) NOT NULL DEFAULT 'Card 1',
       is_active        BIT           NOT NULL DEFAULT 1,
       card_serial      INT           NOT NULL DEFAULT 1,
       description      NVARCHAR(256) NOT NULL DEFAULT '',
       percent_of_sales NVARCHAR(64)  NOT NULL DEFAULT '',
       row_order        INT           NOT NULL DEFAULT 0
     )
     ELSE
     BEGIN
       DECLARE @ConstraintName_other_expenses nvarchar(200);
       SELECT @ConstraintName_other_expenses = Name FROM sys.key_constraints WHERE type = 'PK' AND parent_object_id = OBJECT_ID('other_expenses');
       IF @ConstraintName_other_expenses IS NOT NULL
         EXEC('ALTER TABLE other_expenses DROP CONSTRAINT ' + @ConstraintName_other_expenses);
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('other_expenses') AND name = 'card_id')
         ALTER TABLE other_expenses ADD card_id NVARCHAR(128) NOT NULL DEFAULT 'card-1';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('other_expenses') AND name = 'card_name')
         ALTER TABLE other_expenses ADD card_name NVARCHAR(256) NOT NULL DEFAULT 'Card 1';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('other_expenses') AND name = 'is_active')
         ALTER TABLE other_expenses ADD is_active BIT NOT NULL DEFAULT 1;
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('other_expenses') AND name = 'card_serial')
         ALTER TABLE other_expenses ADD card_serial INT NOT NULL DEFAULT 1;
     END`,

    // ── order_types ─────────────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='order_types')
     CREATE TABLE order_types (
       id         NVARCHAR(128) NOT NULL,
       card_id    NVARCHAR(128) NOT NULL DEFAULT 'card-1',
       card_name  NVARCHAR(256) NOT NULL DEFAULT 'Card 1',
       is_active  BIT           NOT NULL DEFAULT 1,
       card_serial INT          NOT NULL DEFAULT 1,
       order_type NVARCHAR(128) NOT NULL DEFAULT '',
       row_order  INT           NOT NULL DEFAULT 0
     )
     ELSE
     BEGIN
       DECLARE @ConstraintName_order_types nvarchar(200);
       SELECT @ConstraintName_order_types = Name FROM sys.key_constraints WHERE type = 'PK' AND parent_object_id = OBJECT_ID('order_types');
       IF @ConstraintName_order_types IS NOT NULL
         EXEC('ALTER TABLE order_types DROP CONSTRAINT ' + @ConstraintName_order_types);
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('order_types') AND name = 'card_id')
         ALTER TABLE order_types ADD card_id NVARCHAR(128) NOT NULL DEFAULT 'card-1';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('order_types') AND name = 'card_name')
         ALTER TABLE order_types ADD card_name NVARCHAR(256) NOT NULL DEFAULT 'Card 1';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('order_types') AND name = 'is_active')
         ALTER TABLE order_types ADD is_active BIT NOT NULL DEFAULT 1;
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('order_types') AND name = 'card_serial')
         ALTER TABLE order_types ADD card_serial INT NOT NULL DEFAULT 1;
     END`,

    // ── customer_commissions ────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='customer_commissions')
     CREATE TABLE customer_commissions (
       id                 NVARCHAR(128) NOT NULL,
       card_id            NVARCHAR(128) NOT NULL DEFAULT 'card-1',
       card_name          NVARCHAR(256) NOT NULL DEFAULT 'Card 1',
       is_active          BIT           NOT NULL DEFAULT 1,
       card_serial        INT           NOT NULL DEFAULT 1,
       customer           NVARCHAR(256) NOT NULL DEFAULT '',
       commission_percent NVARCHAR(64)  NOT NULL DEFAULT '',
       row_order          INT           NOT NULL DEFAULT 0
     )
     ELSE
     BEGIN
       DECLARE @ConstraintName_customer_commissions nvarchar(200);
       SELECT @ConstraintName_customer_commissions = Name FROM sys.key_constraints WHERE type = 'PK' AND parent_object_id = OBJECT_ID('customer_commissions');
       IF @ConstraintName_customer_commissions IS NOT NULL
         EXEC('ALTER TABLE customer_commissions DROP CONSTRAINT ' + @ConstraintName_customer_commissions);
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('customer_commissions') AND name = 'card_id')
         ALTER TABLE customer_commissions ADD card_id NVARCHAR(128) NOT NULL DEFAULT 'card-1';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('customer_commissions') AND name = 'card_name')
         ALTER TABLE customer_commissions ADD card_name NVARCHAR(256) NOT NULL DEFAULT 'Card 1';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('customer_commissions') AND name = 'is_active')
         ALTER TABLE customer_commissions ADD is_active BIT NOT NULL DEFAULT 1;
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('customer_commissions') AND name = 'card_serial')
         ALTER TABLE customer_commissions ADD card_serial INT NOT NULL DEFAULT 1;
     END`,

    // ── cost_as_percent_of_sales ────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='cost_as_percent_of_sales')
     CREATE TABLE cost_as_percent_of_sales (
       id               NVARCHAR(128) NOT NULL,
       card_id          NVARCHAR(128) NOT NULL DEFAULT 'card-1',
       card_name        NVARCHAR(256) NOT NULL DEFAULT 'Card 1',
       is_active        BIT           NOT NULL DEFAULT 1,
       card_serial      INT           NOT NULL DEFAULT 1,
       description      NVARCHAR(256) NOT NULL DEFAULT '',
       percent_of_sales NVARCHAR(64)  NOT NULL DEFAULT '',
       row_order        INT           NOT NULL DEFAULT 0
     )
     ELSE
     BEGIN
       DECLARE @ConstraintName_cost_as_percent_of_sales nvarchar(200);
       SELECT @ConstraintName_cost_as_percent_of_sales = Name FROM sys.key_constraints WHERE type = 'PK' AND parent_object_id = OBJECT_ID('cost_as_percent_of_sales');
       IF @ConstraintName_cost_as_percent_of_sales IS NOT NULL
         EXEC('ALTER TABLE cost_as_percent_of_sales DROP CONSTRAINT ' + @ConstraintName_cost_as_percent_of_sales);
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cost_as_percent_of_sales') AND name = 'card_id')
         ALTER TABLE cost_as_percent_of_sales ADD card_id NVARCHAR(128) NOT NULL DEFAULT 'card-1';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cost_as_percent_of_sales') AND name = 'card_name')
         ALTER TABLE cost_as_percent_of_sales ADD card_name NVARCHAR(256) NOT NULL DEFAULT 'Card 1';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cost_as_percent_of_sales') AND name = 'is_active')
         ALTER TABLE cost_as_percent_of_sales ADD is_active BIT NOT NULL DEFAULT 1;
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('cost_as_percent_of_sales') AND name = 'card_serial')
         ALTER TABLE cost_as_percent_of_sales ADD card_serial INT NOT NULL DEFAULT 1;
     END`,

    // ── direct_labour_foh ───────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='direct_labour_foh')
     CREATE TABLE direct_labour_foh (
       id           NVARCHAR(128) NOT NULL,
       card_id      NVARCHAR(128) NOT NULL DEFAULT 'card-1',
       card_name    NVARCHAR(256) NOT NULL DEFAULT 'Card 1',
       is_active    BIT           NOT NULL DEFAULT 1,
       card_serial  INT           NOT NULL DEFAULT 1,
       description  NVARCHAR(256) NOT NULL DEFAULT '',
       cost_per_sam NVARCHAR(64)  NOT NULL DEFAULT '',
       per_piece    NVARCHAR(64)  NOT NULL DEFAULT '',
       use_type     NVARCHAR(32)  NOT NULL DEFAULT 'sam',
       row_order    INT           NOT NULL DEFAULT 0
     )
     ELSE
     BEGIN
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('direct_labour_foh') AND name = 'per_piece')
         ALTER TABLE direct_labour_foh ADD per_piece NVARCHAR(64) NOT NULL DEFAULT '';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('direct_labour_foh') AND name = 'card_id')
         ALTER TABLE direct_labour_foh ADD card_id NVARCHAR(128) NOT NULL DEFAULT 'card-1';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('direct_labour_foh') AND name = 'card_name')
         ALTER TABLE direct_labour_foh ADD card_name NVARCHAR(256) NOT NULL DEFAULT 'Card 1';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('direct_labour_foh') AND name = 'is_active')
         ALTER TABLE direct_labour_foh ADD is_active BIT NOT NULL DEFAULT 1;
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('direct_labour_foh') AND name = 'card_serial')
         ALTER TABLE direct_labour_foh ADD card_serial INT NOT NULL DEFAULT 1;
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('direct_labour_foh') AND name = 'use_type')
         ALTER TABLE direct_labour_foh ADD use_type NVARCHAR(32) NOT NULL DEFAULT 'sam';
     END`,

    // ── admin_selling ───────────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='admin_selling')
     CREATE TABLE admin_selling (
       id           NVARCHAR(128) NOT NULL,
       card_id      NVARCHAR(128) NOT NULL DEFAULT 'card-1',
       card_name    NVARCHAR(256) NOT NULL DEFAULT 'Card 1',
       is_active    BIT           NOT NULL DEFAULT 1,
       card_serial  INT           NOT NULL DEFAULT 1,
       description  NVARCHAR(256) NOT NULL DEFAULT '',
       cost_per_sam NVARCHAR(64)  NOT NULL DEFAULT '',
       row_order    INT           NOT NULL DEFAULT 0
     )
     ELSE
     BEGIN
       DECLARE @ConstraintName_admin_selling nvarchar(200);
       SELECT @ConstraintName_admin_selling = Name FROM sys.key_constraints WHERE type = 'PK' AND parent_object_id = OBJECT_ID('admin_selling');
       IF @ConstraintName_admin_selling IS NOT NULL
         EXEC('ALTER TABLE admin_selling DROP CONSTRAINT ' + @ConstraintName_admin_selling);
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('admin_selling') AND name = 'card_id')
         ALTER TABLE admin_selling ADD card_id NVARCHAR(128) NOT NULL DEFAULT 'card-1';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('admin_selling') AND name = 'card_name')
         ALTER TABLE admin_selling ADD card_name NVARCHAR(256) NOT NULL DEFAULT 'Card 1';
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('admin_selling') AND name = 'is_active')
         ALTER TABLE admin_selling ADD is_active BIT NOT NULL DEFAULT 1;
       IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('admin_selling') AND name = 'card_serial')
         ALTER TABLE admin_selling ADD card_serial INT NOT NULL DEFAULT 1;
     END`,

    // ── dropdown_lists ──────────────────────────────────────────────────────
    `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='dropdown_lists')
     CREATE TABLE dropdown_lists (
       list_key   NVARCHAR(128) NOT NULL PRIMARY KEY,
       list_label NVARCHAR(256) NOT NULL,
       items_json NVARCHAR(MAX) NOT NULL DEFAULT '[]',
       sort_order INT           NOT NULL DEFAULT 0
     )`,
  ];

  for (const ddl of ddlStatements) {
    await pool.request().query(ddl);
  }

  tablesReady = true;
}

// ---------------------------------------------------------------------------
// 1. CUT-TO-SHIP GRID
// ---------------------------------------------------------------------------
async function getCutToShipGrid(pool: Awaited<ReturnType<typeof getPool>>): Promise<MatrixTableData> {
  const result = await pool.request().query<{
    qty_band: string;
    style_category: string;
    value: string;
    row_order: number;
    col_order: number;
  }>("SELECT qty_band, style_category, value, row_order, col_order FROM cut_to_ship_grid ORDER BY row_order, col_order");

  const rowMap = new Map<string, number>();
  const colMap = new Map<string, number>();
  const cells: Record<string, Record<string, string>> = {};

  for (const r of result.recordset) {
    if (!rowMap.has(r.qty_band)) rowMap.set(r.qty_band, r.row_order);
    if (!colMap.has(r.style_category)) colMap.set(r.style_category, r.col_order);
    if (!cells[r.qty_band]) cells[r.qty_band] = {};
    cells[r.qty_band][r.style_category] = r.value;
  }

  const rowLabels = [...rowMap.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
  const columnLabels = [...colMap.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);

  return { rowLabels, columnLabels, cells };
}

async function saveCutToShipGrid(pool: Awaited<ReturnType<typeof getPool>>, data: MatrixTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM cut_to_ship_grid");
    for (let ri = 0; ri < data.rowLabels.length; ri++) {
      const qty = data.rowLabels[ri];
      for (let ci = 0; ci < data.columnLabels.length; ci++) {
        const cat = data.columnLabels[ci];
        await new sql.Request(tx)
          .input("qty_band", sql.NVarChar(64), qty)
          .input("style_category", sql.NVarChar(64), cat)
          .input("value", sql.NVarChar(32), data.cells[qty]?.[cat] ?? "")
          .input("row_order", sql.Int, ri)
          .input("col_order", sql.Int, ci)
          .query(
            "INSERT INTO cut_to_ship_grid (qty_band, style_category, value, row_order, col_order) VALUES (@qty_band, @style_category, @value, @row_order, @col_order)"
          );
      }
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 2. REJECTION GRID
// ---------------------------------------------------------------------------
async function getRejectionGrid(pool: Awaited<ReturnType<typeof getPool>>): Promise<ProcessMatrixTableData> {
  const result = await pool.request().query<{
    process: string;
    qty_band: string;
    style_category: string;
    value: string;
    process_order: number;
    row_order: number;
    col_order: number;
  }>("SELECT process, qty_band, style_category, value, process_order, row_order, col_order FROM rejection_grid ORDER BY process_order, row_order, col_order");

  const processMap = new Map<string, number>();
  const tables: Record<string, MatrixTableData> = {};

  for (const r of result.recordset) {
    if (!processMap.has(r.process)) {
      processMap.set(r.process, r.process_order);
      tables[r.process] = { rowLabels: [], columnLabels: [], cells: {} };
    }
    const tbl = tables[r.process];
    if (!tbl.rowLabels.includes(r.qty_band)) tbl.rowLabels.push(r.qty_band);
    if (!tbl.columnLabels.includes(r.style_category)) tbl.columnLabels.push(r.style_category);
    if (!tbl.cells[r.qty_band]) tbl.cells[r.qty_band] = {};
    tbl.cells[r.qty_band][r.style_category] = r.value;
  }

  const processes = [...processMap.entries()].sort((a, b) => a[1] - b[1]).map(([k]) => k);
  if (processes.length === 0) {
    processes.push("Fabric", "Cutting", "Sewing", "Finishing", "WIP", "E1");
  }

  // Load customer single rejection rates
  const customerRejections: Record<string, string> = {};
  try {
    const custRes = await pool.request().query<{
      customer_name: string;
      rejection_pct: string;
    }>("SELECT customer_name, rejection_pct FROM customer_rejections ORDER BY row_order, customer_name");
    for (const row of custRes.recordset) {
      if (row.customer_name) {
        customerRejections[row.customer_name] = row.rejection_pct;
      }
    }
  } catch {
    // If table doesn't exist yet, ignore
  }

  // Load rejection mode settings (active/inactive toggle and default rejection rate)
  let useGridRejection = true;
  let defaultRejection = "4.00%";
  try {
    const settingsRes = await pool.request().query<{
      use_grid_rejection: boolean | number;
      default_rejection: string;
    }>("SELECT use_grid_rejection, default_rejection FROM rejection_settings WHERE id = 1");
    if (settingsRes.recordset.length > 0) {
      const s = settingsRes.recordset[0];
      useGridRejection = Boolean(s.use_grid_rejection);
      if (s.default_rejection) {
        defaultRejection = s.default_rejection;
      }
    }
  } catch {
    // If table doesn't exist yet, ignore
  }

  return { processes, tables, customerRejections, useGridRejection, defaultRejection };
}

async function saveRejectionGrid(pool: Awaited<ReturnType<typeof getPool>>, data: ProcessMatrixTableData): Promise<void> {
  const req = pool.request();
  const sqlStatements: string[] = ["BEGIN TRANSACTION;"];

  const rows: {
    process: string;
    qty: string;
    cat: string;
    val: string;
    pi: number;
    ri: number;
    ci: number;
  }[] = [];

  if (data.tables && Object.keys(data.tables).length > 0) {
    for (let pi = 0; pi < data.processes.length; pi++) {
      const process = data.processes[pi];
      const matrix = data.tables[process];
      if (!matrix || !matrix.rowLabels || !matrix.columnLabels) continue;

      for (let ri = 0; ri < matrix.rowLabels.length; ri++) {
        const qty = matrix.rowLabels[ri];
        for (let ci = 0; ci < matrix.columnLabels.length; ci++) {
          const cat = matrix.columnLabels[ci];
          rows.push({
            process,
            qty,
            cat,
            val: matrix.cells[qty]?.[cat] ?? "",
            pi,
            ri,
            ci,
          });
        }
      }
    }
  }

  // IMPORTANT: Only touch rejection_grid if full table data was provided!
  if (rows.length > 0) {
    sqlStatements.push("DELETE FROM rejection_grid;");
    const valuesSql = rows.map((r, idx) => {
      req.input(`p_${idx}`, r.process);
      req.input(`q_${idx}`, r.qty);
      req.input(`c_${idx}`, r.cat);
      req.input(`v_${idx}`, r.val);
      req.input(`po_${idx}`, r.pi);
      req.input(`ro_${idx}`, r.ri);
      req.input(`co_${idx}`, r.ci);
      return `(@p_${idx}, @q_${idx}, @c_${idx}, @v_${idx}, @po_${idx}, @ro_${idx}, @co_${idx})`;
    });
    sqlStatements.push(
      `INSERT INTO rejection_grid (process, qty_band, style_category, value, process_order, row_order, col_order) VALUES ${valuesSql.join(", ")};`
    );
  }

  // Save customer single rejection values in bulk
  if (data.customerRejections !== undefined) {
    sqlStatements.push("DELETE FROM customer_rejections;");
    const custEntries = Object.entries(data.customerRejections).filter(
      ([cust, rej]) => cust.trim() && rej && rej.trim()
    );
    if (custEntries.length > 0) {
      const valuesSql = custEntries.map(([custName, rejVal], idx) => {
        req.input(`cn_${idx}`, custName.trim());
        req.input(`rp_${idx}`, rejVal.trim());
        req.input(`cro_${idx}`, idx);
        return `(@cn_${idx}, @rp_${idx}, @cro_${idx})`;
      });
      sqlStatements.push(
        `INSERT INTO customer_rejections (customer_name, rejection_pct, row_order) VALUES ${valuesSql.join(", ")};`
      );
    }
  }

  // Save rejection mode settings (active/inactive toggle and default rejection rate)
  if (data.useGridRejection !== undefined || data.defaultRejection !== undefined) {
    const useGrid = data.useGridRejection !== false ? 1 : 0;
    const defRej = data.defaultRejection || "4.00%";
    req.input("set_use_grid", useGrid);
    req.input("set_def_rej", defRej);
    sqlStatements.push(`
      IF EXISTS (SELECT 1 FROM rejection_settings WHERE id = 1)
        UPDATE rejection_settings SET use_grid_rejection = @set_use_grid, default_rejection = @set_def_rej WHERE id = 1;
      ELSE
        INSERT INTO rejection_settings (id, use_grid_rejection, default_rejection) VALUES (1, @set_use_grid, @set_def_rej);
    `);
  }

  sqlStatements.push("COMMIT TRANSACTION;");
  await req.query(sqlStatements.join("\n"));
}

// ---------------------------------------------------------------------------
// 3. STYLES
// ---------------------------------------------------------------------------
async function getStyles(pool: Awaited<ReturnType<typeof getPool>>): Promise<SimpleTableData> {
  const [colResult, valResult] = await Promise.all([
    pool.request().query<{ card_id?: string; col_key: string; col_label: string; sort_order: number }>(
      "SELECT card_id, col_key, col_label, sort_order FROM styles_columns ORDER BY card_id, sort_order"
    ),
    pool.request().query<{ card_id?: string; card_name?: string; is_active?: boolean | number; card_serial?: number; row_id: string; col_key: string; col_value: string; row_order: number }>(
      "SELECT card_id, card_name, is_active, card_serial, row_id, col_key, col_value, row_order FROM styles_values ORDER BY card_serial, card_id, row_order, row_id"
    ),
  ]);

  const defaultColumns = [
    { key: "styleName", label: "Style Category" },
    { key: "samPcFrom", label: "SAM/PC From" },
    { key: "samPcTo", label: "SAM/PC To" },
  ];

  // Group columns by card_id
  const colsByCard = new Map<string, Array<{ key: string; label: string }>>();
  for (const c of colResult.recordset) {
    const cId = c.card_id || "card-1";
    if (!colsByCard.has(cId)) colsByCard.set(cId, []);
    colsByCard.get(cId)!.push({ key: c.col_key, label: c.col_label });
  }

  // If no rows exist at all
  if (valResult.recordset.length === 0) {
    const cols = colsByCard.get("card-1") || defaultColumns;
    const initialCard: SimpleTableCard = {
      id: "card-1",
      serialNo: 1,
      name: "Card 1",
      isActive: true,
      columns: cols,
      rows: [],
    };
    return { columns: cols, rows: [], cards: [initialCard], activeCardId: "card-1" };
  }

  // Group values into cards
  const cardMap = new Map<string, {
    serial: number;
    name: string;
    isActive: boolean;
    rowMap: Map<string, { order: number; values: Record<string, string> }>;
  }>();

  for (const r of valResult.recordset) {
    const cId = r.card_id || "card-1";
    if (!cardMap.has(cId)) {
      cardMap.set(cId, {
        serial: r.card_serial ?? (cardMap.size + 1),
        name: r.card_name || `Card ${cardMap.size + 1}`,
        isActive: r.is_active === true || r.is_active === 1,
        rowMap: new Map(),
      });
    }
    const cardEntry = cardMap.get(cId)!;
    if (!cardEntry.rowMap.has(r.row_id)) {
      cardEntry.rowMap.set(r.row_id, { order: r.row_order, values: {} });
    }
    cardEntry.rowMap.get(r.row_id)!.values[r.col_key] = r.col_value;
  }

  const cards: SimpleTableCard[] = Array.from(cardMap.entries()).map(([cId, entry]) => {
    const cardCols = colsByCard.get(cId) || defaultColumns;
    const cardRows = [...entry.rowMap.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([id, { values }]) => ({ id, values }));
    return {
      id: cId,
      serialNo: entry.serial,
      name: entry.name,
      isActive: entry.isActive,
      columns: cardCols,
      rows: cardRows,
    };
  });

  let activeCard = cards.find((c) => c.isActive);
  if (!activeCard) {
    cards[0].isActive = true;
    activeCard = cards[0];
  }

  return {
    columns: activeCard.columns || defaultColumns,
    rows: activeCard.rows,
    cards,
    activeCardId: activeCard.id,
  };
}

async function saveStyles(pool: Awaited<ReturnType<typeof getPool>>, data: SimpleTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM styles_values");
    await new sql.Request(tx).query("DELETE FROM styles_columns");

    const cardsToSave: SimpleTableCard[] =
      data.cards && data.cards.length > 0
        ? data.cards
        : [
            {
              id: "card-1",
              serialNo: 1,
              name: "Card 1",
              isActive: true,
              columns: data.columns,
              rows: data.rows,
            },
          ];

    for (const card of cardsToSave) {
      const cardId = card.id || "card-1";
      const cardName = card.name || `Card ${card.serialNo || 1}`;
      const isActive = card.isActive ? 1 : 0;
      const cardSerial = card.serialNo || 1;
      const cols = card.columns && card.columns.length > 0 ? card.columns : data.columns;

      for (let i = 0; i < cols.length; i++) {
        const col = cols[i];
        await new sql.Request(tx)
          .input("card_id", sql.NVarChar(128), cardId)
          .input("col_key", sql.NVarChar(128), col.key)
          .input("col_label", sql.NVarChar(256), col.label)
          .input("sort_order", sql.Int, i)
          .query(
            "INSERT INTO styles_columns (card_id, col_key, col_label, sort_order) VALUES (@card_id, @col_key, @col_label, @sort_order)"
          );
      }

      for (let i = 0; i < card.rows.length; i++) {
        const row = card.rows[i];
        for (const col of cols) {
          await new sql.Request(tx)
            .input("card_id", sql.NVarChar(128), cardId)
            .input("card_name", sql.NVarChar(256), cardName)
            .input("is_active", sql.Bit, isActive)
            .input("card_serial", sql.Int, cardSerial)
            .input("row_id", sql.NVarChar(128), row.id)
            .input("col_key", sql.NVarChar(128), col.key)
            .input("col_value", sql.NVarChar(sql.MAX), row.values[col.key] ?? "")
            .input("row_order", sql.Int, i)
            .query(
              "INSERT INTO styles_values (card_id, card_name, is_active, card_serial, row_id, col_key, col_value, row_order) VALUES (@card_id, @card_name, @is_active, @card_serial, @row_id, @col_key, @col_value, @row_order)"
            );
        }
      }
    }

    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 4. OTHER EXPENSES (dedicated table: other_expenses)
// ---------------------------------------------------------------------------
async function getOtherExpenses(pool: Awaited<ReturnType<typeof getPool>>): Promise<SimpleTableData> {
  const result = await pool.request().query<{
    id: string;
    card_id?: string;
    card_name?: string;
    is_active?: boolean | number;
    card_serial?: number;
    description: string;
    percent_of_sales: string;
    row_order: number;
  }>("SELECT id, card_id, card_name, is_active, card_serial, description, percent_of_sales, row_order FROM other_expenses ORDER BY card_serial, card_id, row_order, id");

  const defaultColumns = [
    { key: "description", label: "Description" },
    { key: "percentOfSales", label: "% of Sales" },
  ];

  if (result.recordset.length === 0) {
    const initialCard: SimpleTableCard = {
      id: "card-1",
      serialNo: 1,
      name: "Card 1",
      isActive: true,
      columns: defaultColumns,
      rows: [],
    };
    return { columns: defaultColumns, rows: [], cards: [initialCard], activeCardId: "card-1" };
  }

  const cardMap = new Map<string, SimpleTableCard>();
  for (const r of result.recordset) {
    const cId = r.card_id || "card-1";
    if (!cardMap.has(cId)) {
      cardMap.set(cId, {
        id: cId,
        serialNo: r.card_serial ?? (cardMap.size + 1),
        name: r.card_name || `Card ${cardMap.size + 1}`,
        isActive: r.is_active === true || r.is_active === 1,
        columns: defaultColumns,
        rows: [],
      });
    }
    const card = cardMap.get(cId)!;
    card.rows.push({
      id: r.id,
      values: { description: r.description, percentOfSales: r.percent_of_sales },
    });
  }

  const cards = Array.from(cardMap.values());
  let activeCard = cards.find((c) => c.isActive);
  if (!activeCard) {
    cards[0].isActive = true;
    activeCard = cards[0];
  }

  return {
    columns: activeCard.columns || defaultColumns,
    rows: activeCard.rows,
    cards,
    activeCardId: activeCard.id,
  };
}

async function saveOtherExpenses(pool: Awaited<ReturnType<typeof getPool>>, data: SimpleTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM other_expenses");
    const cardsToSave = data.cards && data.cards.length > 0 ? data.cards : [{
      id: "card-1", name: "Card 1", serialNo: 1, isActive: true, columns: data.columns, rows: data.rows
    }];
    for (const card of cardsToSave) {
      for (let i = 0; i < card.rows.length; i++) {
        const row = card.rows[i];
        await new sql.Request(tx)
          .input("id", sql.NVarChar(128), row.id)
          .input("card_id", sql.NVarChar(128), card.id)
          .input("card_name", sql.NVarChar(256), card.name || `Card ${card.serialNo}`)
          .input("is_active", sql.Bit, card.isActive ? 1 : 0)
          .input("card_serial", sql.Int, card.serialNo || 1)
          .input("description", sql.NVarChar(256), row.values.description ?? "")
          .input("percent_of_sales", sql.NVarChar(64), row.values.percentOfSales ?? "")
          .input("row_order", sql.Int, i)
          .query("INSERT INTO other_expenses (id, card_id, card_name, is_active, card_serial, description, percent_of_sales, row_order) VALUES (@id, @card_id, @card_name, @is_active, @card_serial, @description, @percent_of_sales, @row_order)");
      }
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 5. ORDER TYPES (dedicated table: order_types)
// ---------------------------------------------------------------------------
async function getOrderTypes(pool: Awaited<ReturnType<typeof getPool>>): Promise<SimpleTableData> {
  const result = await pool.request().query<{
    id: string;
    card_id?: string;
    card_name?: string;
    is_active?: boolean | number;
    card_serial?: number;
    order_type: string;
    row_order: number;
  }>("SELECT id, card_id, card_name, is_active, card_serial, order_type, row_order FROM order_types ORDER BY card_serial, card_id, row_order, id");

  const defaultColumns = [{ key: "orderType", label: "Order Type" }];

  if (result.recordset.length === 0) {
    const initialCard: SimpleTableCard = {
      id: "card-1",
      serialNo: 1,
      name: "Card 1",
      isActive: true,
      columns: defaultColumns,
      rows: [],
    };
    return { columns: defaultColumns, rows: [], cards: [initialCard], activeCardId: "card-1" };
  }

  const cardMap = new Map<string, SimpleTableCard>();
  for (const r of result.recordset) {
    const cId = r.card_id || "card-1";
    if (!cardMap.has(cId)) {
      cardMap.set(cId, {
        id: cId,
        serialNo: r.card_serial ?? (cardMap.size + 1),
        name: r.card_name || `Card ${cardMap.size + 1}`,
        isActive: r.is_active === true || r.is_active === 1,
        columns: defaultColumns,
        rows: [],
      });
    }
    const card = cardMap.get(cId)!;
    card.rows.push({
      id: r.id,
      values: { orderType: r.order_type },
    });
  }

  const cards = Array.from(cardMap.values());
  let activeCard = cards.find((c) => c.isActive);
  if (!activeCard) {
    cards[0].isActive = true;
    activeCard = cards[0];
  }

  return {
    columns: activeCard.columns || defaultColumns,
    rows: activeCard.rows,
    cards,
    activeCardId: activeCard.id,
  };
}

async function saveOrderTypes(pool: Awaited<ReturnType<typeof getPool>>, data: SimpleTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM order_types");
    const cardsToSave = data.cards && data.cards.length > 0 ? data.cards : [{
      id: "card-1", name: "Card 1", serialNo: 1, isActive: true, columns: data.columns, rows: data.rows
    }];
    for (const card of cardsToSave) {
      for (let i = 0; i < card.rows.length; i++) {
        const row = card.rows[i];
        await new sql.Request(tx)
          .input("id", sql.NVarChar(128), row.id)
          .input("card_id", sql.NVarChar(128), card.id)
          .input("card_name", sql.NVarChar(256), card.name || `Card ${card.serialNo}`)
          .input("is_active", sql.Bit, card.isActive ? 1 : 0)
          .input("card_serial", sql.Int, card.serialNo || 1)
          .input("order_type", sql.NVarChar(128), row.values.orderType ?? "")
          .input("row_order", sql.Int, i)
          .query("INSERT INTO order_types (id, card_id, card_name, is_active, card_serial, order_type, row_order) VALUES (@id, @card_id, @card_name, @is_active, @card_serial, @order_type, @row_order)");
      }
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 6. CUSTOMER COMMISSIONS (dedicated table: customer_commissions)
// ---------------------------------------------------------------------------
async function getCustomerCommissions(pool: Awaited<ReturnType<typeof getPool>>): Promise<SimpleTableData> {
  const result = await pool.request().query<{
    id: string;
    card_id?: string;
    card_name?: string;
    is_active?: boolean | number;
    card_serial?: number;
    customer: string;
    commission_percent: string;
    row_order: number;
  }>("SELECT id, card_id, card_name, is_active, card_serial, customer, commission_percent, row_order FROM customer_commissions ORDER BY card_serial, card_id, row_order, id");

  const defaultColumns = [
    { key: "customer", label: "Customer" },
    { key: "commissionPercent", label: "Commission %" },
  ];

  if (result.recordset.length === 0) {
    const initialCard: SimpleTableCard = {
      id: "card-1",
      serialNo: 1,
      name: "Card 1",
      isActive: true,
      columns: defaultColumns,
      rows: [],
    };
    return { columns: defaultColumns, rows: [], cards: [initialCard], activeCardId: "card-1" };
  }

  const cardMap = new Map<string, SimpleTableCard>();
  for (const r of result.recordset) {
    const cId = r.card_id || "card-1";
    if (!cardMap.has(cId)) {
      cardMap.set(cId, {
        id: cId,
        serialNo: r.card_serial ?? (cardMap.size + 1),
        name: r.card_name || `Card ${cardMap.size + 1}`,
        isActive: r.is_active === true || r.is_active === 1,
        columns: defaultColumns,
        rows: [],
      });
    }
    const card = cardMap.get(cId)!;
    card.rows.push({
      id: r.id,
      values: { customer: r.customer, commissionPercent: r.commission_percent },
    });
  }

  const cards = Array.from(cardMap.values());
  let activeCard = cards.find((c) => c.isActive);
  if (!activeCard) {
    cards[0].isActive = true;
    activeCard = cards[0];
  }

  return {
    columns: activeCard.columns || defaultColumns,
    rows: activeCard.rows,
    cards,
    activeCardId: activeCard.id,
  };
}

async function saveCustomerCommissions(pool: Awaited<ReturnType<typeof getPool>>, data: SimpleTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM customer_commissions");
    const cardsToSave = data.cards && data.cards.length > 0 ? data.cards : [{
      id: "card-1", name: "Card 1", serialNo: 1, isActive: true, columns: data.columns, rows: data.rows
    }];
    for (const card of cardsToSave) {
      for (let i = 0; i < card.rows.length; i++) {
        const row = card.rows[i];
        await new sql.Request(tx)
          .input("id", sql.NVarChar(128), row.id)
          .input("card_id", sql.NVarChar(128), card.id)
          .input("card_name", sql.NVarChar(256), card.name || `Card ${card.serialNo}`)
          .input("is_active", sql.Bit, card.isActive ? 1 : 0)
          .input("card_serial", sql.Int, card.serialNo || 1)
          .input("customer", sql.NVarChar(256), row.values.customer ?? "")
          .input("commission_percent", sql.NVarChar(64), row.values.commissionPercent ?? "")
          .input("row_order", sql.Int, i)
          .query("INSERT INTO customer_commissions (id, card_id, card_name, is_active, card_serial, customer, commission_percent, row_order) VALUES (@id, @card_id, @card_name, @is_active, @card_serial, @customer, @commission_percent, @row_order)");
      }
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 7. COST AS % OF SALES (dedicated table: cost_as_percent_of_sales)
// ---------------------------------------------------------------------------
async function getCostAsPercentOfSales(pool: Awaited<ReturnType<typeof getPool>>): Promise<SimpleTableData> {
  const result = await pool.request().query<{
    id: string;
    card_id?: string;
    card_name?: string;
    is_active?: boolean | number;
    card_serial?: number;
    description: string;
    percent_of_sales: string;
    row_order: number;
  }>("SELECT id, card_id, card_name, is_active, card_serial, description, percent_of_sales, row_order FROM cost_as_percent_of_sales ORDER BY card_serial, card_id, row_order, id");

  const defaultColumns = [
    { key: "description", label: "Description" },
    { key: "percentOfSales", label: "% of Sales" },
  ];

  if (result.recordset.length === 0) {
    const initialCard: SimpleTableCard = {
      id: "card-1",
      serialNo: 1,
      name: "Card 1",
      isActive: true,
      columns: defaultColumns,
      rows: [],
    };
    return { columns: defaultColumns, rows: [], cards: [initialCard], activeCardId: "card-1" };
  }

  const cardMap = new Map<string, SimpleTableCard>();
  for (const r of result.recordset) {
    const cId = r.card_id || "card-1";
    if (!cardMap.has(cId)) {
      cardMap.set(cId, {
        id: cId,
        serialNo: r.card_serial ?? (cardMap.size + 1),
        name: r.card_name || `Card ${cardMap.size + 1}`,
        isActive: r.is_active === true || r.is_active === 1,
        columns: defaultColumns,
        rows: [],
      });
    }
    const card = cardMap.get(cId)!;
    card.rows.push({
      id: r.id,
      values: { description: r.description, percentOfSales: r.percent_of_sales },
    });
  }

  const cards = Array.from(cardMap.values());
  let activeCard = cards.find((c) => c.isActive);
  if (!activeCard) {
    cards[0].isActive = true;
    activeCard = cards[0];
  }

  return {
    columns: activeCard.columns || defaultColumns,
    rows: activeCard.rows,
    cards,
    activeCardId: activeCard.id,
  };
}

async function saveCostAsPercentOfSales(pool: Awaited<ReturnType<typeof getPool>>, data: SimpleTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM cost_as_percent_of_sales");
    const cardsToSave = data.cards && data.cards.length > 0 ? data.cards : [{
      id: "card-1", name: "Card 1", serialNo: 1, isActive: true, columns: data.columns, rows: data.rows
    }];
    for (const card of cardsToSave) {
      for (let i = 0; i < card.rows.length; i++) {
        const row = card.rows[i];
        await new sql.Request(tx)
          .input("id", sql.NVarChar(128), row.id)
          .input("card_id", sql.NVarChar(128), card.id)
          .input("card_name", sql.NVarChar(256), card.name || `Card ${card.serialNo}`)
          .input("is_active", sql.Bit, card.isActive ? 1 : 0)
          .input("card_serial", sql.Int, card.serialNo || 1)
          .input("description", sql.NVarChar(256), row.values.description ?? "")
          .input("percent_of_sales", sql.NVarChar(64), row.values.percentOfSales ?? "")
          .input("row_order", sql.Int, i)
          .query("INSERT INTO cost_as_percent_of_sales (id, card_id, card_name, is_active, card_serial, description, percent_of_sales, row_order) VALUES (@id, @card_id, @card_name, @is_active, @card_serial, @description, @percent_of_sales, @row_order)");
      }
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 8. DIRECT LABOUR AND FOH (dedicated table: direct_labour_foh)
// ---------------------------------------------------------------------------
async function getDirectLabourFoh(pool: Awaited<ReturnType<typeof getPool>>): Promise<SimpleTableData> {
  const result = await pool.request().query<{
    id: string;
    card_id?: string;
    card_name?: string;
    is_active?: boolean | number;
    card_serial?: number;
    description: string;
    cost_per_sam: string;
    per_piece?: string;
    use_type?: string;
    row_order: number;
  }>(
    "SELECT id, card_id, card_name, is_active, card_serial, description, cost_per_sam, per_piece, use_type, row_order FROM direct_labour_foh ORDER BY card_serial, card_id, row_order, id"
  );

  const defaultColumns = [
    { key: "description", label: "Description" },
    { key: "costPerSam", label: "Cost/SAM" },
    { key: "perPiece", label: "PER PIECE" },
  ];

  if (result.recordset.length === 0) {
    const defaultRows = [
      { id: "1", values: { description: "Direct Labour", costPerSam: "8.928", perPiece: "", useType: "sam" } },
      { id: "2", values: { description: "Fixed Salaries", costPerSam: "12.492", perPiece: "", useType: "sam" } },
      { id: "3", values: { description: "Utilities Cost", costPerSam: "4.5", perPiece: "", useType: "sam" } },
      { id: "4", values: { description: "Repair and Maintenance", costPerSam: "1.224", perPiece: "", useType: "sam" } },
      { id: "5", values: { description: "Manufacturing FOH", costPerSam: "6.876", perPiece: "", useType: "sam" } },
      { id: "6", values: { description: "Depreciation", costPerSam: "1.764", perPiece: "", useType: "sam" } },
    ];
    const initialCard: SimpleTableCard = {
      id: "card-1",
      serialNo: 1,
      name: "Card 1",
      isActive: true,
      columns: defaultColumns,
      rows: defaultRows,
    };
    return {
      columns: defaultColumns,
      rows: defaultRows,
      cards: [initialCard],
      activeCardId: "card-1",
    };
  }

  // Group rows by card_id
  const cardMap = new Map<string, SimpleTableCard>();
  for (const r of result.recordset) {
    const cId = r.card_id || "card-1";
    if (!cardMap.has(cId)) {
      cardMap.set(cId, {
        id: cId,
        serialNo: r.card_serial ?? (cardMap.size + 1),
        name: r.card_name || `Card ${cardMap.size + 1}`,
        isActive: r.is_active === true || r.is_active === 1,
        columns: defaultColumns,
        rows: [],
      });
    }
    const card = cardMap.get(cId)!;
    card.rows.push({
      id: r.id,
      values: {
        description: r.description,
        costPerSam: r.cost_per_sam,
        perPiece: r.per_piece ?? "",
        useType: r.use_type || "sam",
      },
    });
  }

  const cards = Array.from(cardMap.values());
  // Ensure exactly one active card
  let activeCard = cards.find((c) => c.isActive);
  if (!activeCard) {
    cards[0].isActive = true;
    activeCard = cards[0];
  }

  return {
    columns: activeCard.columns || defaultColumns,
    rows: activeCard.rows,
    cards,
    activeCardId: activeCard.id,
  };
}

async function saveDirectLabourFoh(pool: Awaited<ReturnType<typeof getPool>>, data: SimpleTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM direct_labour_foh");

    if (data.cards && data.cards.length > 0) {
      for (const card of data.cards) {
        for (let i = 0; i < card.rows.length; i++) {
          const row = card.rows[i];
          const perPieceVal =
            row.values.perPiece ??
            row.values.per_piece ??
            row.values["PER PIECE"] ??
            "";
          const useTypeVal =
            row.values.useType ??
            row.values.use_type ??
            "sam";
          await new sql.Request(tx)
            .input("id", sql.NVarChar(128), row.id)
            .input("card_id", sql.NVarChar(128), card.id)
            .input("card_name", sql.NVarChar(256), card.name || `Card ${card.serialNo}`)
            .input("is_active", sql.Bit, card.isActive ? 1 : 0)
            .input("card_serial", sql.Int, card.serialNo || 1)
            .input("description", sql.NVarChar(256), row.values.description ?? "")
            .input(
              "cost_per_sam",
              sql.NVarChar(64),
              row.values.costPerSam ?? row.values.cost_per_sam ?? "",
            )
            .input("per_piece", sql.NVarChar(64), perPieceVal)
            .input("use_type", sql.NVarChar(32), useTypeVal)
            .input("row_order", sql.Int, i)
            .query(
              "INSERT INTO direct_labour_foh (id, card_id, card_name, is_active, card_serial, description, cost_per_sam, per_piece, use_type, row_order) VALUES (@id, @card_id, @card_name, @is_active, @card_serial, @description, @cost_per_sam, @per_piece, @use_type, @row_order)"
            );
        }
      }
    } else {
      for (let i = 0; i < data.rows.length; i++) {
        const row = data.rows[i];
        const perPieceVal =
          row.values.perPiece ??
          row.values.per_piece ??
          row.values["PER PIECE"] ??
          "";
        const useTypeVal =
          row.values.useType ??
          row.values.use_type ??
          "sam";
        await new sql.Request(tx)
          .input("id", sql.NVarChar(128), row.id)
          .input("card_id", sql.NVarChar(128), "card-1")
          .input("card_name", sql.NVarChar(256), "Card 1")
          .input("is_active", sql.Bit, 1)
          .input("card_serial", sql.Int, 1)
          .input("description", sql.NVarChar(256), row.values.description ?? "")
          .input(
            "cost_per_sam",
            sql.NVarChar(64),
            row.values.costPerSam ?? row.values.cost_per_sam ?? "",
          )
          .input("per_piece", sql.NVarChar(64), perPieceVal)
          .input("use_type", sql.NVarChar(32), useTypeVal)
          .input("row_order", sql.Int, i)
          .query(
            "INSERT INTO direct_labour_foh (id, card_id, card_name, is_active, card_serial, description, cost_per_sam, per_piece, use_type, row_order) VALUES (@id, @card_id, @card_name, @is_active, @card_serial, @description, @cost_per_sam, @per_piece, @use_type, @row_order)"
          );
      }
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 9. ADMIN AND SELLING (dedicated table: admin_selling)
// ---------------------------------------------------------------------------
async function getAdminSelling(pool: Awaited<ReturnType<typeof getPool>>): Promise<SimpleTableData> {
  const result = await pool.request().query<{
    id: string;
    card_id?: string;
    card_name?: string;
    is_active?: boolean | number;
    card_serial?: number;
    description: string;
    cost_per_sam: string;
    row_order: number;
  }>("SELECT id, card_id, card_name, is_active, card_serial, description, cost_per_sam, row_order FROM admin_selling ORDER BY card_serial, card_id, row_order, id");

  const defaultColumns = [
    { key: "description", label: "Description" },
    { key: "costPerSam", label: "Cost/SAM" },
  ];

  if (result.recordset.length === 0) {
    const initialCard: SimpleTableCard = {
      id: "card-1",
      serialNo: 1,
      name: "Card 1",
      isActive: true,
      columns: defaultColumns,
      rows: [],
    };
    return { columns: defaultColumns, rows: [], cards: [initialCard], activeCardId: "card-1" };
  }

  const cardMap = new Map<string, SimpleTableCard>();
  for (const r of result.recordset) {
    const cId = r.card_id || "card-1";
    if (!cardMap.has(cId)) {
      cardMap.set(cId, {
        id: cId,
        serialNo: r.card_serial ?? (cardMap.size + 1),
        name: r.card_name || `Card ${cardMap.size + 1}`,
        isActive: r.is_active === true || r.is_active === 1,
        columns: defaultColumns,
        rows: [],
      });
    }
    const card = cardMap.get(cId)!;
    card.rows.push({
      id: r.id,
      values: { description: r.description, costPerSam: r.cost_per_sam },
    });
  }

  const cards = Array.from(cardMap.values());
  let activeCard = cards.find((c) => c.isActive);
  if (!activeCard) {
    cards[0].isActive = true;
    activeCard = cards[0];
  }

  return {
    columns: activeCard.columns || defaultColumns,
    rows: activeCard.rows,
    cards,
    activeCardId: activeCard.id,
  };
}

async function saveAdminSelling(pool: Awaited<ReturnType<typeof getPool>>, data: SimpleTableData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM admin_selling");
    const cardsToSave = data.cards && data.cards.length > 0 ? data.cards : [{
      id: "card-1", name: "Card 1", serialNo: 1, isActive: true, columns: data.columns, rows: data.rows
    }];
    for (const card of cardsToSave) {
      for (let i = 0; i < card.rows.length; i++) {
        const row = card.rows[i];
        await new sql.Request(tx)
          .input("id", sql.NVarChar(128), row.id)
          .input("card_id", sql.NVarChar(128), card.id)
          .input("card_name", sql.NVarChar(256), card.name || `Card ${card.serialNo}`)
          .input("is_active", sql.Bit, card.isActive ? 1 : 0)
          .input("card_serial", sql.Int, card.serialNo || 1)
          .input("description", sql.NVarChar(256), row.values.description ?? "")
          .input("cost_per_sam", sql.NVarChar(64), row.values.costPerSam ?? "")
          .input("row_order", sql.Int, i)
          .query("INSERT INTO admin_selling (id, card_id, card_name, is_active, card_serial, description, cost_per_sam, row_order) VALUES (@id, @card_id, @card_name, @is_active, @card_serial, @description, @cost_per_sam, @row_order)");
      }
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 10. DROPDOWN LISTS (dedicated table: dropdown_lists)
// ---------------------------------------------------------------------------
async function getDropdownLists(pool: Awaited<ReturnType<typeof getPool>>): Promise<DropdownListsData> {
  const result = await pool.request().query<{
    list_key: string;
    list_label: string;
    items_json: string;
    sort_order: number;
  }>("SELECT list_key, list_label, items_json, sort_order FROM dropdown_lists ORDER BY sort_order");

  const lists = result.recordset.map((r) => ({
    key: r.list_key,
    label: r.list_label,
    items: JSON.parse(r.items_json || "[]") as string[],
  }));

  return { lists };
}

async function saveDropdownLists(pool: Awaited<ReturnType<typeof getPool>>, data: DropdownListsData): Promise<void> {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query("DELETE FROM dropdown_lists");
    for (let i = 0; i < data.lists.length; i++) {
      const list = data.lists[i];
      await new sql.Request(tx)
        .input("list_key", sql.NVarChar(128), list.key)
        .input("list_label", sql.NVarChar(256), list.label)
        .input("items_json", sql.NVarChar(sql.MAX), JSON.stringify(list.items))
        .input("sort_order", sql.Int, i)
        .query("INSERT INTO dropdown_lists (list_key, list_label, items_json, sort_order) VALUES (@list_key, @list_label, @items_json, @sort_order)");
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// ===========================================================================
// Route Handlers
// ===========================================================================

// GET /api/parameters/[slug]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const pool = await getPool();
    await ensureTables(pool);

    let data: unknown;

    switch (slug) {
      case "cut-to-ship-grid":
        data = await getCutToShipGrid(pool);
        break;
      case "rejection-grid":
        data = await getRejectionGrid(pool);
        break;
      case "styles":
        data = await getStyles(pool);
        break;
      case "other-expenses":
        data = await getOtherExpenses(pool);
        break;
      case "order-type":
        data = await getOrderTypes(pool);
        break;
      case "customer-commission":
        data = await getCustomerCommissions(pool);
        break;
      case "cost-as-percent-of-sales":
        data = await getCostAsPercentOfSales(pool);
        break;
      case "direct-labour-foh":
        data = await getDirectLabourFoh(pool);
        break;
      case "admin-selling":
        data = await getAdminSelling(pool);
        break;
      case "dropdown-lists":
        data = await getDropdownLists(pool);
        break;
      default:
        return Response.json({ error: "Unknown parameter slug" }, { status: 404 });
    }

    return Response.json(data);
  } catch (err) {
    console.error("[GET /api/parameters/[slug]]", err);
    return Response.json({ error: "Failed to fetch parameter" }, { status: 500 });
  }
}

// PUT /api/parameters/[slug]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const pool = await getPool();
    await ensureTables(pool);

    switch (slug) {
      case "cut-to-ship-grid":
        await saveCutToShipGrid(pool, body as MatrixTableData);
        break;
      case "rejection-grid":
        await saveRejectionGrid(pool, body as ProcessMatrixTableData);
        break;
      case "styles":
        await saveStyles(pool, body as SimpleTableData);
        break;
      case "other-expenses":
        await saveOtherExpenses(pool, body as SimpleTableData);
        break;
      case "order-type":
        await saveOrderTypes(pool, body as SimpleTableData);
        break;
      case "customer-commission":
        await saveCustomerCommissions(pool, body as SimpleTableData);
        break;
      case "cost-as-percent-of-sales":
        await saveCostAsPercentOfSales(pool, body as SimpleTableData);
        break;
      case "direct-labour-foh":
        await saveDirectLabourFoh(pool, body as SimpleTableData);
        break;
      case "admin-selling":
        await saveAdminSelling(pool, body as SimpleTableData);
        break;
      case "dropdown-lists":
        await saveDropdownLists(pool, body as DropdownListsData);
        break;
      default:
        return Response.json({ error: "Unknown parameter slug" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[PUT /api/parameters/[slug]]", err);
    return Response.json({ error: message, stack }, { status: 500 });
  }
}
